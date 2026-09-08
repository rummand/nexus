import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { getDefinition, insertDefinition, writeDefinition, type StoredDefinition } from "./definitions";

/**
 * A definition, written down and read back.
 *
 * This suite exists because of a specific failure: adding a schedule (§5.42) meant touching four
 * places — the type, the validator, the insert and the update — and three of them were done. The
 * validator's own test passed, the form offered the choice, saving said it had worked, and the
 * schedule was silently dropped on the way to the database. Only the browser suite noticed, three
 * runs later.
 *
 * So this is the round trip, on every field a person can set: whatever goes in comes back out. It
 * is dull, it is quick, and it is the test that would have caught it in seconds.
 */

let db: Db;

const stored: StoredDefinition = {
  name: "Night watch",
  purpose: "Look over the application estate and say what is wrong with it.",
  ownerTeamId: "t1",
  scope: "kind:Application",
  verbs: ["setKind", "setAttribute"],
  grounding: "modelling",
  providerId: null,
  model: "some-model",
  trigger: "daily",
  budget: { runsPerDay: 4, maxProposals: 9 },
  status: "active",
};

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.teams).values({ id: "t1", workspaceId: "ws", slug: "ea", name: "Enterprise Architecture", color: "#1376d4" });
});

describe("a definition survives the round trip", () => {
  it("keeps every field it was created with", async () => {
    const id = await insertDefinition(db, "ws", stored);
    const back = await getDefinition(db, id);
    expect(back).toMatchObject({
      name: stored.name,
      purpose: stored.purpose,
      ownerTeamId: "t1",
      scope: stored.scope,
      verbs: stored.verbs,
      grounding: "modelling",
      model: "some-model",
      trigger: "daily",
      budget: { runsPerDay: 4, maxProposals: 9 },
      status: "active",
    });
  });

  it("keeps every field it was edited to — including the schedule", async () => {
    const id = await insertDefinition(db, "ws", { ...stored, trigger: "manual" });
    await writeDefinition(db, id, { ...stored, name: "Renamed", trigger: "weekly", budget: { runsPerDay: 2, maxProposals: 3 } });

    const back = await getDefinition(db, id);
    // The one that was actually broken: the update wrote every other column and not this one.
    expect(back?.trigger).toBe("weekly");
    expect(back).toMatchObject({ name: "Renamed", budget: { runsPerDay: 2, maxProposals: 3 } });
  });

  it("reads a row written before schedules existed as manual", async () => {
    const id = await insertDefinition(db, "ws", stored);
    // Every definition in a database from before rev 77 has the column's default, and none of
    // them should suddenly start running by themselves.
    await db.update(s.agentDefinitions).set({ trigger: "" }).where(eq(s.agentDefinitions.id, id));
    expect((await getDefinition(db, id))?.trigger).toBe("manual");
  });

  it("reads an unrecognisable schedule as manual rather than failing", async () => {
    const id = await insertDefinition(db, "ws", stored);
    await db.update(s.agentDefinitions).set({ trigger: "every full moon" }).where(eq(s.agentDefinitions.id, id));
    // A row the scheduler cannot read must be inert, not a crash on the fleet page.
    expect((await getDefinition(db, id))?.trigger).toBe("manual");
  });
});
