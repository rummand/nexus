import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { count, eq } from "drizzle-orm";
import path from "node:path";
import * as s from "./schema";
import type { Db } from "./client";
import { DEMO_WORKSPACE_SLUG, backfillDemoRoadmap, seed, seedIfEmpty } from "./seed";

/**
 * The backfill exists for one situation: an instance that was seeded before change sets existed,
 * where the Roadmap is permanently empty because the seed only runs on an empty database. These
 * tests reproduce that instance and then check the two things that matter — that it gets its
 * roadmap, and that it never gets a second one.
 */

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
});

const changeSetCount = async () => (await db.select({ n: count() }).from(s.changeSets))[0]?.n ?? 0;
const plateauCount = async () => (await db.select({ n: count() }).from(s.plateaus))[0]?.n ?? 0;

/** An instance from before the feature: fully seeded, then its roadmap removed. */
async function anOlderInstance() {
  await seed(db);
  await db.delete(s.plateaus);
  await db.delete(s.changeSets);
}

describe("the demo roadmap backfill", () => {
  it("gives an older instance the roadmap it never got", async () => {
    await anOlderInstance();
    expect(await changeSetCount()).toBe(0);

    await backfillDemoRoadmap(db);

    expect(await changeSetCount()).toBe(2);
    expect(await plateauCount()).toBe(2);
    // and the plans point at systems that are really in this workspace
    const retire = await db.query.changes.findFirst({ where: eq(s.changes.id, "chn_seed_2") });
    const target = await db.query.entities.findFirst({ where: eq(s.entities.id, retire!.entityId!) });
    expect(target?.name).toBe("Maximo");
  });

  it("runs on boot without doing it twice", async () => {
    await anOlderInstance();
    await seedIfEmpty(db);
    await seedIfEmpty(db);
    await seedIfEmpty(db);
    expect(await changeSetCount()).toBe(2);
    expect(await plateauCount()).toBe(2);
  });

  it("leaves a workspace that has done its own planning alone", async () => {
    await anOlderInstance();
    const workspace = await db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, DEMO_WORKSPACE_SLUG) });
    await db.insert(s.changeSets).values({ id: "chg_theirs", workspaceId: workspace!.id, name: "Ours, not yours", status: "planned", targetDate: "2027-01-01" });

    await backfillDemoRoadmap(db);

    // one change set, and it is theirs: fixtures must not turn up beside somebody's real plan
    const all = await db.select().from(s.changeSets);
    expect(all.map((c) => c.id)).toEqual(["chg_theirs"]);
  });

  it("does nothing to a workspace that is not the demo", async () => {
    await db.insert(s.workspaces).values({ id: "ws_real", slug: "energinet", name: "Real" });
    await backfillDemoRoadmap(db);
    expect(await changeSetCount()).toBe(0);
  });

  it("is a no-op on a fresh install, which already has them", async () => {
    await seedIfEmpty(db);
    expect(await changeSetCount()).toBe(2);
    await seedIfEmpty(db);
    expect(await changeSetCount()).toBe(2);
  });
});
