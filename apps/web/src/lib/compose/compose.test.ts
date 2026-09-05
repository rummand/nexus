import { describe, expect, it } from "vitest";
import { parseLine, parseScript, toQuery, type Vocabulary } from "./script";
import { applyInstruction, matchEntities, runScript, type ComposeContext } from "./apply";
import { emptyDocument, type CanvasDocument, type CardElement } from "@/canvas/document";

const vocab: Vocabulary = {
  kinds: ["Application", "Business Capability", "IT Component", "Person"],
  relationKinds: ["depends on", "supports", "sends data to"],
  attributeKeys: ["owner", "lifecycle", "criticality", "capability"],
};

const ctx: ComposeContext = {
  entities: [
    { id: "a", kind: "Application", name: "Maximo", description: "asset management", attributes: { owner: "Grid Operations", lifecycle: "end of life" }, boards: ["Landscape"] },
    { id: "b", kind: "Application", name: "SCADA", description: "", attributes: { owner: "Grid Operations" }, boards: [] },
    { id: "c", kind: "Application", name: "Billing", description: "", attributes: { lifecycle: "live" }, boards: [] },
    { id: "d", kind: "Business Capability", name: "Metering", description: "", attributes: {}, boards: [] },
    { id: "e", kind: "Person", name: "Mette Lund", description: "", attributes: {}, boards: [] },
  ],
  relations: [
    { id: "r1", from: "a", to: "b", kind: "depends on" },
    { id: "r2", from: "c", to: "b", kind: "depends on" },
    { id: "r3", from: "a", to: "d", kind: "supports" },
  ],
};

const cards = (doc: CanvasDocument) => Object.values(doc.elements).filter((el): el is CardElement => el.type === "card");
const names = (doc: CanvasDocument) => cards(doc).map((c) => c.title).sort();
const line = (raw: string) => parseLine(raw, vocab);

describe("compiling English into the query grammar", () => {
  it("resolves a spoken kind to one the workspace uses", () => {
    expect(toQuery("all applications", vocab).query).toBe("kind:Application");
    expect(toQuery("business capabilities", vocab).query).toBe('kind:"Business Capability"');
  });

  it("reads relation phrases as relation clauses", () => {
    expect(toQuery("everything that depends on SCADA", vocab).query).toBe('to:SCADA rel:"depends on"');
    expect(toQuery("anything connected to Maximo", vocab).query).toBe("related:Maximo");
  });

  it("reads attribute phrases", () => {
    expect(toQuery("applications owned by Grid Operations", vocab).query).toBe('owner:"Grid Operations" kind:Application');
    expect(toQuery("applications without an owner", vocab).query).toBe("missing:owner kind:Application");
  });

  it("lets the grammar itself pass straight through, mixed with English", () => {
    expect(toQuery("applications criticality:high", vocab).query).toBe("kind:Application criticality:high");
  });
});

describe("the script parser", () => {
  it("understands the verbs", () => {
    expect(line("add all applications").instruction).toMatchObject({ verb: "add", query: "kind:Application" });
    expect(line("remove people").instruction).toMatchObject({ verb: "remove", query: "kind:Person" });
    expect(line("connect them").instruction).toMatchObject({ verb: "connect", relationKinds: [] });
    expect(line('connect via "depends on"').instruction).toMatchObject({ verb: "connect", relationKinds: ["depends on"] });
    expect(line("expand 2 hops").instruction).toMatchObject({ verb: "expand", hops: 2 });
    expect(line("group by lifecycle").instruction).toMatchObject({ verb: "group", by: "lifecycle", isAttribute: true });
    expect(line("group by kind").instruction).toMatchObject({ verb: "group", by: "kind", isAttribute: false });
    expect(line("lay out as flow").instruction).toMatchObject({ verb: "layout", style: "flow" });
    expect(line("lay out in columns by lifecycle").instruction).toMatchObject({ verb: "layout", style: "columns", by: "lifecycle" });
    expect(line("title Metering landscape").instruction).toMatchObject({ verb: "title", text: "Metering landscape" });
    expect(line("clear").instruction).toMatchObject({ verb: "clear" });
  });

  it("says what it understood, and admits when it does not", () => {
    expect(line("add all applications").echo).toContain("kind:Application");
    const bad = line("make it look nice");
    expect(bad.instruction.verb).toBe("unknown");
    expect(bad.echo).toContain("add, remove, expand");
  });

  it("ignores bullets, numbering and comments", () => {
    expect(parseScript("# a comment\n- add applications\n2. connect them\n\n", vocab)).toHaveLength(2);
    expect(parseScript("- add applications", vocab)[0]!.instruction).toMatchObject({ verb: "add" });
  });
});

describe("matching", () => {
  it("finds by kind, attribute, relation and absence", () => {
    expect(matchEntities(ctx, "kind:Application").map((e) => e.name).sort()).toEqual(["Billing", "Maximo", "SCADA"]);
    expect(matchEntities(ctx, 'to:SCADA rel:"depends on"').map((e) => e.name).sort()).toEqual(["Billing", "Maximo"]);
    expect(matchEntities(ctx, "missing:owner kind:Application").map((e) => e.name)).toEqual(["Billing"]);
    expect(matchEntities(ctx, "on:Landscape").map((e) => e.name)).toEqual(["Maximo"]);
  });

  it("matches nothing when the query has no clause — an empty ask is a mistake", () => {
    expect(matchEntities(ctx, "")).toEqual([]);
  });
});

describe("building a board from a script", () => {
  const build = (text: string) => runScript(emptyDocument(), ctx, parseScript(text, vocab).map((l) => l.instruction));

  it("writes a board that nobody dragged", () => {
    const { document, results } = build(`
      title Metering landscape
      add all applications
      connect them
      lay out as flow
    `);
    expect(names(document)).toEqual(["Billing", "Maximo", "SCADA"]);
    expect(Object.values(document.elements).filter((el) => el.type === "connector")).toHaveLength(2);
    expect(Object.values(document.elements).some((el) => el.type === "text" && el.title === "Metering landscape")).toBe(true);
    expect(results.every((r) => r.ok)).toBe(true);
    // flow put the thing everything depends on below its dependants
    const byName = new Map(cards(document).map((c) => [c.title, c]));
    expect(byName.get("SCADA")!.y).toBeGreaterThan(byName.get("Maximo")!.y);
  });

  it("is reproducible: the same script gives the same board, coordinates included", () => {
    const script = "add all applications\ngroup by lifecycle";
    const first = build(script).document;
    const second = build(script).document;
    const shape = (d: CanvasDocument) => cards(d).map((c) => `${c.title}@${c.x},${c.y}`).sort();
    expect(shape(first)).toEqual(shape(second));
  });

  it("expands from what is already there", () => {
    const { document } = build("add Maximo\nexpand 1 hop");
    expect(names(document)).toEqual(["Maximo", "Metering", "SCADA"]);
  });

  it("removes, and takes the dangling connectors with it", () => {
    const { document } = build("add all applications\nconnect them\nremove Billing");
    expect(names(document)).toEqual(["Maximo", "SCADA"]);
    expect(Object.values(document.elements).filter((el) => el.type === "connector")).toHaveLength(1);
  });

  it("groups into frames, and re-grouping does not stack them", () => {
    const once = build("add all applications\ngroup by lifecycle").document;
    const twice = build("add all applications\ngroup by lifecycle\ngroup by lifecycle").document;
    const frames = (d: CanvasDocument) => Object.values(d.elements).filter((el) => el.type === "frame");
    expect(frames(once).length).toBeGreaterThan(1);
    expect(frames(twice)).toHaveLength(frames(once).length);
  });

  it("reports a line that did nothing rather than pretending", () => {
    const { results } = build("add all databases");
    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.message).toContain("nothing matched");
  });

  it("clear empties the board", () => {
    const { document } = build("add all applications\nclear");
    expect(Object.keys(document.elements)).toHaveLength(0);
  });

  it("wraps a wide layout instead of drawing a single sixty-card row", () => {
    const many: ComposeContext = {
      relations: [],
      entities: Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, kind: "Application", name: `App ${i}`, description: "", attributes: {}, boards: [] })),
    };
    const { document } = runScript(emptyDocument(), many, parseScript("add all applications\nlay out as flow", vocab).map((l) => l.instruction));
    const placed = cards(document);
    const rows = new Set(placed.map((c) => c.y));
    expect(rows.size).toBeGreaterThan(1);
    expect(new Set(placed.map((c) => c.x)).size).toBeLessThanOrEqual(8);
  });

  it("caps how much one line may place", () => {
    const many: ComposeContext = {
      relations: [],
      entities: Array.from({ length: 80 }, (_, i) => ({ id: `x${i}`, kind: "Application", name: `App ${i}`, description: "", attributes: {}, boards: [] })),
    };
    const { document, results } = runScript(emptyDocument(), many, [parseLine("add all applications", vocab).instruction]);
    expect(cards(document)).toHaveLength(60);
    expect(results[0]!.message).toContain("not placed");
  });
});

describe("one instruction at a time", () => {
  it("leaves the document it was given untouched", () => {
    const doc = emptyDocument();
    const { document } = applyInstruction(doc, ctx, { verb: "add", query: "kind:Application", limit: 10 });
    expect(Object.keys(doc.elements)).toHaveLength(0);
    expect(Object.keys(document.elements)).toHaveLength(3);
  });
});
