/**
 * Move a Nexus database from one dialect to the other (§5.45).
 *
 *   pnpm db:transfer --from file:./data/nexus.db --to postgres://user:pass@host/nexus
 *
 * Both directions work; the one people need is SQLite → Postgres, when a pilot outgrows a file on
 * a volume. The destination has its migrations applied first and must be empty — see `transfer.ts`
 * for why merging is deliberately not attempted.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { sql, type SQL } from "drizzle-orm";
import path from "node:path";
import { destinationIsEmpty, transfer, type TransferDb } from "./transfer";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const isPg = (url: string) => /^postgres(ql)?:\/\//.test(url);

/** Postgres: coercion is driven by the column types the server reports, not by a list here. */
async function pgTarget(url: string): Promise<TransferDb & { close: () => Promise<void> }> {
  const pool = new Pool({ connectionString: url, ...(/sslmode=disable/.test(url) ? {} : { ssl: { rejectUnauthorized: false } }) });
  const db = drizzlePg(pool);
  await migratePg(db, { migrationsFolder: path.resolve("drizzle-pg") });

  const typesFor = new Map<string, Map<string, string>>();
  const columnTypes = async (table: string) => {
    const cached = typesFor.get(table);
    if (cached) return cached;
    const rows = await pool.query<{ column_name: string; data_type: string }>(
      "select column_name, data_type from information_schema.columns where table_name = $1",
      [table],
    );
    const map = new Map(rows.rows.map((r) => [r.column_name, r.data_type]));
    typesFor.set(table, map);
    return map;
  };

  return {
    async all(query: SQL) {
      return (await db.execute(query)).rows as Record<string, unknown>[];
    },
    async count(table: string) {
      const r = await pool.query<{ n: string }>(`select count(*)::text as n from "${table}"`);
      return Number(r.rows[0]?.n ?? 0);
    },
    async insert(table: string, rows: Record<string, unknown>[]) {
      if (!rows.length) return;
      const types = await columnTypes(table);
      const cols = Object.keys(rows[0]!).filter((c) => types.has(c));
      const values: unknown[] = [];
      const tuples = rows.map((row, r) =>
        `(${cols.map((c, i) => {
          // SQLite has no boolean: it stores 0 and 1, which Postgres refuses in a boolean column.
          const raw = row[c];
          values.push(types.get(c) === "boolean" ? raw === 1 || raw === "1" || raw === true : raw);
          return `$${r * cols.length + i + 1}`;
        }).join(", ")})`,
      );
      await pool.query(`insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values ${tuples.join(", ")}`, values);
    },
    close: () => pool.end(),
  };
}

async function sqliteTarget(url: string): Promise<TransferDb & { close: () => Promise<void> }> {
  const client = createClient({ url });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });
  return {
    async all(query: SQL) {
      return (await db.all(query)) as Record<string, unknown>[];
    },
    async count(table: string) {
      const rows = (await db.all(sql.raw(`select count(*) as n from "${table}"`))) as Array<{ n: number }>;
      return Number(rows[0]?.n ?? 0);
    },
    async insert(table: string, rows: Record<string, unknown>[]) {
      if (!rows.length) return;
      const cols = Object.keys(rows[0]!);
      for (const row of rows) {
        // libsql binds numbers, strings, null and buffers; a boolean from Postgres is neither.
        const values = cols.map((c) => (typeof row[c] === "boolean" ? (row[c] ? 1 : 0) : (row[c] as never)));
        await client.execute({
          sql: `insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map(() => "?").join(", ")})`,
          args: values,
        });
      }
    },
    close: async () => client.close(),
  };
}

const open = (url: string) => (isPg(url) ? pgTarget(url) : sqliteTarget(url));

const from = arg("from");
const to = arg("to");
if (!from || !to) {
  console.error("usage: pnpm db:transfer --from <url> --to <url>\n  urls are file:./data/nexus.db or postgres://…");
  process.exit(1);
}
if (from === to) {
  console.error("the source and the destination are the same database");
  process.exit(1);
}

const source = await open(from);
const dest = await open(to);
try {
  const empty = await destinationIsEmpty(dest);
  if (!empty.empty) {
    console.error(`the destination is not empty — "${empty.table}" already holds ${empty.rows} row(s).`);
    console.error("Refusing to merge two databases: which of two objects with the same name wins is a question this script cannot answer.");
    process.exit(1);
  }
  console.log(`${from}\n  → ${to}\n`);
  const report = await transfer(source, dest, {
    onTable: (table, rows) => {
      if (rows) console.log(`  ${table.padEnd(26)} ${rows}`);
    },
  });
  console.log(`\n${report.total} rows in ${report.copied.filter((c) => c.rows).length} tables.`);
  if (isPg(to)) console.log("Point DATABASE_URL at the new database and restart.");
} finally {
  await source.close();
  await dest.close();
}
