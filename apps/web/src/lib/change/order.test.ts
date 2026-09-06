import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { allBlockers, blocking, deliveryOrder, scheduleWarnings, wouldCycle, type Dependency } from "./order";
import { contextOf, project, projectAll } from "./project";
import type { Change, ChangeSet, ChangeSetStatus } from "./types";

const set = (id: string, targetDate: string, status: ChangeSetStatus = "planned", changes: Change[] = []): ChangeSet => ({
  id, workspaceId: "ws", name: id.toUpperCase(), description: "", status, targetDate,
  deliveredAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", changes,
});

const dep = (changeSetId: string, dependsOnId: string): Dependency => ({ changeSetId, dependsOnId });

const change = (id: string, op: Change["op"], fields: Partial<Change> = {}): Change =>
  ({ id, op, entityId: null, relationId: null, payload: {}, note: "", createdAt: "2026-01-01", ...fields });

const entity = (id: string, name: string): s.Entity =>
  ({ id, workspaceId: "ws", kind: "Application", name, description: "", attributes: "{}", source: "canvas", createdAt: "", updatedAt: "" }) as s.Entity;

describe("sequencing change sets", () => {
  it("follows a chain of blockers all the way", () => {
    const deps = [dep("c", "b"), dep("b", "a")];
    expect(allBlockers("c", deps)).toEqual(["b", "a"]);
    expect(allBlockers("a", deps)).toEqual([]);
  });

  it("refuses an edge that would make a loop", () => {
    const deps = [dep("b", "a")];
    expect(wouldCycle(deps, "a", "b")).toBe(true); // a would wait for b, which waits for a
    expect(wouldCycle(deps, "a", "a")).toBe(true);
    expect(wouldCycle(deps, "c", "a")).toBe(false);
    expect(wouldCycle([dep("c", "b"), dep("b", "a")], "a", "c")).toBe(true); // through a third
  });

  it("delivers blockers first, and orders by date within that", () => {
    const sets = [set("late", "2026-01-01"), set("first", "2027-01-01"), set("other", "2026-06-01")];
    // "late" is dated first but waits for "first"
    expect(deliveryOrder(sets, [dep("late", "first")])).toEqual(["other", "first", "late"]);
  });

  it("still emits everything if the data somehow holds a cycle", () => {
    const sets = [set("a", "2026-01-01"), set("b", "2026-02-01")];
    expect(deliveryOrder(sets, [dep("a", "b"), dep("b", "a")]).sort()).toEqual(["a", "b"]);
  });

  it("ignores a blocker outside the list rather than stalling on it", () => {
    expect(deliveryOrder([set("a", "2026-01-01")], [dep("a", "ghost")])).toEqual(["a"]);
  });
});

describe("what is still in the way", () => {
  const sets = [set("a", "2026-01-01"), set("b", "2026-06-01"), set("c", "2027-01-01")];
  const deps = [dep("c", "b"), dep("b", "a")];

  it("names every outstanding blocker, transitively", () => {
    expect(blocking("c", sets, deps).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("stops counting a blocker once it is delivered", () => {
    const delivered = [set("a", "2026-01-01", "delivered"), sets[1]!, sets[2]!];
    expect(blocking("c", delivered, deps).map((x) => x.id)).toEqual(["b"]);
    expect(blocking("b", delivered, deps)).toEqual([]);
  });

  it("does not treat an abandoned blocker as satisfied", () => {
    const abandoned = [set("a", "2026-01-01", "abandoned"), sets[1]!, sets[2]!];
    // a plan waiting on something that is not going to happen is stranded, and saying so is the
    // whole point — quietly letting it through would hide the decision somebody has to make
    expect(blocking("b", abandoned, deps)).toEqual([{ id: "a", name: "A", status: "abandoned", reason: "abandoned" }]);
  });
});

describe("dates against sequence", () => {
  it("points out a plan dated before something it waits for", () => {
    const sets = [set("platform", "2027-01-01"), set("streaming", "2026-06-01")];
    const warnings = scheduleWarnings(sets, [dep("streaming", "platform")]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toMatch(/Dated 2026-06-01, but waits for “PLATFORM” which is dated 2027-01-01/);
  });

  it("says nothing when the dates already agree with the sequence", () => {
    const sets = [set("platform", "2026-06-01"), set("streaming", "2027-01-01")];
    expect(scheduleWarnings(sets, [dep("streaming", "platform")])).toEqual([]);
  });

  it("says nothing about a blocker that has already been delivered", () => {
    const sets = [set("platform", "2027-01-01", "delivered"), set("streaming", "2026-06-01")];
    expect(scheduleWarnings(sets, [dep("streaming", "platform")])).toEqual([]);
  });
});

describe("projecting a plan in the context of what it waits for", () => {
  const estate = [entity("old", "Historian")];
  const platform = set("platform", "2027-01-01", "planned", [
    change("p1", "addEntity", { entityId: "new_lake", payload: { kind: "IT Component", name: "Lake" } }),
  ]);
  const streaming = set("streaming", "2027-06-01", "planned", [
    change("s1", "addRelation", { relationId: "nr1", payload: { fromEntityId: "old", toEntityId: "new_lake", kind: "telemetry" } }),
  ]);

  it("reads as broken on its own", () => {
    const alone = project(estate, [], streaming.changes);
    expect(alone.problems).toHaveLength(1);
  });

  it("reads as merely sequenced once its blocker is taken into account", () => {
    const context = contextOf(estate, [], platform.changes);
    const projection = project(context.entities, context.relations, streaming.changes);
    expect(projection.problems, "a plan that waits for another is not stale").toEqual([]);
    expect(projection.addedRelations.has("nr1")).toBe(true);
  });

  it("applies plans in delivery order, not date order, when one waits for another", () => {
    // dates put streaming first; the dependency says otherwise, and the dependency wins
    const early = { ...streaming, targetDate: "2026-01-01" };
    const all = projectAll(estate, [], [early, platform], [dep("streaming", "platform")]);
    expect(all.problems).toEqual([]);
    expect(all.relations.map((r) => r.id)).toEqual(["nr1"]);
  });
});
