import { build as esbuild } from "esbuild";
import { glob } from "glob";
import path from "path";
import fs from "fs";
import { handlerPlugin } from "./plugins/handler.js";

export async function build(cwd: string) {
  const apiDir = path.resolve(cwd, "api");
  const fnlyDir = path.resolve(cwd, ".fnly");
  const functionDir = path.resolve(fnlyDir, "functions");

  if (!fs.existsSync(apiDir)) {
    console.error(`❌ API directory not found: ${apiDir}`);
    throw new Error(`API directory not found: ${apiDir}`);
  }

  const files = await glob(`${apiDir}/**/*.{ts,js}`, {
    ignore: ["**/node_modules/**", "**/_*", "**/_*/**"]
  });

  if (files.length === 0) {
    console.warn(`⚠️  No API files found in ${apiDir}`);
    return;
  }

  if (fs.existsSync(functionDir)) {
    fs.rmSync(functionDir, { recursive: true, force: true });
  }

  const routes: Record<
    string,
    { file: string; runtime: string; handler: string }
  > = {};

  // Prepare entry points: map output paths to input files
  // const entryPoints: Record<string, string> = {};
  // const fileMetadata = new Map<
  //   string,
  //   { relativePath: string; outFile: string }
  // >();

  // for (const file of files) {
  //   const relativePath = path.relative(apiDir, file);
  //   const outFile = relativePath.replace(/\.(ts|js)$/, ".js");
  //   const outFileDir = path.dirname(path.join(outDir, outFile));

  //   // Ensure output directories exist
  //   fs.mkdirSync(outFileDir, { recursive: true });

  //   // Use output path as key (relative to outDir)
  //   entryPoints[outFile] = file;
  //   fileMetadata.set(file, { relativePath, outFile });
  // }

  // Build all files in a single esbuild call
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

  // Process each built file and transform paths
  //   for (const metadata of fileMetadata.values()) {
  //     const { relativePath, outFile } = metadata;

  //     // Transform route path
  //     let routePath = relativePath.replace(/\.(ts|js)$/, "").replace(/\\/g, "/");

  //     if (routePath.endsWith("/index")) {
  //       routePath = routePath.slice(0, -6);
  //     }

  //     routePath = "/" + routePath.replace(/^\/+/, "");

  //     routes[routePath === "//" ? "/" : routePath] = {
  //       file: outFile,
  //       runtime: "nodejs20.x",
  //       handler: "index.handler"
  //     };

  //     console.log(
  //       `✅ Built ${routePath} → ${path.relative(cwd, path.join(outDir, outFile))}`
  //     );
  //   }

  //   // Write routes manifest
  //   const manifestPath = path.join(outDir, "routes.json");
  //   fs.writeFileSync(manifestPath, JSON.stringify(routes, null, 2));

  console.log(`\n🗺️  Routes manifest created at dist/routes.json`);
  console.log(JSON.stringify(routes, null, 2));
}
