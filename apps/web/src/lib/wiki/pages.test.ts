import { describe, expect, it } from "vitest";
import { buildTree, slugFor, trail } from "./pages";
import type { WikiPageRow } from "@/db/schema";

/** The shape of the wiki: its tree, its breadcrumb and its slugs (§5.60). */

const page = (id: string, title: string, parentId: string | null = null, position = 0): WikiPageRow => ({
  id, workspaceId: "w", parentId, slug: id, title, body: "", icon: "", position, source: "",
  createdById: null, updatedByName: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
});

describe("the tree", () => {
  it("nests children under their parent, in the order they were arranged", () => {
    const tree = buildTree([page("b", "B", "a", 2), page("a", "A"), page("c", "C", "a", 1)]);
    expect(tree.map((n) => n.title)).toEqual(["A"]);
    expect(tree[0]!.children.map((n) => n.title)).toEqual(["C", "B"]);
  });

  it("falls back to the title when two siblings share a position", () => {
    const tree = buildTree([page("z", "Zeta", null, 0), page("a", "Alpha", null, 0)]);
    expect(tree.map((n) => n.title)).toEqual(["Alpha", "Zeta"]);
  });

  it("shows an orphan at the root rather than hiding it", () => {
    // Its parent is gone. A page you can see is one somebody can re-file.
    const tree = buildTree([page("x", "Orphan", "missing")]);
    expect(tree.map((n) => n.title)).toEqual(["Orphan"]);
  });

  it("has nothing to show for a workspace with no pages", () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe("the breadcrumb", () => {
  const rows = [page("a", "A"), page("b", "B", "a"), page("c", "C", "b")];

  it("runs from the root down to the page", () => {
    expect(trail(rows, "c").map((r) => r.title)).toEqual(["A", "B", "C"]);
  });

  it("is just the page when it has no parent", () => {
    expect(trail(rows, "a").map((r) => r.title)).toEqual(["A"]);
  });

  it("terminates even if the data ever contained a cycle", () => {
    const cyclic = [page("x", "X", "y"), page("y", "Y", "x")];
    expect(trail(cyclic, "x").length).toBeLessThanOrEqual(2);
  });
});

describe("slugs", () => {
  it("is readable and free of punctuation", () => {
    expect(slugFor("Grid Platform: 2027 review!", new Set())).toBe("grid-platform-2027-review");
  });

  it("steps aside when the name is taken, rather than failing the write", () => {
    expect(slugFor("Principles", new Set(["principles"]))).toBe("principles-2");
    expect(slugFor("Principles", new Set(["principles", "principles-2"]))).toBe("principles-3");
  });

  it("always returns something, even for a title made only of punctuation", () => {
    expect(slugFor("!!!", new Set())).toBe("page");
  });
});
