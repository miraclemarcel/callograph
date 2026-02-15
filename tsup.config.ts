import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    dts: true,
    clean: true,
    target: "node20",
    platform: "node",
    sourcemap: false,
    minify: true,
    external: ["typescript"],
  },
  {
    entry: ["src/cli.ts"],
    format: ["cjs"],
    target: "node20",
    platform: "node",
    sourcemap: false,
    minify: true,
    external: ["typescript"],
  }
]);
