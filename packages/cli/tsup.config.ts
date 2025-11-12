import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/**/*.{js,ts}", "!src/static/**/*"],
  dts: true,
  watch: options.watch,
  tsconfig: "./tsconfig.json",
  treeshake: true,
  format: "esm",
  target: "node20",
  env: {
    API_URL: "http://localhost:4000"
  },
  clean: true,
  minify: false,
  sourcemap: false,
  bundle: true,
  esbuildOptions(options) {
    options.outbase = "src";
  },
  keepNames: true,
  noExternal: [/^@fnly\//],
  ignoreWatch: ["**/*.d.ts", "node_modules", "dist"]
}));
