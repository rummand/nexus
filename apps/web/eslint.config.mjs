import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // .next-e2e is the isolated e2e run's build directory (see e2e/run.mjs).
  globalIgnores([".next/**", ".next-e2e/**", "out/**", "next-env.d.ts", "drizzle/**"]),
]);
