import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Postgres schema is generated from the SQLite one (scripts/generate-pg-schema.mjs), so the
 * two can only disagree if somebody edits schema.ts and forgets to regenerate. This test is the
 * thing that notices — otherwise the drift shows up as a missing column in production.
 */
describe("generated Postgres schema", () => {
  it("matches src/db/schema.ts", () => {
    const root = path.resolve(__dirname, "../..");
    expect(() =>
      execFileSync(process.execPath, [path.join(root, "scripts/generate-pg-schema.mjs"), "--check"], { cwd: root, stdio: "pipe" }),
    ).not.toThrow();
  });
});
