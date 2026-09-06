import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      /**
       * `server-only` is a build-time guard: importing it from a client bundle is meant to fail.
       * Vitest is neither bundle, so it resolves the client entry and throws. Point it at an
       * empty module — the guard still does its job where it matters, in the Next build.
       */
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
});
