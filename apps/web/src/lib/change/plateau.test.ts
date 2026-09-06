import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { healthReport } from "@/lib/health";
import { diffStates, plateauState } from "./plateau";
import type { Dependency } from "./order";
import type { Change, ChangeSet, ChangeSetStatus } from "./types";

const entity = (id: string, name: string, kind = "Application", attributes: Record<string, string> = {}): s.Entity =>
  ({ id, workspaceId: "ws", kind, name, description: "", attributes: JSON.stringify(attributes), source: "canvas", createdAt: "", updatedAt: "" }) as s.Entity;

const relation = (id: string, from: string, to: string, kind = ""): s.Relation =>
  ({ id, workspaceId: "ws", fromEntityId: from, toEntityId: to, kind, attributes: "{}", source: "canvas", createdAt: "", updatedAt: "" }) as s.Relation;

const change = (id: string, op: Change["op"], fields: Partial<Change> = {}): Change =>
  ({ id, op, entityId: null, relationId: null, payload: {}, note: "", createdAt: "", ...fields });

const set = (id: string, changes: Change[], status: ChangeSetStatus = "planned", targetDate = "2027-01-01"): ChangeSet => ({
  id, workspaceId: "ws", name: id, description: "", status, targetDate, deliveredAt: null, createdAt: "", updatedAt: "", changes,
});

const dep = (changeSetId: string, dependsOnId: string): Dependency => ({ changeSetId, dependsOnId });

const ESTATE = [entity("maximo", "Maximo", "Application", { owner: "Assets" }), entity("lake", "Data Lake", "IT Component"), entity("scada", "SCADA")];
const WIRES = [relation("r1", "maximo", "lake", "work orders"), relation("r2", "scada", "lake", "telemetry")];

const PLATFORM = set("platform", [
  change("c1", "addEntity", { entityId: "sap", payload: { kind: "Application", name: "SAP PM" } }),
  change("c2", "retireEntity", { entityId: "maximo" }),
  change("c3", "addRelation", { relationId: "nr1", payload: { fromEntityId: "sap", toEntityId: "lake", kind: "work orders" } }),
]);
const STREAMING = set("streaming", [
  change("c4", "setAttribute", { entityId: "lake", payload: { key: "ingest", value: "streaming" } }),
]);

describe("a plateau is a state of the estate", () => {
  it("is the graph plus the change sets it includes", () => {
    const state = plateauState(ESTATE, WIRES, [PLATFORM, STREAMING], [], ["platform"]);
    expect(state.entities.map((e) => e.name).sort()).toEqual(["Data Lake", "SAP PM", "SCADA"]);
    expect(state.relations.map((r) => r.id).sort()).toEqual(["nr1", "r2"]);
  });

  it("is the estate as it is when it includes nothing", () => {
    const state = plateauState(ESTATE, WIRES, [PLATFORM], [], []);
    expect(state.entities).toHaveLength(3);
    expect(state.relations).toHaveLength(2);
  });

  it("applies its members in delivery order, not the order they were added", () => {
    const deps = [dep("streaming", "platform")];
    const state = plateauState(ESTATE, WIRES, [PLATFORM, STREAMING], deps, ["streaming", "platform"]);
    expect(state.order).toEqual(["platform", "streaming"]);
    expect(state.problems).toEqual([]);
  });

  it("says so when it includes a plan but not what that plan waits for", () => {
    const deps = [dep("streaming", "platform")];
    const state = plateauState(ESTATE, WIRES, [PLATFORM, STREAMING], deps, ["streaming"]);
    expect(state.incoherent).toEqual([{ changeSetId: "streaming", missing: ["platform"] }]);
  });

  it("does not complain about a blocker that has already been delivered", () => {
    const delivered = { ...PLATFORM, status: "delivered" as const };
    const state = plateauState(ESTATE, WIRES, [delivered, STREAMING], [dep("streaming", "platform")], ["streaming"]);
    expect(state.incoherent).toEqual([]);
  });
});

describe("the difference between two states", () => {
  const today = { entities: ESTATE, relations: WIRES };
  const target = plateauState(ESTATE, WIRES, [PLATFORM, STREAMING], [], ["platform", "streaming"]);

  it("says what arrives, what goes and what is rewired", () => {
    const diff = diffStates(today, target);
    expect(diff.added.map((e) => e.name)).toEqual(["SAP PM"]);
    expect(diff.removed.map((e) => e.name)).toEqual(["Maximo"]);
    expect(diff.relationsAdded.map((r) => r.id)).toEqual(["nr1"]);
    expect(diff.relationsRemoved.map((r) => r.id)).toEqual(["r1"]);
    expect(diff.summary).toMatch(/1 arrives, 1 goes/);
  });

  it("reports an attribute that moves as a change, with both values", () => {
    const diff = diffStates(today, target);
    expect(diff.attributes).toContainEqual(expect.objectContaining({ key: "ingest", before: "", after: "streaming" }));
  });

  it("treats a rename as a change to the thing, not a death and a birth", () => {
    const renamed = plateauState(ESTATE, WIRES, [set("rename", [change("r", "addEntity", { entityId: "maximo", payload: { kind: "Application", name: "Maximo" } })])], [], ["rename"]);
    const diff = diffStates(today, { ...renamed, entities: renamed.entities.map((e) => (e.id === "maximo" ? { ...e, name: "Maximo (EAM)" } : e)) });
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.renamed.map((r) => r.after.name)).toEqual(["Maximo (EAM)"]);
  });

  it("says plainly when two states are the same", () => {
    expect(diffStates(today, today).summary).toMatch(/Nothing changes/);
  });
});

describe("measuring a plateau", () => {
  it("scores health at a future state the same way it scores today", () => {
    // the point of this: a roadmap can claim a number, not just a shape
    const orphaned = [entity("a", "A"), entity("b", "B")];
    const today = healthReport(orphaned, []);
    const connected = plateauState(orphaned, [], [set("wire", [change("w", "addRelation", { relationId: "nr", payload: { fromEntityId: "a", toEntityId: "b", kind: "depends on" } })])], [], ["wire"]);
    const later = healthReport(connected.entities, connected.relations);
    expect(later.score).toBeGreaterThan(today.score);
  });
});
