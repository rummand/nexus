import { describe, expect, it } from "vitest";
import { boxEdgePoint, cameraToFit, cameraToFitInsets, connectorGeometry, resizeBox, screenToWorld, unionBoxes, worldToScreen, zoomCameraAt } from "./geometry";
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
