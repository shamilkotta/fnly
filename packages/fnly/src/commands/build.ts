import { build } from "esbuild";
import { glob } from "glob";
import path from "path";
import fs from "fs";

export async function buildCommand() {
  const cwd = process.cwd();
  const apiDir = path.resolve(cwd, "api");
  const outDir = path.resolve(cwd, ".fnly");

  // Check if api directory exists
  if (!fs.existsSync(apiDir)) {
    console.error(`❌ API directory not found: ${apiDir}`);
    throw new Error(`API directory not found: ${apiDir}`);
  }

  // Clean output dir
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // Get all .ts or .js files in api/
  const files = await glob(`${apiDir}/**/*.{ts,js}`, {
    ignore: ["**/node_modules/**"]
  });

  if (files.length === 0) {
    console.warn(`⚠️  No API files found in ${apiDir}`);
    return;
  }

  const routes: Record<
    string,
    { file: string; runtime: string; handler: string }
  > = {};

  for (const file of files) {
    const relativePath = path.relative(apiDir, file);
    const outFile = path.join(
      outDir,
      relativePath.replace(/\.(ts|js)$/, ".js")
    );
    const outFileDir = path.dirname(outFile);

    fs.mkdirSync(outFileDir, { recursive: true });

    // Build with esbuild
    await build({
      entryPoints: [file],
      bundle: true,
      platform: "node",
      target: "node20",
      format: "cjs",
      outfile: outFile,
      sourcemap: false,
      minify: false
    });

    // ✅ Route name logic
    // Remove extension and convert slashes
    let routePath = relativePath.replace(/\.(ts|js)$/, "").replace(/\\/g, "/");

    // If it's index file, drop "index"
    if (routePath.endsWith("/index")) {
      routePath = routePath.slice(0, -6);
    }

    // Ensure leading slash, empty means root
    routePath = "/" + routePath.replace(/^\/+/, "");

    routes[routePath === "//" ? "/" : routePath] = {
      file: path.relative(outDir, outFile),
      runtime: "nodejs20.x",
      handler: "index.handler"
    };

    console.log(`✅ Built ${routePath} → ${path.relative(cwd, outFile)}`);
  }

  // Write routes manifest
  const manifestPath = path.join(outDir, "routes.json");
  fs.writeFileSync(manifestPath, JSON.stringify(routes, null, 2));

  console.log(`\n🗺️  Routes manifest created at dist/routes.json`);
  console.log(JSON.stringify(routes, null, 2));
}
