import { describe, expect, it } from "vitest";
import { alignBoxes, distributeBoxes, boxEdgePoint, cameraToFit, cameraToFitInsets, connectorPath, snapToBoxes, connectorGeometry, resizeBox, screenToWorld, unionBoxes, worldToScreen, zoomCameraAt } from "./geometry";
import type { CanvasElement } from "./document";

describe("camera", () => {
  it("round-trips world ↔ screen", () => {
    const cam = { x: 120, y: -40, zoom: 1.7 };
    const p = { x: 33.3, y: -212 };
    const back = screenToWorld(worldToScreen(p, cam), cam);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it("zooms around an anchor without moving the world point under it", () => {
    const cam = { x: 50, y: 80, zoom: 1 };
    const anchor = { x: 400, y: 300 };
    const worldUnderAnchor = screenToWorld(anchor, cam);
    const next = zoomCameraAt(cam, anchor, 2);
    expect(next.zoom).toBe(2);
    const after = worldToScreen(worldUnderAnchor, next);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });

  it("clamps zoom", () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    expect(zoomCameraAt(cam, { x: 0, y: 0 }, 1000).zoom).toBe(8);
    expect(zoomCameraAt(cam, { x: 0, y: 0 }, 0.00001).zoom).toBe(0.02);
  });

  it("fits bounds centred in the viewport", () => {
    const cam = cameraToFit({ x: 0, y: 0, w: 1000, h: 500 }, 800, 600, 50);
    // width is the limiting dimension: (800-100)/1000 = 0.7
    expect(cam.zoom).toBeCloseTo(0.7);
    const centre = worldToScreen({ x: 500, y: 250 }, cam);
    expect(centre.x).toBeCloseTo(400);
    expect(centre.y).toBeCloseTo(300);
  });
});

describe("insets fit", () => {
  it("centres within the uncovered area", () => {
    const cam = cameraToFitInsets({ x: 0, y: 0, w: 400, h: 200 }, 1600, 1000, { top: 100, right: 300, bottom: 100, left: 400 }, 2);
    // available 900×800 → zoom limited by width: 900/400 = 2.25 → clamped to 2
    expect(cam.zoom).toBe(2);
    const centre = worldToScreen({ x: 200, y: 100 }, cam);
    expect(centre.x).toBeCloseTo(400 + 450);
    expect(centre.y).toBeCloseTo(100 + 400);
  });
});

describe("boxes", () => {
  it("unions boxes", () => {
    expect(unionBoxes([{ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: -5, w: 20, h: 10 }])).toEqual({ x: 0, y: -5, w: 25, h: 15 });
    expect(unionBoxes([])).toBeNull();
  });

  it("finds the edge point towards a target", () => {
    const b = { x: 0, y: 0, w: 100, h: 50 };
    expect(boxEdgePoint(b, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(boxEdgePoint(b, { x: 50, y: -500 })).toEqual({ x: 50, y: 0 });
  });

  it("resizes with minimum size and anchored opposite edge", () => {
    const start = { x: 100, y: 100, w: 200, h: 100 };
    expect(resizeBox(start, "se", 50, 20)).toEqual({ x: 100, y: 100, w: 250, h: 120 });
    expect(resizeBox(start, "nw", 50, 20)).toEqual({ x: 150, y: 120, w: 150, h: 80 });
    const tiny = resizeBox(start, "e", -1000, 0);
    expect(tiny.w).toBe(24);
  });
});

describe("connectors", () => {
  it("attaches to element borders", () => {
    const a: CanvasElement = { id: "a", type: "shape", shape: "rect", x: 0, y: 0, w: 100, h: 100, text: "", fill: "#fff", stroke: "#000", z: 1 };
    const b: CanvasElement = { id: "b", type: "shape", shape: "rect", x: 300, y: 0, w: 100, h: 100, text: "", fill: "#fff", stroke: "#000", z: 2 };
    const c: CanvasElement = { id: "c", type: "connector", from: { elementId: "a" }, to: { elementId: "b" }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 3 };
    const g = connectorGeometry(c, { a, b, c });
    expect(g?.from).toEqual({ x: 100, y: 50 });
    expect(g?.to).toEqual({ x: 300, y: 50 });
  });

  it("returns null when an end is missing", () => {
    const c: CanvasElement = { id: "c", type: "connector", from: { elementId: "missing" }, to: { point: { x: 0, y: 0 } }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 3 };
    expect(connectorGeometry(c, { c })).toBeNull();
  });
});

describe("connector routes", () => {
  const a: CanvasElement = { id: "a", type: "shape", shape: "rect", x: 0, y: 0, w: 100, h: 100, text: "", fill: "#fff", stroke: "#000", z: 1 };
  const b: CanvasElement = { id: "b", type: "shape", shape: "rect", x: 300, y: 200, w: 100, h: 100, text: "", fill: "#fff", stroke: "#000", z: 2 };
  const base = { id: "c", type: "connector" as const, from: { elementId: "a" }, to: { elementId: "b" }, label: "", stroke: "#000", style: "solid" as const, arrowEnd: true, arrowStart: false, z: 3 };

  it("elbow routes through two bends and arrives horizontally or vertically", () => {
    const p = connectorPath({ ...base, route: "elbow" }, { a, b, c: base })!;
    expect(p.d.split("L")).toHaveLength(4);
    expect(Math.abs(p.endDir.x) === 1 || Math.abs(p.endDir.y) === 1).toBe(true);
  });

  it("curved route is a cubic whose midpoint lies between the endpoints", () => {
    const p = connectorPath({ ...base, route: "curved" }, { a, b, c: base })!;
    expect(p.d.startsWith("M ") && p.d.includes(" C ")).toBe(true);
    expect(p.mid.x).toBeGreaterThan(p.from.x);
    expect(p.mid.x).toBeLessThan(p.to.x);
  });

  it("straight route keeps the plain line", () => {
    const p = connectorPath(base, { a, b, c: base })!;
    expect(p.d).toBe(`M ${p.from.x} ${p.from.y} L ${p.to.x} ${p.to.y}`);
  });
});

describe("snapping", () => {
  it("snaps to the nearest edge or centre within the threshold", () => {
    const others = [{ x: 100, y: 100, w: 200, h: 100 }];
    const r = snapToBoxes({ x: 103, y: 260, w: 50, h: 50 }, others, 6);
    expect(r.dx).toBe(-3); // left edge → 100
    expect(r.dy).toBe(0); // 260 is not within 6 of 100 / 150 / 200
    expect(r.guidesX).toEqual([100]);
    const c = snapToBoxes({ x: 180, y: 0, w: 40, h: 40 }, others, 6);
    expect(c.dx).toBe(0); // centre 200 already aligned with the other centre
    expect(c.guidesX).toEqual([200]);
  });
});

describe("align / distribute", () => {
  const boxes = [
    { id: "a", x: 0, y: 0, w: 100, h: 50 },
    { id: "b", x: 300, y: 80, w: 50, h: 100 },
    { id: "c", x: 120, y: 200, w: 200, h: 20 },
  ];
  it("aligns to the union's edges and centres", () => {
    expect(alignBoxes(boxes, "left")).toEqual({ b: { dx: -300, dy: 0 }, c: { dx: -120, dy: 0 } });
    expect(alignBoxes(boxes, "right")).toEqual({ a: { dx: 250, dy: 0 }, c: { dx: 30, dy: 0 } });
    expect(alignBoxes(boxes, "top")).toEqual({ b: { dx: 0, dy: -80 }, c: { dx: 0, dy: -200 } });
    const cy = alignBoxes(boxes, "centerY"); // union 0..220 → centre 110
    expect(cy.a).toEqual({ dx: 0, dy: 85 });
    expect(cy.b).toEqual({ dx: 0, dy: -20 });
    expect(alignBoxes(boxes.slice(0, 1), "left")).toEqual({});
  });
  it("distributes with equal gaps between the first and last", () => {
    const d = distributeBoxes(boxes, "x"); // span 0..350, widths 350 total → gap 0: a@0, c@100, b@300
    expect(d).toEqual({ c: { dx: -20, dy: 0 } });
    expect(distributeBoxes(boxes.slice(0, 2), "x")).toEqual({});
  });
});
