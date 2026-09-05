import { describe, expect, it } from "vitest";
import { initialLayout, layout, layoutBounds, seededRandom, tick } from "./force";

describe("force layout", () => {
  it("is deterministic: the same graph lays out identically twice", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "d", to: "e" }];
    const one = layout(ids, edges, 60);
    const two = layout(ids, edges, 60);
    expect(one.map((n) => [n.id, Math.round(n.x), Math.round(n.y)])).toEqual(two.map((n) => [n.id, Math.round(n.x), Math.round(n.y)]));
    expect(seededRandom(1)()).toBe(seededRandom(1)());
  });

  it("never emits NaN, even when every node starts coincident", () => {
    const ids = ["a", "b", "c"];
    const nodes = ids.map((id) => ({ id, x: 0, y: 0, vx: 0, vy: 0 }));
    for (let i = 0; i < 30; i++) tick(nodes, [{ from: "a", to: "b" }], 0.5);
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it("pulls connected nodes closer together than unconnected ones", () => {
    const ids = ["a", "b", "x", "y"];
    // a–b are joined; x and y are isolated
    const nodes = layout(ids, [{ from: "a", to: "b" }], 300);
    const at = (id: string) => nodes.find((n) => n.id === id)!;
    const dist = (p: string, q: string) => Math.hypot(at(p).x - at(q).x, at(p).y - at(q).y);
    expect(dist("a", "b")).toBeLessThan(dist("x", "y"));
  });

  it("holds fixed nodes in place while others move", () => {
    const nodes = initialLayout(["a", "b", "c"], 1);
    nodes[0]!.fixed = true;
    const pinned = { x: nodes[0]!.x, y: nodes[0]!.y };
    const moverBefore = { x: nodes[1]!.x, y: nodes[1]!.y };
    for (let i = 0; i < 20; i++) tick(nodes, [{ from: "a", to: "b" }], 0.8);
    expect(nodes[0]!.x).toBe(pinned.x);
    expect(nodes[0]!.y).toBe(pinned.y);
    expect(nodes[1]!.x === moverBefore.x && nodes[1]!.y === moverBefore.y).toBe(false);
  });

  it("reports a usable bounding box, including for an empty graph", () => {
    const b = layoutBounds(layout(["a", "b", "c"], [], 40));
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
    expect(layoutBounds([])).toEqual({ x: -100, y: -100, w: 200, h: 200 });
  });
});
