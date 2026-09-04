import { describe, expect, it } from "vitest";
import type { CanvasElement } from "./document";
import { attributeKeysOnBoard, computeLens, reachable, relationKindsOnBoard, UNLABELLED } from "./lens";

function card(id: string, attributes?: Record<string, string>): CanvasElement {
  return { id, type: "card", x: 0, y: 0, w: 200, h: 100, z: 1, kind: "Application", color: "#1376d4", title: id, description: "", attributes };
}
function link(id: string, from: string, to: string): CanvasElement {
  return { id, type: "connector", from: { elementId: from }, to: { elementId: to }, label: "", stroke: "#475569", style: "solid", route: "straight", arrowEnd: true, arrowStart: false, z: 10 };
}
// a → b → c, d → b, e isolated
const els: Record<string, CanvasElement> = Object.fromEntries([card("a"), card("b"), card("c"), card("d"), card("e"), link("ab", "a", "b"), link("bc", "b", "c"), link("db", "d", "b")].map((e) => [e.id, e]));

describe("reachable", () => {
  it("follows outbound edges up to the depth", () => {
    expect(reachable(els, ["a"], "out", 1).hops).toEqual({ a: 0, b: 1 });
    expect(reachable(els, ["a"], "out", 2).hops).toEqual({ a: 0, b: 1, c: 2 });
  });
  it("follows inbound edges", () => {
    expect(reachable(els, ["b"], "in", 1).hops).toEqual({ b: 0, a: 1, d: 1 });
  });
  it("both directions and traversed connectors", () => {
    const r = reachable(els, ["b"], "both", 1);
    expect(Object.keys(r.hops).sort()).toEqual(["a", "b", "c", "d"]);
    expect([...r.connectors].sort()).toEqual(["ab", "bc", "db"]);
  });
});

describe("computeLens", () => {
  it("impact lens dims unreachable cards and keeps traversed connectors", () => {
    const r = computeLens({ type: "impact", direction: "out", depth: 1 }, els, ["a"]);
    expect(r?.visible.has("b")).toBe(true);
    expect(r?.visible.has("ab")).toBe(true);
    expect(r?.visible.has("c")).toBe(false);
    expect(r?.visible.has("e")).toBe(false);
    expect(r?.legend.map((l) => l.value)).toEqual(["Selected", "1 hop"]);
  });
  it("impact lens with nothing selected shows everything", () => {
    const r = computeLens({ type: "impact", direction: "both", depth: 2 }, els, []);
    expect(r?.visible.size).toBe(Object.keys(els).length);
  });
  it("attribute lens colours by value, most common first", () => {
    const withAttrs = { ...els, a: card("a", { lifecycle: "Active" }), b: card("b", { lifecycle: "Active" }), c: card("c", { lifecycle: "Phase out" }) };
    const r = computeLens({ type: "attribute", key: "lifecycle" }, withAttrs, []);
    expect(r?.legend.map((l) => [l.value, l.count])).toEqual([["Active", 2], ["Phase out", 1]]);
    expect(r?.colors.a).toBe(r?.colors.b);
    expect(r?.colors.c).not.toBe(r?.colors.a);
    expect(r?.visible.has("d")).toBe(false);
    expect(r?.visible.has("ab")).toBe(true); // both ends visible
    expect(r?.visible.has("db")).toBe(false);
  });
  it("lists attribute keys with counts", () => {
    const withAttrs = { ...els, a: card("a", { lifecycle: "Active", owner: "x" }), b: card("b", { lifecycle: "Active" }) };
    expect(attributeKeysOnBoard(withAttrs)).toEqual([{ key: "lifecycle", count: 2 }, { key: "owner", count: 1 }]);
  });

  it("relation lens colours connectors by type and fades hidden types", () => {
    const withLabels = { ...els, ab: { ...els.ab!, label: "uses" }, bc: { ...els.bc!, label: "uses" } };
    expect(relationKindsOnBoard(withLabels)).toEqual([{ kind: "uses", count: 2 }, { kind: UNLABELLED, count: 1 }]);
    const r = computeLens({ type: "relation", hidden: [UNLABELLED] }, withLabels, []);
    expect(r?.visible.has("ab")).toBe(true);
    expect(r?.visible.has("db")).toBe(false);
    expect(r?.visible.has("e")).toBe(true); // cards are never faded by this lens
    expect(r?.colors.ab).toBe(r?.colors.bc);
    expect(r?.legend.find((l) => l.value === UNLABELLED)?.hidden).toBe(true);
  });
});
