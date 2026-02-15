import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    target: "es2020",
    splitting: false,
    sourcemap: true,
    external: ["typescript"],
  },
  {
    entry: ["src/cli.ts"],
    format: ["cjs"],
    platform: "node",
    target: "node20",
    splitting: false,
    sourcemap: true,
  }
]);
