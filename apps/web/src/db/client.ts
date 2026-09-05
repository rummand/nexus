import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import * as pgSchema from "./schema.pg";
import { sql } from "drizzle-orm";

/**
 * Database client, one dialect or the other.
 *
 * SQLite (libsql) for local development — zero setup, a file you can delete. Postgres when
 * DATABASE_URL says so, which is what a deployment with more than one reader needs: SQLite on a
 * single volume means one instance, no concurrent writers and no backups worth the name.
 *
 * The two schemas are the same tables: src/db/schema.pg.ts is generated from schema.ts by
 * scripts/generate-pg-schema.mjs, and a unit test fails if the copy is stale. Application code
 * imports the SQLite schema and the types agree, because the columns do.
 *
 * Migrations are applied lazily on first use so `pnpm dev` works with no setup. The seed
 * (src/db/seed.ts) runs once when the database is empty.
 */

const DEFAULT_URL = "file:./data/nexus.db";

function resolveUrl(): string {
  const url = process.env.DATABASE_URL ?? DEFAULT_URL;
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    // turbopackIgnore: the path comes from configuration, not from the bundle.
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(/* turbopackIgnore: true */ process.cwd(), filePath);
    fs.mkdirSync(/* turbopackIgnore: true */ path.dirname(abs), { recursive: true });
    return `file:${abs}`;
  }
  return url;
}

/** Which driver the connection string asks for. */
export function dialect(): "postgres" | "sqlite" {
  const url = process.env.DATABASE_URL ?? DEFAULT_URL;
  return /^postgres(ql)?:\/\//.test(url) ? "postgres" : "sqlite";
}

export type Db = ReturnType<typeof createDb>;

function createDb() {
  if (dialect() === "postgres") {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // A managed Postgres usually terminates a long-idle connection; keep the pool honest.
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      ...(process.env.DATABASE_SSL === "false" ? {} : /sslmode=disable/.test(process.env.DATABASE_URL ?? "") ? {} : { ssl: { rejectUnauthorized: false } }),
    });
    // The cast keeps one Db type across both dialects: the tables are the same, so the queries
    // application code writes are the same.
    return drizzlePg(pool, { schema: pgSchema }) as unknown as ReturnType<typeof drizzleSqlite>;
  }
  return drizzleSqlite();
}

function drizzleSqlite() {
  const client = createClient({ url: resolveUrl() });
  return drizzle(client, { schema });
}

/** SQLite pragmas for a multi-request server: WAL for concurrent readers, wait on locks. */
async function tuneSqlite(instance: Db) {
  const url = process.env.DATABASE_URL ?? DEFAULT_URL;
  if (!url.startsWith("file:")) return;
  await instance.run(sql`PRAGMA journal_mode = WAL`);
  await instance.run(sql`PRAGMA busy_timeout = 5000`);
}

const globalForDb = globalThis as unknown as { __nexusDb?: Db; __nexusReady?: Promise<Db> };

export const db: Db = globalForDb.__nexusDb ?? (globalForDb.__nexusDb = createDb());

/** Returns the db after migrations + seed have completed. Idempotent, cached per process. */
export function getDb(): Promise<Db> {
  if (!globalForDb.__nexusReady) {
    globalForDb.__nexusReady = (async () => {
      if (dialect() === "postgres") {
        await migratePg(db as never, { migrationsFolder: path.join(process.cwd(), "drizzle-pg") });
      } else {
        await tuneSqlite(db);
        await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
      }
      const { seedIfEmpty } = await import("./seed");
      await seedIfEmpty(db);
      return db;
    })();
  }
  return globalForDb.__nexusReady;
}
