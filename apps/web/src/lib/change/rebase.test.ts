import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { progressWords, rebaseOnto } from "./rebase";
import type { Change } from "./types";

/**
 * Replaying a plan onto today's estate (#140, §5.94). Every case is a way reality moves under a
 * target architecture while nobody is looking — which is the chronic failure the whole idea of
 * putting plans on branches is meant to catch.
 */

const entity = (id: string, name: string, kind = "Application", attributes: Record<string, string> = {}, parentId: string | null = null): s.Entity =>
  ({ id, workspaceId: "ws", kind, name, description: "", attributes: JSON.stringify(attributes), parentId, source: "canvas", createdAt: "", updatedAt: "" }) as s.Entity;

const relation = (id: string, from: string, to: string, kind = "depends on"): s.Relation =>
  ({ id, workspaceId: "ws", fromEntityId: from, toEntityId: to, kind, attributes: "{}", source: "canvas", createdAt: "", updatedAt: "" }) as s.Relation;

const change = (id: string, op: Change["op"], fields: Partial<Change> = {}): Change =>
  ({ id, op, entityId: null, relationId: null, payload: {}, note: "", createdAt: "", ...fields });

describe("what the plan still has to do", () => {
  it("leaves an introduction outstanding while the object does not exist", () => {
    const r = rebaseOnto([change("c1", "addEntity", { entityId: "new1", payload: { name: "Asset Hub", kind: "Application" } })], [], []);
    expect(r.replayed[0]!.verdict).toBe("outstanding");
    expect(r.outstanding).toBe(1);
  });

  it("leaves a retirement outstanding while the system is live", () => {
    const r = rebaseOnto([change("c1", "retireEntity", { entityId: "a" })], [entity("a", "Maximo")], []);
    expect(r.replayed[0]!.verdict).toBe("outstanding");
    expect(r.replayed[0]!.why).toContain("still live");
  });
});

describe("what reality has already done", () => {
  it("counts a system decommissioned without waiting for the plan", () => {
    const r = rebaseOnto([change("c1", "retireEntity", { entityId: "a" })], [entity("a", "Maximo", "Application", { lifecycle: "retired" })], []);
    expect(r.replayed[0]!.verdict).toBe("landed");
    expect(r.replayed[0]!.why).toContain("retired without waiting for this plan");
  });

  it("counts a system that has simply gone as landed, not as a conflict", () => {
    const r = rebaseOnto([change("c1", "retireEntity", { entityId: "a" })], [], []);
    expect(r.replayed[0]!.verdict).toBe("landed");
  });

  it("counts an attribute somebody already set to what the plan wanted", () => {
    const r = rebaseOnto(
      [change("c1", "setAttribute", { entityId: "a", payload: { key: "owner", value: "Grid Operations" } })],
      [entity("a", "Maximo", "Application", { owner: "grid operations" })],
      [],
    );
    expect(r.replayed[0]!.verdict).toBe("landed");
  });

  it("counts an object the plan introduced that now exists", () => {
    const r = rebaseOnto(
      [change("c1", "addEntity", { entityId: "new1", payload: { name: "Asset Hub" } })],
      [entity("new1", "Asset Hub")],
      [],
    );
    expect(r.replayed[0]!.verdict).toBe("landed");
  });

  it("counts a connection somebody has already drawn", () => {
    const r = rebaseOnto(
      [change("c1", "addRelation", { relationId: "r1", payload: { fromEntityId: "a", toEntityId: "b", kind: "depends on" } })],
      [entity("a", "Maximo"), entity("b", "SAP PM")],
      [relation("r0", "a", "b", "Depends On")],
    );
    expect(r.replayed[0]!.verdict).toBe("landed");
  });

  it("counts a move already made, and a retype already made", () => {
    const moved = rebaseOnto(
      [change("c1", "setParent", { entityId: "a", payload: { parentId: "cap" } })],
      [entity("cap", "Metering", "Capability"), entity("a", "Meter reading", "Capability", {}, "cap")],
      [],
    );
    expect(moved.replayed[0]!.verdict).toBe("landed");
    const retyped = rebaseOnto(
      [change("c1", "retypeEntity", { entityId: "a", payload: { kind: "Platform" } })],
      [entity("a", "Maximo", "Platform")],
      [],
    );
    expect(retyped.replayed[0]!.verdict).toBe("landed");
  });
});

describe("where reality has moved past the plan", () => {
  it("conflicts when the object a change edits has gone", () => {
    const r = rebaseOnto([change("c1", "setAttribute", { entityId: "gone", payload: { key: "owner", value: "X" } })], [], []);
    expect(r.replayed[0]!.verdict).toBe("conflicted");
    expect(r.conflicted).toBe(1);
  });

  it("conflicts when somebody else built the thing this plan was going to introduce", () => {
    const r = rebaseOnto(
      [change("c1", "addEntity", { entityId: "new1", payload: { name: "Asset Hub" } })],
      [entity("other", "Asset Hub")],
      [],
    );
    expect(r.replayed[0]!.verdict).toBe("conflicted");
    expect(r.replayed[0]!.why).toContain("Is it the same thing?");
  });

  it("conflicts when one end of a planned connection is gone", () => {
    const r = rebaseOnto(
      [change("c1", "addRelation", { relationId: "r1", payload: { fromEntityId: "a", toEntityId: "gone", kind: "depends on" } })],
      [entity("a", "Maximo")],
      [],
    );
    expect(r.replayed[0]!.verdict).toBe("conflicted");
  });

  it("does not conflict when the missing end is something this plan introduces", () => {
    const r = rebaseOnto([
      change("c1", "addEntity", { entityId: "new1", payload: { name: "Asset Hub" } }),
      change("c2", "addRelation", { relationId: "r1", payload: { fromEntityId: "a", toEntityId: "new1", kind: "depends on" } }),
    ], [entity("a", "Maximo")], []);
    expect(r.replayed[1]!.verdict).toBe("outstanding");
  });
});

describe("where the plan stands", () => {
  it("is finished when the estate matches every change in it", () => {
    const r = rebaseOnto(
      [change("c1", "retireEntity", { entityId: "a" })],
      [entity("a", "Maximo", "Application", { lifecycle: "retired" })],
      [],
    );
    expect(r.finished).toBe(true);
    expect(progressWords(r)).toBe("This plan has arrived: the estate already matches every change in it.");
  });

  it("counts what is left rather than what is done", () => {
    const r = rebaseOnto([
      change("c1", "retireEntity", { entityId: "a" }),
      change("c2", "retireEntity", { entityId: "b" }),
      change("c3", "setAttribute", { entityId: "gone", payload: { key: "x", value: "y" } }),
    ], [entity("a", "Maximo"), entity("b", "SCADA", "Application", { lifecycle: "retired" })], []);
    expect(progressWords(r)).toBe("1 still to do, 1 already true, 1 that reality has moved past.");
  });

  it("is not finished while something conflicts, even with nothing left to do", () => {
    const r = rebaseOnto([change("c1", "setAttribute", { entityId: "gone", payload: { key: "x", value: "y" } })], [], []);
    expect(r.finished).toBe(false);
  });

  it("says so plainly when there is nothing in it", () => {
    expect(progressWords(rebaseOnto([], [], []))).toBe("This plan is empty.");
  });
});
