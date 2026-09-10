import { describe, expect, it } from "vitest";
import {
  ancestry, depth, descendants, flatten, forest, reparentOrphans, reparentProblem, rollUp,
} from "./hierarchy";

interface Cap {
  id: string;
  parentId: string | null;
  name: string;
  apps: number;
}

const cap = (id: string, parentId: string | null, name = id, apps = 0): Cap => ({ id, parentId, name, apps });

/**
 *   metering            billing
 *     ├ reading           └ invoicing
 *     └ validation
 */
const tree = (): Cap[] => [
  cap("metering", null, "Metering", 0),
  cap("reading", "metering", "Meter reading", 3),
  cap("validation", "metering", "Validation", 2),
  cap("billing", null, "Billing", 1),
  cap("invoicing", "billing", "Invoicing", 4),
];

const byName = (a: Cap, b: Cap) => a.name.localeCompare(b.name);

describe("building the forest", () => {
  it("puts roots at depth 0 and children beneath them", () => {
    const roots = forest(tree(), byName);
    expect(roots.map((r) => r.item.id)).toEqual(["billing", "metering"]);
    expect(roots[1]!.children.map((c) => c.item.id)).toEqual(["reading", "validation"]);
    expect(roots[1]!.children[0]!.depth).toBe(1);
  });

  it("counts everything beneath a node, not just its children", () => {
    const deep = [cap("a", null), cap("b", "a"), cap("c", "b"), cap("d", "c")];
    expect(forest(deep)[0]!.descendants).toBe(3);
  });

  it("treats an item whose parent is not in the list as a root, rather than losing it", () => {
    /*
     * A filtered tree that silently drops the children of things outside the filter under-reports
     * without ever looking wrong, which is the failure nobody notices.
     */
    const partial = [cap("reading", "metering"), cap("billing", null)];
    expect(forest(partial).map((r) => r.item.id).sort()).toEqual(["billing", "reading"]);
  });

  it("does not hang on a cycle", () => {
    // Corrupt data should render as something odd, never as a frozen tab.
    const loop = [cap("a", "b"), cap("b", "a")];
    expect(() => forest(loop)).not.toThrow();
  });

  it("reads back as a flat list in reading order", () => {
    expect(flatten(forest(tree(), byName)).map((n) => n.item.id))
      .toEqual(["billing", "invoicing", "metering", "reading", "validation"]);
  });
});

describe("where a thing sits", () => {
  it("gives the chain from the root down, inclusive", () => {
    expect(ancestry(tree(), "reading").map((c) => c.id)).toEqual(["metering", "reading"]);
  });

  it("is just the thing itself for a root", () => {
    expect(ancestry(tree(), "billing").map((c) => c.id)).toEqual(["billing"]);
  });

  it("says nothing about an id it does not know", () => {
    expect(ancestry(tree(), "nope")).toEqual([]);
  });

  it("stops rather than spinning when the chain loops", () => {
    expect(ancestry([cap("a", "b"), cap("b", "a")], "a").length).toBeLessThanOrEqual(2);
  });

  it("lists everything beneath, at any depth", () => {
    expect(descendants(tree(), "metering").sort()).toEqual(["reading", "validation"]);
    const deep = [cap("a", null), cap("b", "a"), cap("c", "b")];
    expect(descendants(deep, "a").sort()).toEqual(["b", "c"]);
  });
});

describe("moving something", () => {
  it("allows a move to a root", () => {
    expect(reparentProblem(tree(), "reading", null)).toBeNull();
  });

  it("refuses to put a thing inside itself", () => {
    expect(reparentProblem(tree(), "metering", "metering")).toMatch(/Nothing can contain itself/);
  });

  it("refuses to make a loop, and says why in those terms", () => {
    // Putting Metering inside its own child is a ring with no top: unwalkable, not merely odd.
    expect(reparentProblem(tree(), "metering", "reading")).toMatch(/loop with no top/);
  });

  it("refuses a parent that is not there", () => {
    expect(reparentProblem(tree(), "reading", "ghost")).toMatch(/not here/);
  });

  it("allows an ordinary move between branches", () => {
    expect(reparentProblem(tree(), "invoicing", "metering")).toBeNull();
  });
});

describe("deleting a parent", () => {
  it("lifts the children to the grandparent rather than taking them with it", () => {
    /*
     * Deleting a capability must not delete the estate underneath it. Losing the level that was
     * removed is the point; losing everything below it is data loss.
     */
    const items = [...tree(), cap("meter-x", "reading")];
    expect(reparentOrphans(items, "reading")).toEqual([{ id: "meter-x", parentId: "metering" }]);
  });

  it("makes them roots when the deleted thing was one", () => {
    expect(reparentOrphans(tree(), "metering")).toEqual([
      { id: "reading", parentId: null },
      { id: "validation", parentId: null },
    ]);
  });

  it("has nothing to do for a leaf", () => {
    expect(reparentOrphans(tree(), "invoicing")).toEqual([]);
  });
});

describe("rolling up", () => {
  it("adds every descendant's count to a parent's own", () => {
    // The number a capability map exists for: a parent with nothing of its own is not empty.
    const counts = rollUp(tree(), (c) => c.apps);
    expect(counts.get("metering")).toEqual({ own: 0, rolled: 5 });
    expect(counts.get("billing")).toEqual({ own: 1, rolled: 5 });
    expect(counts.get("reading")).toEqual({ own: 3, rolled: 3 });
  });

  it("carries a count up through more than one level", () => {
    const deep = [cap("a", null, "a", 1), cap("b", "a", "b", 1), cap("c", "b", "c", 1)];
    expect(rollUp(deep, (x) => x.apps).get("a")!.rolled).toBe(3);
  });
});

describe("how deep it goes", () => {
  it("counts levels, not nodes", () => {
    expect(depth(tree())).toBe(2);
    expect(depth([cap("a", null)])).toBe(1);
    expect(depth([])).toBe(0);
  });
});
