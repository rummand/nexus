import { describe, expect, it } from "vitest";
import type { CanvasDocument } from "./document";
import { documentToSvg, wrapText } from "./export";

describe("export", () => {
  it("wraps text greedily and marks truncation", () => {
    expect(wrapText("one two three four", 60, 10, 5)).toEqual(["one two", "three four"]);
    expect(wrapText("a b c d e f g h", 30, 10, 2)).toEqual(["a b c", "d e …"]);
    expect(wrapText("", 100, 10, 2)).toEqual([]);
  });
  it("renders every element type and connectors into a standalone svg", () => {
    const doc: CanvasDocument = {
      version: 2,
      elements: {
        f: { id: "f", type: "frame", x: -20, y: -20, w: 600, h: 300, title: "Frame & co", color: "#1376d4", z: 0 },
        a: { id: "a", type: "card", x: 0, y: 0, w: 236, h: 124, z: 1, kind: "Application", color: "#f59e0b", title: "SAP <S/4>", description: "ERP", attributes: { lifecycle: "phase out" } },
        b: { id: "b", type: "card", x: 320, y: 0, w: 236, h: 124, z: 2, kind: "Interface", color: "#1376d4", title: "API", description: "" },
        n: { id: "n", type: "sticky", x: 0, y: 160, w: 200, h: 100, title: "Note", text: "body", color: "#fde68a", z: 3 },
        t: { id: "t", type: "text", variant: "section", x: 220, y: 160, w: 300, h: 80, title: "Section", text: "", color: "#1376d4", z: 4 },
        s: { id: "s", type: "shape", shape: "diamond", x: 540, y: 160, w: 100, h: 100, text: "?", fill: "#fff", stroke: "#475569", z: 5 },
        c: { id: "c", type: "connector", from: { elementId: "a" }, to: { elementId: "b" }, label: "uses", stroke: "#475569", style: "dashed", route: "curved", arrowEnd: true, arrowStart: false, z: 6 },
      },
    };
    const svg = documentToSvg(doc, { title: "Test board" });
    expect(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\"")).toBe(true);
    expect(svg).toContain("<title>Test board</title>");
    expect(svg).toContain("SAP &lt;S/4&gt;"); // escaped
    expect(svg).toContain("Frame &amp; co");
    expect(svg).toContain("lifecycle · phase out");
    expect(svg).toContain("<polygon"); // diamond + arrowhead
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain(">uses<");
    expect(svg.match(/<rect/g)!.length).toBeGreaterThan(5);
  });
});
