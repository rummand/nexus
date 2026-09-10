import { describe, expect, it } from "vitest";
import { inferLayers, nameFor, upwardFlows, type ObservedEdge, type TypeCount } from "./infer";

/**
 * Reading the stack out of the data (§5.58).
 *
 * The property under all of it: the *grouping* must come from the graph and nothing else. A word
 * list may put a name on a band, but it may never decide what is in one — otherwise this is a
 * lookup table wearing the vision's clothes.
 */

const t = (name: string, instances = 1): TypeCount => ({ name, instances });
const e = (from: string, to: string, count: number): ObservedEdge => ({ from, to, count });

describe("reading a stack out of the connections", () => {
  it("puts a kind below the kind that mostly points at it", () => {
    const r = inferLayers([t("Application", 20), t("Server", 8)], [e("Application", "Server", 19)]);
    expect(r.layers.map((l) => l.types)).toEqual([["Application"], ["Server"]]);
    expect(r.layers[1]!.why).toContain("All 19 connections");
  });

  it("uses the dominant direction when the data points both ways", () => {
    const r = inferLayers([t("A"), t("B")], [e("A", "B", 19), e("B", "A", 2)]);
    expect(r.layers.map((l) => l.types)).toEqual([["A"], ["B"]]);
    expect(r.layers[1]!.why).toBe("19 of the 21 connections between this band and the one above run downward.");
  });

  it("says so when the direction rests on a near tie, rather than presenting it as a finding", () => {
    const r = inferLayers([t("A"), t("B")], [e("A", "B", 6), e("B", "A", 5)]);
    expect(r.ambiguous).toEqual([{ from: "A", to: "B", forward: 6, back: 5 }]);
  });

  it("leaves a genuine tie out of the stack rather than picking a side", () => {
    const r = inferLayers([t("A"), t("B")], [e("A", "B", 4), e("B", "A", 4)]);
    expect(r.layers).toEqual([]);
    expect(r.unplaced.map((u) => u.name).sort()).toEqual(["A", "B"]);
  });

  it("builds more than two bands, deepest last", () => {
    const r = inferLayers(
      [t("Capability"), t("Application"), t("Server")],
      [e("Capability", "Application", 9), e("Application", "Server", 12)],
    );
    expect(r.layers.map((l) => l.types)).toEqual([["Capability"], ["Application"], ["Server"]]);
  });

  it("puts two kinds nothing separates in the same band", () => {
    const r = inferLayers(
      [t("Application"), t("Interface"), t("Server")],
      [e("Application", "Server", 8), e("Interface", "Server", 7)],
    );
    expect(r.layers[0]!.types.sort()).toEqual(["Application", "Interface"]);
    expect(r.layers[1]!.types).toEqual(["Server"]);
  });

  it("breaks a cycle by dropping its weakest edge, and says which", () => {
    const r = inferLayers(
      [t("A"), t("B"), t("C")],
      [e("A", "B", 10), e("B", "C", 9), e("C", "A", 2)],
    );
    expect(r.dropped).toEqual([{ from: "C", to: "A", count: 2 }]);
    expect(r.layers.map((l) => l.types)).toEqual([["A"], ["B"], ["C"]]);
  });

  it("reports a kind nothing connects rather than inventing a home for it", () => {
    const r = inferLayers([t("Application", 5), t("Server", 2), t("Vendor", 9)], [e("Application", "Server", 8)]);
    expect(r.unplaced).toEqual([{ name: "Vendor", instances: 9 }]);
    expect(r.layers.flatMap((l) => l.types)).not.toContain("Vendor");
  });

  it("refuses to read a stack from almost nothing", () => {
    const r = inferLayers([t("A"), t("B")], [e("A", "B", 2)]);
    expect(r.confident).toBe(false);
    expect(r.verdict).toContain("too few");
  });

  it("says plainly when nothing connects at all", () => {
    const r = inferLayers([t("A"), t("B")], []);
    expect(r.layers).toEqual([]);
    expect(r.verdict).toMatch(/no stack to read/);
  });

  it("ignores an edge naming a kind the model does not have, and a kind pointing at itself", () => {
    const r = inferLayers([t("A"), t("B")], [e("A", "B", 8), e("A", "Ghost", 40), e("A", "A", 40)]);
    expect(r.observed).toBe(8);
    expect(r.layers.flatMap((l) => l.types)).toEqual(["A", "B"]);
  });

  it("matches kind names case- and space-insensitively, because people type", () => {
    const r = inferLayers([t("Application"), t("Server")], [e("  application ", "SERVER", 8)]);
    expect(r.layers.map((l) => l.types)).toEqual([["Application"], ["Server"]]);
  });
});

describe("what a band gets called", () => {
  it("uses the name an EA team would already argue in", () => {
    expect(nameFor(["Server", "Database"])).toBe("Technology");
    expect(nameFor(["Application", "Microservice"])).toBe("Application");
    expect(nameFor(["Business Process", "Business Actor"])).toBe("Business");
    expect(nameFor(["Goal", "Driver"])).toBe("Motivation");
  });

  it("prefers the longest matching word, so a data object is information rather than a component", () => {
    expect(nameFor(["Data Object"])).toBe("Information");
  });

  it("does not name a band after one type out of many", () => {
    expect(nameFor(["Widget", "Sprocket", "Gizmo", "Server"])).toBe("");
  });

  it("prefers the longest match across the whole word list, not the first layer in it", () => {
    // "IT Component" contains "component", which would make it software; the longer "it component"
    // says infrastructure, and the longer word is the more specific claim.
    expect(nameFor(["IT Component"])).toBe("Technology");
  });

  it("says nothing rather than guessing when it recognises nothing", () => {
    expect(nameFor(["Widget", "Sprocket"])).toBe("");
    expect(nameFor([])).toBe("");
  });

  it("names the band but never decides what is in it", () => {
    // Two kinds the word list would call Technology, but the data puts one above the other.
    const r = inferLayers([t("Server"), t("Database")], [e("Server", "Database", 9)]);
    expect(r.layers).toHaveLength(2);
    expect(r.layers.map((l) => l.types)).toEqual([["Server"], ["Database"]]);
  });
});

describe("the word list may confirm the data's order but never contradict it", () => {
  it("uses the familiar names when the estate stacks the way convention expects", () => {
    const r = inferLayers(
      [t("Business Process", 4), t("Application", 9), t("Server", 6)],
      [e("Business Process", "Application", 11), e("Application", "Server", 14)],
    );
    expect(r.layers.map((l) => l.name)).toEqual(["Business", "Application", "Technology"]);
  });

  it("drops every conventional name, not just the odd one, when the estate disagrees", () => {
    // Here the infrastructure sits above the applications. Calling the top band "Technology" would
    // read as the conventional stack upside down; calling only the middle one "Application" would
    // be worse, because the result still looks conventional and is not.
    const r = inferLayers(
      [t("IT Component", 2), t("Application", 23), t("Data Object", 1)],
      [e("IT Component", "Application", 6), e("Application", "Data Object", 5)],
    );
    expect(r.layers.map((l) => l.name)).toEqual(["IT Component", "Application", "Data Object"]);
  });
});

describe("two bands never end up with the same name", () => {
  it("gives the word to the bigger band and names the other after its own largest type", () => {
    // Both bands would read as "Application" from the word list; a stack cannot say it twice, and
    // a layer name is unique per workspace so it could not even be written down.
    const r = inferLayers(
      [t("Application", 23), t("Microservice", 2)],
      [e("Microservice", "Application", 9)],
    );
    expect(r.layers.map((l) => l.name)).toEqual(["Microservice", "Application"]);
  });

  it("falls back to a numbered band only when even the type name is taken", () => {
    const r = inferLayers([t("Widget", 3), t("Sprocket", 1)], [e("Widget", "Sprocket", 7)]);
    // Neither is in the word list, so both are named after themselves rather than numbered.
    expect(r.layers.map((l) => l.name)).toEqual(["Widget", "Sprocket"]);
  });

  it("produces a set of names a unique index would accept", () => {
    const r = inferLayers(
      [t("Application", 9), t("Component", 4), t("Server", 3), t("Database", 2)],
      [e("Application", "Component", 8), e("Component", "Server", 7), e("Server", "Database", 6)],
    );
    const names = r.layers.map((l) => l.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("where a declared layering disagrees with the estate", () => {
  const layerOf = new Map([
    ["application", { name: "Application", position: 1 }],
    ["server", { name: "Technology", position: 2 }],
    ["capability", { name: "Business", position: 0 }],
  ]);

  it("names a connection that runs up the stack", () => {
    const flows = upwardFlows(layerOf, [e("Server", "Application", 3)]);
    expect(flows).toHaveLength(1);
    expect(flows[0]!.detail).toBe("3 connections run Server → Application, which is Technology reaching up into Application.");
  });

  it("leaves downward and within-band connections alone", () => {
    expect(upwardFlows(layerOf, [e("Application", "Server", 20), e("Capability", "Server", 4)])).toEqual([]);
  });

  it("ignores a kind that has not been put in a layer yet", () => {
    expect(upwardFlows(layerOf, [e("Vendor", "Application", 5)])).toEqual([]);
  });

  it("sums repeats and puts the worst first", () => {
    const flows = upwardFlows(layerOf, [e("Server", "Application", 1), e("Server", "Application", 2), e("Server", "Capability", 9)]);
    expect(flows.map((f) => [f.to, f.count])).toEqual([["Capability", 9], ["Application", 3]]);
  });
});
