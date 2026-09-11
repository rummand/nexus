import { describe, expect, it } from "vitest";
import { canCheckOut, divergenceOf, divergenceWords, refKindWords, refName, MAIN } from "./ref";
import type { Change } from "./types";

const change = (over: Partial<Change> & { id: string; op: Change["op"] }): Change => ({
  entityId: null, relationId: null, payload: {}, note: "", createdAt: "2026-09-01T00:00:00.000Z", ...over,
});

describe("how far a change set has moved", () => {
  it("counts objects, not rows", () => {
    // Renaming one application twice is one changed application. Counting rows would make a plan
    // that renames one system look bigger than one that retires four.
    const d = divergenceOf([
      change({ id: "1", op: "setAttribute", entityId: "ent_a" }),
      change({ id: "2", op: "setAttribute", entityId: "ent_a" }),
      change({ id: "3", op: "setAttribute", entityId: "ent_b" }),
    ]);
    expect(d.changes).toBe(2);
    expect(d.total).toBe(2);
  });

  it("does not count an introduced object as also changed", () => {
    const d = divergenceOf([
      change({ id: "1", op: "addEntity", entityId: "ent_new" }),
      change({ id: "2", op: "setAttribute", entityId: "ent_new" }),
    ]);
    expect(d).toMatchObject({ introduces: 1, changes: 0, total: 1 });
  });

  it("does not count a retired object as also changed", () => {
    const d = divergenceOf([
      change({ id: "1", op: "setAttribute", entityId: "ent_x" }),
      change({ id: "2", op: "retireEntity", entityId: "ent_x" }),
    ]);
    expect(d).toMatchObject({ retires: 1, changes: 0, total: 1 });
  });

  it("counts relations separately, by relation", () => {
    const d = divergenceOf([
      change({ id: "1", op: "addRelation", relationId: "rel_1" }),
      change({ id: "2", op: "addRelation", relationId: "rel_1" }),
      change({ id: "3", op: "removeRelation", relationId: "rel_2" }),
    ]);
    expect(d).toMatchObject({ connects: 1, disconnects: 1, total: 2 });
  });

  it("ignores a change with nothing to point at rather than throwing", () => {
    expect(divergenceOf([change({ id: "1", op: "addEntity" })]).total).toBe(0);
  });

  it("is empty for an empty change set", () => {
    expect(divergenceOf([])).toMatchObject({ total: 0 });
    expect(divergenceWords(divergenceOf([]))).toBe("");
  });

  it("writes the counts in the order a reader scans them", () => {
    const words = divergenceWords(divergenceOf([
      change({ id: "1", op: "addEntity", entityId: "a" }),
      change({ id: "2", op: "retireEntity", entityId: "b" }),
      change({ id: "3", op: "addRelation", relationId: "r" }),
    ]));
    expect(words).toBe("1 added · 1 retired · 1 connected");
  });
});

describe("naming a ref", () => {
  it("calls main main, and says what it means", () => {
    expect(refName(MAIN)).toBe("main");
    expect(refKindWords(MAIN)).toMatch(/as we currently believe it to be/);
  });

  it("says whether a change set is a dated plan or an undated proposal", () => {
    const set = { kind: "set", id: "cs_1", name: "SAP", status: "planned", targetDate: "2027-06-30" } as const;
    expect(refKindWords(set)).toBe("a plan, for 2027-06-30");
    expect(refKindWords({ ...set, targetDate: "" })).toBe("a proposal, undated");
  });

  it("never renders an empty name", () => {
    expect(refName({ kind: "set", id: "cs_1", name: "", status: "draft", targetDate: "" })).toMatch(/unnamed/);
  });
});

describe("where you may stand", () => {
  it("allows a draft or a planned change set, and refuses the closed ones", () => {
    expect(canCheckOut({ status: "draft" })).toBe(true);
    expect(canCheckOut({ status: "planned" })).toBe(true);
    // Delivered is history and abandoned is a decision; standing in either would be editing the past.
    expect(canCheckOut({ status: "delivered" })).toBe(false);
    expect(canCheckOut({ status: "abandoned" })).toBe(false);
  });
});
