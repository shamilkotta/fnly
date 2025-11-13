import { build as esbuild } from "esbuild";
import { glob } from "glob";
import path from "path";
import fs from "fs";
import { tsImport } from "tsx/esm/api";

import { handlerPlugin } from "./plugins/handler.js";
import { filePathToRoute } from "./utils/filePathToRoute.js";

const ALLOWED_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD"
] as const;

type HttpMethod = (typeof ALLOWED_HTTP_METHODS)[number];

const RUNTIME = {
  nodejs20x: "nodejs20.x",
  nodejs22x: "nodejs22.x",
  nodejs24x: "nodejs24.x"
};

interface RouteManifest {
  [routePath: string]: {
    method: HttpMethod[];
    runtime: (typeof RUNTIME)[keyof typeof RUNTIME];
    handler: string;
    path: string;
  };
}

export async function build(cwd: string) {
  const apiDir = path.resolve(cwd, "api");
  const fnlyDir = path.resolve(cwd, ".fnly");
  const functionDir = path.resolve(fnlyDir, "functions");

  if (!fs.existsSync(apiDir)) {
    console.error(`❌ API directory not found: ${apiDir}`);
    process.exit(1);
  }

  let files = await glob(`${apiDir}/**/*.{ts,js}`, {
    ignore: ["**/node_modules/**", "**/_*", "**/_*/**"]
  });

  files = files.filter((file) => {
    const filePath = path.relative(apiDir, file);
    // eslint-disable-next-line no-useless-escape
    return /^[A-Za-z0-9.\/\\\-\[\]]+$/.test(filePath);
  });

  if (files.length === 0) {
    console.warn(`⚠️  No API files found in ${apiDir}`);
    return;
  }

  const manifest: RouteManifest = {};

  for (const file of files) {
    const relativePath = path.relative(apiDir, file);
    const routePath = filePathToRoute(relativePath, "worker");
    const handlerName = path.basename(file).replace(/\.(ts|js)$/, ".handler");

    const exportedMethods = await getMethods(file);

    if (exportedMethods.length > 0) {
      const existing = manifest[routePath];
      if (existing) {
        const existingMethods = existing.method;
        const allMethods = [
          ...new Set([...existingMethods, ...exportedMethods])
        ] as HttpMethod[];
        manifest[routePath] = {
          method: allMethods,
          runtime: RUNTIME.nodejs20x,
          handler: handlerName,
          path: relativePath.replace(/\.(ts|js)$/, ".js")
        };
      } else {
        manifest[routePath] = {
          method: exportedMethods as HttpMethod[],
          handler: handlerName,
          runtime: RUNTIME.nodejs20x,
          path: relativePath.replace(/\.(ts|js)$/, ".js")
        };
      }
    } else {
      console.error(`❌ No exported methods found in ${file}`);
      process.exit(1);
    }
  }

  if (fs.existsSync(functionDir)) {
    fs.rmSync(functionDir, { recursive: true, force: true });
  }

  const result = await esbuild({
    entryPoints: files,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outdir: functionDir,
    outbase: apiDir,
    sourcemap: false,
    minify: true,
    treeShaking: true,
    plugins: [handlerPlugin],
    external: ["@fnly/core"]
  });

  // Check for build errors
  if (result.errors.length > 0) {
    throw new Error(`Build failed with ${result.errors.length} error(s)`);
  }

  fs.copyFileSync(
    path.join(cwd, "package.json"),
    path.join(fnlyDir, "package.json")
  );

  // Write manifest.json
  const manifestPath = path.join(fnlyDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("✅ Build completed");
}

const getMethods = async (file: string) => {
  const module = await tsImport(file, import.meta.url);
  const methods = Object.keys(module);

  for (const method of methods) {
    if (!ALLOWED_HTTP_METHODS.includes(method as HttpMethod)) {
      console.error(`❌ Invalid method: ${method} in ${file}`);
      process.exit(1);
    }
  }

  return methods;
};
