import { describe, expect, it } from "vitest";
import { capabilityMapFrom, type CapabilityNode, type RealisingApplication } from "./capability-map";
import type { CanvasElement } from "./document";

/**
 * The capability map, built from the model (§5.75).
 *
 * The case that drove this: Energinet's 191 capabilities, three levels deep, against a starter
 * that drew the same six invented ones for everybody. Every test here is about *the whole estate
 * arriving* — a map that silently draws some of it is worse than no map, because it looks right.
 */

const cap = (id: string, name: string, parentId: string | null = null): CapabilityNode => ({ id, name, parentId });
const app = (id: string, name: string, capabilityIds: string[]): RealisingApplication => ({ id, name, capabilityIds });

const els = (doc: { elements: Record<string, CanvasElement> }) => Object.values(doc.elements);
const frames = (doc: { elements: Record<string, CanvasElement> }) => els(doc).filter((e) => e.type === "frame");
const cards = (doc: { elements: Record<string, CanvasElement> }) => els(doc).filter((e) => e.type === "card");
const titled = (doc: { elements: Record<string, CanvasElement> }, name: string) =>
  els(doc).find((e) => (e.type === "frame" ? e.title : e.type === "card" ? e.title : "") === name)!;
/** Is `inner` drawn inside `outer`? */
const inside = (inner: CanvasElement, outer: CanvasElement) => {
  if (!("x" in inner) || !("x" in outer)) return false;
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
};

describe("drawing the whole capability map", () => {
  const tree = [
    cap("c1", "Grid Operations"),
    cap("c2", "Metering", "c1"),
    cap("c3", "Meter reading", "c2"),
    cap("c4", "Customer"),
  ];

  it("draws every capability, however deep", () => {
    const doc = capabilityMapFrom({ capabilities: tree, applications: [] });
    for (const c of tree) expect(titled(doc, c.name), `${c.name} is on the board`).toBeTruthy();
  });

  it("puts each one inside the one that contains it", () => {
    const doc = capabilityMapFrom({ capabilities: tree, applications: [] });
    expect(inside(titled(doc, "Metering"), titled(doc, "Grid Operations"))).toBe(true);
    expect(inside(titled(doc, "Meter reading"), titled(doc, "Metering"))).toBe(true);
  });

  it("makes a frame of a capability that holds things and a card of one that does not", () => {
    const doc = capabilityMapFrom({ capabilities: tree, applications: [] });
    expect(titled(doc, "Grid Operations").type).toBe("frame");
    expect(titled(doc, "Meter reading").type).toBe("card");
    expect(titled(doc, "Customer").type).toBe("card");
  });

  it("keeps two top-level capabilities apart", () => {
    const doc = capabilityMapFrom({ capabilities: tree, applications: [] });
    expect(inside(titled(doc, "Customer"), titled(doc, "Grid Operations"))).toBe(false);
  });

  it("puts an application inside the capability it realises", () => {
    const doc = capabilityMapFrom({ capabilities: tree, applications: [app("a1", "Maximo", ["c2"])] });
    expect(inside(titled(doc, "Maximo"), titled(doc, "Metering"))).toBe(true);
  });

  it("draws an application once, however many capabilities it realises", () => {
    /*
     * A second card for the same object would be a second thing claiming to be it — the graph
     * sync would have to guess which one the entity follows.
     */
    const doc = capabilityMapFrom({ capabilities: tree, applications: [app("a1", "SAP", ["c1", "c2", "c4"])] });
    expect(cards(doc).filter((c) => c.type === "card" && c.title === "SAP")).toHaveLength(1);
    const drawn = titled(doc, "SAP");
    expect(drawn.type === "card" && drawn.description).toMatch(/2 other capabilities/);
  });

  it("carries the real entity id, so the board is the model and not a copy of it", () => {
    const doc = capabilityMapFrom({ capabilities: tree, applications: [app("a1", "Maximo", ["c2"])] });
    const drawn = titled(doc, "Maximo");
    expect(drawn.type === "card" && drawn.meta?.entityId).toBe("a1");
    const capability = titled(doc, "Meter reading");
    expect(capability.type === "card" && capability.meta?.entityId).toBe("c3");
  });

  it("leaves out an application that realises nothing", () => {
    const doc = capabilityMapFrom({ capabilities: tree, applications: [app("a9", "Orphan", [])] });
    expect(els(doc).some((e) => e.type === "card" && e.title === "Orphan")).toBe(false);
  });

  it("treats a capability whose parent is not here as a top-level one", () => {
    // A filtered export, or a parent somebody deleted: the object is still real.
    const doc = capabilityMapFrom({ capabilities: [cap("x", "Adrift", "gone")], applications: [] });
    expect(titled(doc, "Adrift")).toBeTruthy();
  });

  it("says how much of the estate it drew", () => {
    const doc = capabilityMapFrom({ capabilities: tree, applications: [app("a1", "Maximo", ["c2"])] });
    const heading = els(doc).find((e) => e.type === "text")!;
    expect(heading.type === "text" && heading.text).toMatch(/4 capabilities/);
    expect(heading.type === "text" && heading.text).toMatch(/1 application/);
  });

  it("grows the frame to hold what is in it", () => {
    const many = [cap("p", "Parent"), ...Array.from({ length: 24 }, (_, i) => cap(`k${i}`, `Child ${i}`, "p"))];
    const doc = capabilityMapFrom({ capabilities: many, applications: [] });
    const parent = titled(doc, "Parent");
    for (let i = 0; i < 24; i++) expect(inside(titled(doc, `Child ${i}`), parent), `child ${i} fits`).toBe(true);
  });

  it("does not overlap two things on the same shelf", () => {
    const many = [cap("p", "Parent"), ...Array.from({ length: 9 }, (_, i) => cap(`k${i}`, `Child ${i}`, "p"))];
    const doc = capabilityMapFrom({ capabilities: many, applications: [] });
    const boxes = cards(doc).filter((c) => "x" in c);
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b || !("x" in a) || !("x" in b)) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.type === "card" ? a.title : ""} and ${b.type === "card" ? b.title : ""} do not overlap`).toBe(false);
      }
    }
  });

  it("draws the same map twice for the same estate", () => {
    const shape = (doc: ReturnType<typeof capabilityMapFrom>) =>
      els(doc).filter((e) => "x" in e).map((e) => ("x" in e ? `${e.type}:${e.x},${e.y},${e.w},${e.h}` : "")).sort().join("|");
    const shuffled = [...tree].reverse();
    expect(shape(capabilityMapFrom({ capabilities: tree, applications: [] })))
      .toBe(shape(capabilityMapFrom({ capabilities: shuffled, applications: [] })));
  });

  it("has something to say about an estate with one capability and nothing else", () => {
    const doc = capabilityMapFrom({ capabilities: [cap("only", "Everything")], applications: [] });
    expect(frames(doc)).toHaveLength(0);
    expect(titled(doc, "Everything").type).toBe("card");
  });
});

describe("a framed capability is the object, not a label (§5.75)", () => {
  it("binds the frame to the entity, so the board's index and the drawer reach it", () => {
    const doc = capabilityMapFrom({
      capabilities: [cap("c1", "Grid Operations"), cap("c2", "Metering", "c1")],
      applications: [],
    });
    const parent = titled(doc, "Grid Operations");
    expect(parent.type).toBe("frame");
    expect(parent.meta?.entityId).toBe("c1");
  });

  it("gives every capability a face on the board, framed or carded", () => {
    // The first version left 44 capabilities on the board as frame titles and nothing else: the
    // map said "Asset Management" and the graph had never heard that it was drawn.
    const tree = [cap("c1", "A"), cap("c2", "B", "c1"), cap("c3", "C", "c2"), cap("c4", "D")];
    const doc = capabilityMapFrom({ capabilities: tree, applications: [] });
    const faces = new Set(els(doc).filter((e) => e.meta?.entityId).map((e) => e.meta!.entityId));
    for (const c of tree) expect(faces.has(c.id), `${c.name} is backed by its entity`).toBe(true);
  });
});
