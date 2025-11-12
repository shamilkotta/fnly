import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/**/*.{js,ts}"],
  dts: true,
  watch: options.watch,
  tsconfig: "./tsconfig.json",
  treeshake: true,
  format: "esm",
  clean: true,
  minify: false,
  sourcemap: false,
  esbuildOptions(options) {
    options.outbase = "src";
  },
  ignoreWatch: ["**/*.d.ts", "node_modules", "dist"]
}));
