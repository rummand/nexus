/**
 * Generate the Postgres schema from the SQLite one.
 *
 * The tables were written to be portable — text ids, ISO timestamps, JSON stored as text — so the
 * two dialects differ only in the imports, the table helper and the default for a timestamp.
 * Hand-maintaining a second copy of four hundred lines guarantees they drift, so the copy is
 * generated and a unit test fails if the committed file is stale.
 *
 *   node scripts/generate-pg-schema.mjs          # write src/db/schema.pg.ts
 *   node scripts/generate-pg-schema.mjs --check  # fail if it would change
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, "..", "src", "db", "schema.ts");
const target = path.join(here, "..", "src", "db", "schema.pg.ts");

const HEADER = `// Generated from schema.ts by scripts/generate-pg-schema.mjs — do not edit by hand.
// Run \`pnpm db:pg:schema\` after changing the SQLite schema.

`;

export function toPostgres(sqlite) {
  let out = sqlite;

  out = out.replace(
    'import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";',
    'import { pgTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";',
  );

  // The one genuinely dialect-specific thing: an ISO-8601 timestamp default.
  out = out.replace(
    `const timestamp = (name: string) =>
  text(name)
    .notNull()
    .default(sql\`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))\`);`,
    `const timestamp = (name: string) =>
  text(name)
    .notNull()
    .default(sql\`to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')\`);`,
  );

  out = out.replaceAll("sqliteTable(", "pgTable(");

  // SQLite has no boolean, so a flag is an integer in "boolean" mode. Postgres has one.
  out = out.replaceAll(/integer\((".*?"), \{ mode: "boolean" \}\)/g, "boolean($1)");
  if (out.includes("boolean(")) {
    out = out.replace(
      'import { pgTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";',
      'import { pgTable, text, integer, boolean, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";',
    );
  }
  out = out.replace(
    " * Written for SQLite in development; kept Postgres-portable (text ids, ISO timestamps,\n * JSON stored as text) so the SaaS target is a dialect switch, not a redesign.",
    " * The Postgres dialect, generated from the SQLite one. Same tables, same columns, same names.",
  );
  return HEADER + out;
}

const generated = toPostgres(readFileSync(source, "utf8"));

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(target, "utf8"); } catch { /* not generated yet */ }
  if (current !== generated) {
    console.error("src/db/schema.pg.ts is stale. Run: pnpm db:pg:schema");
    process.exit(1);
  }
  console.log("schema.pg.ts is up to date");
} else {
  writeFileSync(target, generated);
  console.log(`wrote ${path.relative(process.cwd(), target)}`);
}
