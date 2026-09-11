import { describe, expect, it } from "vitest";
import { planParents } from "./parents";

/**
 * Deciding where each imported object sits (§5.74).
 *
 * The cases are the ways an export lies about a hierarchy: a parent nothing knows, a parent that
 * is already set, and two rows that each claim to contain the other.
 */

const tree = (...pairs: Array<[string, string | null]>) => pairs.map(([id, parentId]) => ({ id, parentId }));
const names: Record<string, string> = { "grid operations": "e1", metering: "e2", substations: "e3" };
const resolve = (name: string) => names[name.trim().toLowerCase()];

describe("planning where the imported objects sit", () => {
  it("puts a child inside the parent its row names", () => {
    expect(planParents([{ id: "e2", parent: "Grid Operations" }], resolve, tree(["e1", null], ["e2", null])))
      .toEqual([{ id: "e2", parentId: "e1", from: "" }]);
  });

  it("keeps the parent it replaced, so a rollback can put it back", () => {
    const moves = planParents([{ id: "e3", parent: "Grid Operations" }], resolve, tree(["e1", null], ["e3", "e2"]));
    expect(moves[0]).toEqual({ id: "e3", parentId: "e1", from: "e2" });
  });

  it("writes nothing when the object is already there", () => {
    // A second import of the same export must read as "nothing changed", not as a moved estate.
    expect(planParents([{ id: "e2", parent: "Grid Operations" }], resolve, tree(["e1", null], ["e2", "e1"]))).toEqual([]);
  });

  it("leaves an object at the top when its parent is a name nothing knows", () => {
    expect(planParents([{ id: "e2", parent: "Somewhere Else" }], resolve, tree(["e2", null]))).toEqual([]);
  });

  it("ignores a row that names itself", () => {
    expect(planParents([{ id: "e2", parent: "Metering" }], resolve, tree(["e2", null]))).toEqual([]);
  });

  it("refuses the move that would close a ring", () => {
    /*
     * Metering is already inside Grid Operations; putting Grid Operations inside Metering makes a
     * hierarchy with no top, and everything that walks a tree either hangs on it or truncates.
     */
    expect(planParents([{ id: "e1", parent: "Metering" }], resolve, tree(["e1", null], ["e2", "e1"]))).toEqual([]);
  });

  it("sees the ring one batch closes on itself", () => {
    // Neither row is a loop against the graph as it was; together they are.
    const moves = planParents(
      [{ id: "e2", parent: "Grid Operations" }, { id: "e1", parent: "Metering" }],
      resolve,
      tree(["e1", null], ["e2", null]),
    );
    expect(moves).toEqual([{ id: "e2", parentId: "e1", from: "" }]);
  });

  it("builds a chain in one pass, whatever order the rows arrive in", () => {
    const moves = planParents(
      [{ id: "e3", parent: "Metering" }, { id: "e2", parent: "Grid Operations" }],
      resolve,
      tree(["e1", null], ["e2", null], ["e3", null]),
    );
    expect(moves).toEqual([{ id: "e3", parentId: "e2", from: "" }, { id: "e2", parentId: "e1", from: "" }]);
  });

  it("skips a parent that is not in the workspace at all", () => {
    // Resolvable by name, but the id is not in this tree: a stale index, not a move to make.
    expect(planParents([{ id: "e2", parent: "Grid Operations" }], resolve, tree(["e2", null]))).toEqual([]);
  });
});
