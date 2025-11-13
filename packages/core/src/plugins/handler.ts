import { Loader, PluginBuild } from "esbuild";
import path from "path";
import fs from "fs";

export const handlerPlugin = {
  name: "handler",
  setup(build: PluginBuild) {
    const entryPointSet = new Set<string>();

    const entryPoints = build.initialOptions.entryPoints;
    if (entryPoints) {
      const entryPointPaths = Array.isArray(entryPoints)
        ? entryPoints
        : Object.values(entryPoints);

      entryPointPaths.forEach((ep) => {
        const entryPath = typeof ep === "string" ? ep : ep.in;
        const normalizedPath = path.normalize(path.resolve(entryPath));
        entryPointSet.add(normalizedPath);
      });
    }

    build.onResolve({ filter: /api/ }, (args) => {
      if (args.kind === "entry-point") {
        const resolvedPath = path.normalize(
          path.isAbsolute(args.path)
            ? args.path
            : path.resolve(args.resolveDir || process.cwd(), args.path)
        );

        if (entryPointSet.has(resolvedPath)) {
          return {
            path: resolvedPath,
            namespace: "fnly-entry"
          };
        }
      }
    });

    build.onLoad({ filter: /.*/, namespace: "fnly-entry" }, async (args) => {
      const originalPath = args.path;
      const fileDir = path.dirname(originalPath);

      const virtualImportPath = `fnly-original:${originalPath}`;

      const wrappedCode = `
        import * as mod from "${virtualImportPath}";
        import { createRequestHandler } from "@fnly/core";

        export const handler = createRequestHandler(mod);
      `;

      return {
        contents: wrappedCode,
        loader: "ts",
        resolveDir: fileDir
      };
    });

    build.onResolve({ filter: /^fnly-original:/ }, (args) => {
      const originalPath = args.path.replace(/^fnly-original:/, "");
      return {
        path: originalPath,
        namespace: "fnly-original"
      };
    });

    build.onLoad({ filter: /.*/, namespace: "fnly-original" }, async (args) => {
      const contents = await fs.promises.readFile(args.path, "utf8");
      const ext = path.extname(args.path).slice(1);
      const resolveDir = path.dirname(args.path);

      return {
        contents,
        loader: ext as Loader,
        resolveDir
      };
    });
  }
};
