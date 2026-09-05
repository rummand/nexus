import type { Config } from "drizzle-kit";

/** Postgres migrations, generated from the generated schema. See scripts/generate-pg-schema.mjs. */
export default {
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle-pg",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://nexus:nexus@127.0.0.1:5432/nexus" },
} satisfies Config;
