import { describe, expect, it } from "vitest";
import { createCanvasStore, expandSelectionForMove } from "./store";
import type { CanvasElement } from "./document";

const sticky = (id: string, x = 0, y = 0): CanvasElement => ({ id, type: "sticky", x, y, w: 100, h: 100, title: "", text: id, color: "#fff", z: 1 });

function makeStore(elements: CanvasElement[] = []) {
  return createCanvasStore({ boardId: "b", document: { version: 2, elements: Object.fromEntries(elements.map((e) => [e.id, e])) } });
}

describe("canvas store", () => {
  it("adds, selects and deletes elements with history", () => {
    const store = makeStore();
    store.getState().addElements([sticky("a")], { select: true });
    expect(store.getState().selection).toEqual(["a"]);
    expect(store.getState().saveState).toBe("dirty");
    store.getState().deleteElements(["a"]);
    expect(store.getState().elements.a).toBeUndefined();
    store.getState().undo();
    expect(store.getState().elements.a).toBeDefined();
    store.getState().undo();
    expect(store.getState().elements.a).toBeUndefined();
    store.getState().redo();
    expect(store.getState().elements.a).toBeDefined();
  });

  it("deletes connectors attached to deleted elements", () => {
    const c: CanvasElement = { id: "c", type: "connector", from: { elementId: "a" }, to: { elementId: "b" }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 3 };
    const store = makeStore([sticky("a"), sticky("b", 300), c]);
    store.getState().deleteElements(["a"]);
    expect(Object.keys(store.getState().elements).sort()).toEqual(["b"]);
  });

  it("duplicates a selection including internal connectors", () => {
    const c: CanvasElement = { id: "c", type: "connector", from: { elementId: "a" }, to: { elementId: "b" }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 3 };
    const store = makeStore([sticky("a"), sticky("b", 300), c]);
    store.getState().select(["a", "b", "c"]);
    store.getState().duplicateSelection();
    const els = Object.values(store.getState().elements);
    expect(els).toHaveLength(6);
    const newConnector = els.find((e) => e.type === "connector" && e.id !== "c");
    expect(newConnector && newConnector.type === "connector" && "elementId" in newConnector.from && newConnector.from.elementId !== "a").toBe(true);
  });

  it("moves frame children with the frame", () => {
    const frame: CanvasElement = { id: "f", type: "frame", x: 0, y: 0, w: 500, h: 500, title: "F", color: "#000", z: 1 };
    const store = makeStore([frame, sticky("in", 100, 100), sticky("out", 900, 900)]);
    expect(expandSelectionForMove(["f"], store.getState().elements).sort()).toEqual(["f", "in"]);
    store.getState().select(["f"]);
    store.getState().nudgeSelection(10, 0);
    expect(store.getState().elements.in).toMatchObject({ x: 110 });
    expect(store.getState().elements.out).toMatchObject({ x: 900 });
  });

  it("zoom to fit centres the content", () => {
    const store = makeStore([sticky("a", 0, 0), sticky("b", 900, 0)]);
    store.getState().setViewport(1000, 800);
    store.getState().zoomToFit();
    const { camera } = store.getState();
    // content 1000 wide, viewport 1000 with 80 padding => zoom 0.84
    expect(camera.zoom).toBeCloseTo(0.84);
    expect(camera.x + 500 * camera.zoom).toBeCloseTo(500);
  });
});
