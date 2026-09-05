import { describe, expect, it } from "vitest";
import { createCanvasStore, documentFromFrame, expandSelectionForMove } from "./store";
import type { CanvasElement } from "./document";

const sticky = (id: string, x = 0, y = 0): CanvasElement => ({ id, type: "sticky", x, y, w: 100, h: 100, title: "", text: id, color: "#fff", z: 1 });

function makeStore(elements: CanvasElement[] = []) {
  return createCanvasStore({ boardId: "b", workspaceId: "w", document: { version: 2, elements: Object.fromEntries(elements.map((e) => [e.id, e])) } });
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

  it("zoom to fit centres the content in the area not covered by panels", () => {
    const store = makeStore([sticky("a", 0, 0), sticky("b", 900, 0)]);
    store.getState().setViewport(1000, 800); // narrow viewport: panel insets collapse to 66 + 40
    store.getState().zoomToFit();
    const { camera } = store.getState();
    // content 1000 wide, available width 1000 - 2*106 = 788 => zoom 0.788
    expect(camera.zoom).toBeCloseTo(0.788);
    expect(camera.x + 500 * camera.zoom).toBeCloseTo(500);
  });

  it("derives the lens result from lens, selection and elements", () => {
    const card = (id: string): CanvasElement => ({ id, type: "card", x: 0, y: 0, w: 200, h: 100, z: 1, kind: "Application", color: "#1376d4", title: id, description: "" });
    const store = makeStore([card("a"), card("b"), card("c"), { id: "ab", type: "connector", from: { elementId: "a" }, to: { elementId: "b" }, label: "", stroke: "#000", style: "solid", route: "straight", arrowEnd: true, arrowStart: false, z: 5 }]);
    expect(store.getState().lensResult).toBeNull();
    store.getState().setLens({ type: "impact", direction: "out", depth: 1 });
    store.getState().select(["a"]);
    expect(store.getState().lensResult?.visible.has("b")).toBe(true);
    expect(store.getState().lensResult?.visible.has("c")).toBe(false);
    // saved views carry the lens
    store.getState().saveViewpoint("impact");
    store.getState().setLens({ type: "none" });
    expect(store.getState().lensResult).toBeNull();
    store.getState().applyViewpoint(store.getState().viewpoints[0]!.id);
    expect(store.getState().lens).toEqual({ type: "impact", direction: "out", depth: 1 });
  });

  it("aligns the selection and carries frame contents", () => {
    const store = makeStore([
      sticky("a", 0, 0),
      sticky("b", 300, 80),
      { id: "f", type: "frame", x: 500, y: 500, w: 300, h: 300, title: "F", color: "#000", z: 0 },
      sticky("child", 550, 550),
    ]);
    store.getState().select(["a", "b", "f"]);
    store.getState().alignSelection("top");
    const y = (id: string) => { const el = store.getState().elements[id]!; return "y" in el ? el.y : NaN; };
    expect(y("b")).toBe(0);
    expect(y("f")).toBe(0);
    expect(y("child")).toBe(50); // moved with its frame
    store.getState().undo();
    expect(y("f")).toBe(500);
  });

  it("promotes notes to cards in place with a fresh entity id", () => {
    const store = makeStore([{ id: "n", type: "sticky", x: 10, y: 20, w: 300, h: 150, title: "Billing engine", text: "Owned by Finance", color: "#fff", z: 3 }]);
    store.getState().convertNotesToCards(["n"]);
    const el = store.getState().elements.n!;
    expect(el.type).toBe("card");
    if (el.type === "card") {
      expect(el.title).toBe("Billing engine");
      expect(el.description).toBe("Owned by Finance");
      expect(el.kind).toBe("");
      expect(String(el.meta?.entityId)).toMatch(/^ent_/);
      expect([el.x, el.y, el.z]).toEqual([10, 20, 3]);
    }
    store.getState().undo();
    expect(store.getState().elements.n!.type).toBe("sticky");
  });

  it("builds a board document from a frame's contents, translated to the origin", () => {
    const els: CanvasElement[] = [
      { id: "f", type: "frame", x: 100, y: 100, w: 400, h: 300, title: "Billing", color: "#000", z: 0 },
      sticky("in1", 120, 120),
      sticky("in2", 300, 200),
      sticky("out", 900, 900),
      { id: "c1", type: "connector", from: { elementId: "in1" }, to: { elementId: "in2" }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 5 },
      { id: "c2", type: "connector", from: { elementId: "in1" }, to: { elementId: "out" }, label: "", stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false, z: 6 },
    ];
    const doc = documentFromFrame("f", Object.fromEntries(els.map((e) => [e.id, e])));
    expect(Object.keys(doc!.elements).sort()).toEqual(["c1", "in1", "in2"]);
    const in1 = doc!.elements.in1!;
    expect("x" in in1 && [in1.x, in1.y]).toEqual([20, 20]);
    expect(documentFromFrame("in1", Object.fromEntries(els.map((e) => [e.id, e])))).toBeNull();
  });
});
