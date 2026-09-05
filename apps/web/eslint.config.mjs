import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // .next-* are build directories: .next-e2e (e2e/run.mjs) and any dialect-specific trial build.
  globalIgnores([".next/**", ".next-*/**", "out/**", "next-env.d.ts", "drizzle/**"]),
]);
