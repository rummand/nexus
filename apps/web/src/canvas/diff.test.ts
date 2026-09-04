import { describe, expect, it } from "vitest";
import type { CanvasDocument, CanvasElement } from "./document";
import { diffDocuments, elementLabel, summarizeDiff } from "./diff";

const card = (id: string, title: string, x = 0): CanvasElement => ({ id, type: "card", x, y: 0, w: 200, h: 100, z: 1, kind: "Application", color: "#000", title, description: "" });
const doc = (...els: CanvasElement[]): CanvasDocument => ({ version: 2, elements: Object.fromEntries(els.map((e) => [e.id, e])) });

describe("diffDocuments", () => {
  it("reports added, removed and changed elements with collapsed field names", () => {
    const before = doc(card("a", "SAP"), card("b", "CRM"), card("c", "Old"));
    const a2 = { ...card("a", "SAP", 50), z: 9 } as CanvasElement;
    const b2 = { ...card("b", "CRM Cloud"), description: "renamed" } as CanvasElement;
    const after = doc(a2, b2, card("d", "New"));
    const d = diffDocuments(before, after);
    expect(d.added.map(elementLabel)).toEqual(["New"]);
    expect(d.removed.map(elementLabel)).toEqual(["Old"]);
    expect(d.changed.map((c) => [c.before.id, c.fields])).toEqual([["a", ["position"]], ["b", ["title", "description"]]]);
    expect(summarizeDiff(d)).toBe("1 added · 1 removed · 2 changed");
    expect(summarizeDiff(diffDocuments(before, before))).toBe("No differences");
  });
});
