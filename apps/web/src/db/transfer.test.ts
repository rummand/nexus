import { beforeEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql, type SQL } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import { destinationIsEmpty, orderGaps, transfer, TRANSFER_ORDER, type TransferDb } from "./transfer";

/**
 * Moving a database between dialects (§5.45).
 *
 * The test that earns its place is the first one: a table added next year is invisible to a
 * transfer that does not name it, and the failure mode is silent — the move "succeeds" and an
 * organisation's change sets are simply gone. So the order is checked against the schema itself.
 *
 * The rest runs SQLite → SQLite, which exercises everything except the dialect coercion: order,
 * batching, the empty-destination refusal and the fact that ids survive.
 */

const adapter = (client: Client): TransferDb => {
  const db = drizzle(client);
  return {
    all: async (query: SQL) => (await db.all(query)) as Record<string, unknown>[],
    count: async (table: string) => Number(((await db.all(sql.raw(`select count(*) as n from "${table}"`))) as Array<{ n: number }>)[0]?.n ?? 0),
    insert: async (table: string, rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const cols = Object.keys(row);
        await client.execute({
          sql: `insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map(() => "?").join(", ")})`,
          args: cols.map((c) => (typeof row[c] === "boolean" ? (row[c] ? 1 : 0) : (row[c] as never))),
        });
      }
    },
  };
};

let sourceClient: Client;
let destClient: Client;
let source: TransferDb;
let dest: TransferDb;

const migrations = path.resolve(__dirname, "../../drizzle");

beforeEach(async () => {
  sourceClient = createClient({ url: ":memory:" });
  destClient = createClient({ url: ":memory:" });
  await migrate(drizzle(sourceClient), { migrationsFolder: migrations });
  await migrate(drizzle(destClient), { migrationsFolder: migrations });
  source = adapter(sourceClient);
  dest = adapter(destClient);

  const db = drizzle(sourceClient, { schema: s });
  await db.insert(s.users).values({ id: "u1", name: "Maria Lund", email: "maria@example.com" });
  await db.insert(s.workspaces).values({ id: "ws", slug: "acme", name: "Acme" });
  await db.insert(s.workspaceMembers).values({ workspaceId: "ws", userId: "u1", role: "owner" });
  await db.insert(s.entities).values([
    { id: "ent_1", workspaceId: "ws", kind: "Application", name: "Maximo" },
    { id: "ent_2", workspaceId: "ws", kind: "Application", name: "SAP" },
  ]);
  await db.insert(s.relations_).values({ id: "rel_1", workspaceId: "ws", fromEntityId: "ent_1", toEntityId: "ent_2", kind: "feeds" });
  await db.insert(s.entityEvents).values({ id: "evt_1", workspaceId: "ws", entityId: "ent_1", entityName: "Maximo", kind: "created" });
  await db.insert(s.modelProviders).values({ id: "mp_1", workspaceId: "ws", name: "Local", dialect: "openai", baseUrl: "http://x", keyEncrypted: true, enabled: false });
});

describe("the transfer order", () => {
  it("names every table in the schema, and no table that is not", () => {
    /*
     * The one that matters. A table added later and left out of the order is copied by nothing, the
     * move reports success, and the data is gone — a failure nobody notices until they look for it.
     */
    expect(orderGaps()).toEqual({ missing: [], unknown: [] });
  });

  it("puts parents before the rows that point at them", () => {
    const at = (t: string) => TRANSFER_ORDER.indexOf(t as never);
    expect(at("users")).toBeLessThan(at("sessions"));
    expect(at("workspaces")).toBeLessThan(at("entities"));
    expect(at("entities")).toBeLessThan(at("relations"));
    expect(at("boards")).toBeLessThan(at("board_entities"));
    expect(at("change_sets")).toBeLessThan(at("changes"));
    expect(at("plateaus")).toBeLessThan(at("plateau_change_sets"));
    expect(at("agent_definitions")).toBeLessThan(at("agent_runs"));
  });
});

describe("moving a database", () => {
  it("copies every row, keeping the ids", async () => {
    const report = await transfer(source, dest);
    expect(report.total).toBe(8);
    const out = drizzle(destClient, { schema: s });
    expect((await out.select().from(s.entities)).map((e) => e.id).sort()).toEqual(["ent_1", "ent_2"]);
    // Ids are text everywhere precisely so nothing has to be remapped: a relation still points at
    // the same two objects, and a board document naming an element still names it.
    const [rel] = await out.select().from(s.relations_);
    expect([rel?.fromEntityId, rel?.toEntityId]).toEqual(["ent_1", "ent_2"]);
  });

  it("survives a table with no rows in it", async () => {
    const report = await transfer(source, dest);
    expect(report.copied.find((c) => c.table === "plateaus")?.rows).toBe(0);
  });

  it("carries booleans across as booleans", async () => {
    await transfer(source, dest);
    const [provider] = await drizzle(destClient, { schema: s }).select().from(s.modelProviders);
    expect([provider?.keyEncrypted, provider?.enabled]).toEqual([true, false]);
  });

  it("refuses a destination that already holds something", async () => {
    await drizzle(destClient, { schema: s }).insert(s.workspaces).values({ id: "other", slug: "other", name: "Other" });
    const check = await destinationIsEmpty(dest);
    expect(check).toMatchObject({ empty: false, table: "workspaces", rows: 1 });
  });

  it("counts a freshly migrated database as empty", async () => {
    expect(await destinationIsEmpty(dest)).toEqual({ empty: true });
  });

  it("batches without losing or duplicating rows", async () => {
    const db = drizzle(sourceClient, { schema: s });
    await db.insert(s.entities).values(Array.from({ length: 250 }, (_, i) => ({ id: `bulk_${i}`, workspaceId: "ws", kind: "Application", name: `App ${i}` })));
    await transfer(source, dest, { batch: 7 });
    expect(await dest.count("entities")).toBe(252);
  });
});
