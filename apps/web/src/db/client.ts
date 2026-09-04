import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

/**
 * Database client. SQLite (libsql) for local development; the connection string comes
 * from DATABASE_URL so the SaaS deployment can point elsewhere.
 *
 * Migrations in ./drizzle are applied lazily on first use so `pnpm dev` works with no
 * setup. The seed (src/db/seed.ts) runs once when the database is empty.
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

export type Db = ReturnType<typeof createDb>;

function createDb() {
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
      await tuneSqlite(db);
      await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
      const { seedIfEmpty } = await import("./seed");
      await seedIfEmpty(db);
      return db;
    })();
  }
  return globalForDb.__nexusReady;
}
