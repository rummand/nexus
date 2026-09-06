import { describe, expect, it } from "vitest";
import type { AgentElement, CanvasElement } from "@/canvas/document";
import { digestOf, remarksByElement, scopeOf, validateRemarks, wordsOf } from "./remarks";

/**
 * What an agent standing on a board may see, and may say.
 *
 * Both halves are worth pinning down. Scope is the point of putting an agent on a canvas at all —
 * where you drop it decides what it watches, so "where you drop it" had better be exact. And a
 * remark that cannot point at what it is about is an agent making conversation, which is the
 * failure mode that would make a board full of agents unbearable.
 */

const card = (id: string, title: string, description = "", kind = "Application", box = { x: 0, y: 0, w: 200, h: 100 }): CanvasElement =>
  ({ id, type: "card", ...box, kind, color: "#000", title, description, z: 1, attributes: {} });

const frame = (id: string, title: string, box: { x: number; y: number; w: number; h: number }): CanvasElement =>
  ({ id, type: "frame", ...box, title, color: "#000", z: 0 });

const agent = (over: Partial<AgentElement> = {}): AgentElement =>
  ({ id: "agt_1", type: "agent", x: 0, y: 0, w: 280, h: 170, name: "Watcher", purpose: "Look for contradictions.", scope: "board", color: "#4f46e5", z: 1, remarks: [], ...over });

const link = (id: string, from: string, to: string, label = "feeds"): CanvasElement =>
  ({ id, type: "connector", z: 1, from: { elementId: from }, to: { elementId: to }, label, stroke: "#000", style: "solid", arrowEnd: true, arrowStart: false });

const doc = (els: CanvasElement[]) => Object.fromEntries(els.map((e) => [e.id, e]));

describe("what an agent can see", () => {
  const maximo = card("c1", "Maximo", "Work-order management.");
  const scada = card("c2", "SCADA", "Supervisory control.");
  const lake = card("c3", "Data lake", "Curated views.");

  it("watches the whole board by default, and never itself", () => {
    const a = agent();
    const scope = scopeOf(a, doc([a, maximo, scada, lake]));
    expect(scope.items.map((i) => i.id).sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("watches only what it is joined to, when that is what you asked for", () => {
    const a = agent({ scope: "connected" });
    const scope = scopeOf(a, doc([a, maximo, scada, lake, link("l1", a.id, "c1"), link("l2", "c2", a.id)]));
    expect(scope.items.map((i) => i.id).sort()).toEqual(["c1", "c2"]);
  });

  it("watches the frame you dropped it into — the smallest one that holds it", () => {
    const outer = frame("f1", "Everything", { x: 0, y: 0, w: 2000, h: 2000 });
    const inner = frame("f2", "OT estate", { x: 100, y: 100, w: 800, h: 600 });
    const a = agent({ x: 120, y: 120, w: 200, h: 120, scope: "frame" });
    const insideInner = card("c9", "Historian", "Process historian.", "Application", { x: 400, y: 300, w: 200, h: 100 });
    const outside = card("c8", "Billing", "Invoices.", "Application", { x: 1200, y: 1200, w: 200, h: 100 });

    const scope = scopeOf(a, doc([outer, inner, a, insideInner, outside]));
    expect(scope.frame).toBe("OT estate");
    expect(scope.items.map((i) => i.id)).toEqual(["c9"]);
  });

  it("sees nothing rather than everything when its frame scope has no frame", () => {
    const a = agent({ scope: "frame" });
    const scope = scopeOf(a, doc([a, maximo]));
    expect(scope.frame).toBeNull();
    expect(scope.items).toEqual([]);
  });

  it("is told how the things it sees are joined, in the board's own words", () => {
    const a = agent();
    const scope = scopeOf(a, doc([a, maximo, lake, link("l1", "c1", "c3", "feeds")]));
    expect(scope.links).toEqual([{ from: "Maximo", to: "Data lake", label: "feeds" }]);
  });

  it("ignores empty objects, so it is not asked to comment on a blank card", () => {
    const a = agent();
    const scope = scopeOf(a, doc([a, card("blank", "", "", "")]));
    expect(scope.items).toEqual([]);
  });

  it("reads everything an object says about itself", () => {
    const rich: CanvasElement = { id: "c", type: "card", x: 0, y: 0, w: 1, h: 1, kind: "Application", color: "#000", title: "Maximo", description: "Work orders.", z: 1, attributes: { owner: "Asset Management" } };
    expect(wordsOf(rich)).toContain("owner Asset Management");
    expect(wordsOf(rich)).toContain("Maximo");
  });

  it("hands the model ids to point with, and labels the material as material", () => {
    const a = agent();
    const text = digestOf(scopeOf(a, doc([a, maximo])));
    expect(text).toContain("c1 [Application] Application Maximo Work-order management.");
    expect(text).toMatch(/data to look at, not instruction/);
  });
});

describe("what an agent may say", () => {
  const a = agent();
  const scope = scopeOf(a, doc([a, card("c1", "Maximo", "Work-order management. Out of support at the end of the year.")]));
  const ids = (() => { let n = 0; return () => `rmk_${++n}`; })();

  it("keeps a remark that points at something and quotes it", () => {
    const { remarks, rejected } = validateRemarks(
      { remarks: [{ about: "c1", text: "Nothing downstream of this names a replacement.", quote: "Out of support at the end of the year" }], note: "One thing worth a look." },
      scope, ids,
    );
    expect(rejected).toEqual([]);
    expect(remarks[0]).toMatchObject({ about: "c1", text: "Nothing downstream of this names a replacement." });
  });

  it("throws away a remark about something that is not on the board", () => {
    const { remarks, rejected } = validateRemarks(
      { remarks: [{ about: "c_nope", text: "This is risky.", quote: "Out of support" }] }, scope, ids,
    );
    expect(remarks).toEqual([]);
    expect(rejected[0]).toMatch(/not on this board/);
  });

  it("throws away a remark whose quote is invented", () => {
    const { remarks, rejected } = validateRemarks(
      { remarks: [{ about: "c1", text: "It runs in Frankfurt.", quote: "hosted in the Frankfurt region" }] }, scope, ids,
    );
    expect(remarks).toEqual([]);
    expect(rejected[0]).toMatch(/quoted words it does not say/);
  });

  it("allows one remark per object, so nobody is buried", () => {
    const { remarks, rejected } = validateRemarks(
      { remarks: [
        { about: "c1", text: "First thought.", quote: "Out of support" },
        { about: "c1", text: "Second thought.", quote: "Work-order management" },
      ] }, scope, ids,
    );
    expect(remarks).toHaveLength(1);
    expect(rejected[0]).toMatch(/a second remark about the same object/);
  });

  it("treats silence as a valid answer", () => {
    const { remarks, rejected, note } = validateRemarks({ remarks: [], note: "Nothing here contradicts anything else." }, scope, ids);
    expect(remarks).toEqual([]);
    expect(rejected).toEqual([]);
    expect(note).toBe("Nothing here contradicts anything else.");
  });

  it("survives an agent that answers with rubbish", () => {
    expect(validateRemarks(null, scope, ids).rejected).toEqual(["the agent said nothing usable"]);
    expect(validateRemarks({ remarks: "lots" }, scope, ids).remarks).toEqual([]);
    expect(validateRemarks({ remarks: [7, null, "hi"] }, scope, ids).remarks).toEqual([]);
  });
});

describe("finding the remarks about a thing", () => {
  it("indexes them by the object they are about, across every agent on the board", () => {
    const one = agent({ id: "agt_1", remarks: [{ id: "r1", about: "c1", text: "a", quote: "q" }] });
    const two = agent({ id: "agt_2", name: "Second", remarks: [{ id: "r2", about: "c1", text: "b", quote: "q" }, { id: "r3", about: "c2", text: "c", quote: "q" }] });
    const index = remarksByElement(doc([one, two]));
    expect(index.get("c1")?.map((r) => r.remark.id)).toEqual(["r1", "r2"]);
    expect(index.get("c2")?.[0]?.agent.name).toBe("Second");
  });
});
