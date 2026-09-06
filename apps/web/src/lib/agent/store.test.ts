import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import type { Proposal } from "../graph-types";
import { computeProposals, recordDecision } from "../proposals";
import { agentGraph, lastRun, saveRun, storedProposals } from "./store";
import type { AgentRun } from "./propose";

/**
 * What happens to the agent's answer between the model returning it and somebody deciding.
 *
 * The rules can be recomputed on every request; a model's answer cannot, so it is written down —
 * and everything that makes that safe is here: one current run per workspace, a decision that
 * removes the row, and an action re-checked on the way back out in case the row outlived the code
 * that wrote it.
 */

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "acme", name: "Acme" });
});

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  key: "untyped:ent_c",
  type: "untyped",
  confidence: "medium",
  title: "“PI Server” has no kind",
  detail: "It is a running system.",
  entityIds: ["ent_c"],
  action: { kind: "setKind", entityId: "ent_c", to: "Application" },
  evidence: ["“the process historian” — read from untyped · PI Server"],
  source: "agent",
  ...over,
});

const run = (proposals: Proposal[]): AgentRun => ({
  proposals,
  rejected: [],
  note: "",
  grounded: ["An application is a deployable system, not a department."],
  sampled: false,
});

const entity = (id: string, name: string, kind = "Application") =>
  db.insert(s.entities).values({ id, workspaceId: "ws", kind, name, description: "", attributes: "{}", source: "canvas" });

describe("keeping a run", () => {
  it("writes it down and reads it back whole", async () => {
    await saveRun(db, "ws", run([proposal()]));
    const [back] = await storedProposals(db, "ws", new Set());
    expect(back).toMatchObject({
      key: "untyped:ent_c",
      source: "agent",
      action: { kind: "setKind", entityId: "ent_c", to: "Application" },
      grounded: ["An application is a deployable system, not a department."],
    });
    expect(back!.evidence).toHaveLength(1);
    expect((await lastRun(db, "ws"))?.grounded).toHaveLength(1);
  });

  it("keeps one current opinion rather than a pile of them", async () => {
    await saveRun(db, "ws", run([proposal(), proposal({ key: "untyped:ent_d" })]));
    await saveRun(db, "ws", run([proposal({ key: "untyped:ent_e" })]));
    expect((await storedProposals(db, "ws", new Set())).map((p) => p.key)).toEqual(["untyped:ent_e"]);
  });

  it("hides what somebody has already decided", async () => {
    await saveRun(db, "ws", run([proposal()]));
    expect(await storedProposals(db, "ws", new Set(["untyped:ent_c"]))).toEqual([]);
  });

  it("forgets the row once a decision is recorded, and the decision outlives it", async () => {
    await saveRun(db, "ws", run([proposal()]));
    await recordDecision(db, "ws", "untyped:ent_c", "dismissed");
    expect(await db.select().from(s.agentProposals).where(eq(s.agentProposals.workspaceId, "ws"))).toEqual([]);
    // …and a later run offering it again is filtered by the remembered decision, not by luck
    const decisions = await db.select().from(s.agentDecisions);
    expect(decisions.map((d) => d.key)).toEqual(["untyped:ent_c"]);
  });

  it("drops a stored action that is not one of the five, rather than trusting the row", async () => {
    await saveRun(db, "ws", run([proposal()]));
    await db.update(s.agentProposals).set({ action: JSON.stringify({ kind: "deleteEntity", entityId: "ent_c" }) });
    expect(await storedProposals(db, "ws", new Set())).toEqual([]);

    await db.update(s.agentProposals).set({ action: "not json at all" });
    expect(await storedProposals(db, "ws", new Set())).toEqual([]);
  });
});

describe("in the review queue beside the rules", () => {
  it("replaces a rule that had noticed the same thing but could not say why", async () => {
    // the rules already raise "this object has no kind"; they cannot say what it should be
    await entity("ent_c", "PI Server", "");
    const rulesOnly = await computeProposals(db, "ws");
    expect(rulesOnly.find((p) => p.key === "untyped:ent_c")?.evidence).toBeUndefined();

    await saveRun(db, "ws", run([proposal()]));
    const all = await computeProposals(db, "ws");
    const card = all.filter((p) => p.key === "untyped:ent_c");
    expect(card).toHaveLength(1);
    expect(card[0]).toMatchObject({ source: "agent" });
    expect(card[0]!.evidence?.[0]).toMatch(/process historian/);
  });

  it("loses a collision to the rules, so nothing is offered twice", async () => {
    // two objects with one name: the merge rule finds this on its own
    await entity("ent_1", "Maximo");
    await entity("ent_2", "Maximo");
    const key = "merge:ent_1,ent_2";
    await saveRun(db, "ws", run([proposal({ key, type: "merge", action: { kind: "merge", survivorId: "ent_1", otherIds: ["ent_2"] } })]));

    const all = await computeProposals(db, "ws");
    const merges = all.filter((p) => p.key === key);
    expect(merges).toHaveLength(1);
    expect(merges[0]!.source).not.toBe("agent"); // the deterministic one wins
  });
});

describe("the graph the agent is shown", () => {
  it("is the rows with their attributes already parsed", async () => {
    await db.insert(s.entities).values({ id: "ent_a", workspaceId: "ws", kind: "Application", name: "Maximo", description: "Work orders.", attributes: JSON.stringify({ owner: "Asset Management" }), source: "canvas" });
    await db.insert(s.entities).values({ id: "ent_b", workspaceId: "ws", kind: "Application", name: "SCADA", description: "", attributes: "broken json", source: "canvas" });
    await db.insert(s.relations_).values({ id: "rel_1", workspaceId: "ws", fromEntityId: "ent_a", toEntityId: "ent_b", kind: "feeds", attributes: "{}", source: "canvas" });

    const graph = await agentGraph(db, "ws");
    expect(graph.entities.find((e) => e.id === "ent_a")?.attributes).toEqual({ owner: "Asset Management" });
    expect(graph.entities.find((e) => e.id === "ent_b")?.attributes).toEqual({});
    expect(graph.relations).toEqual([{ id: "rel_1", fromEntityId: "ent_a", toEntityId: "ent_b", kind: "feeds" }]);
  });
});
