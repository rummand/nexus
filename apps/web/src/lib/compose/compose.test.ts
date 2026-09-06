import { afterEach, describe, expect, it } from "vitest";
import { parseLine, parseScript, toQuery, type Vocabulary } from "./script";
import { applyInstruction, matchEntities, runScript, type ComposeContext } from "./apply";
import { validateInstructions } from "./validate";
import { describeInstruction } from "./run";
import { modelConfigured, modelStatus, planWithModel } from "./llm";
import { runInspection, validateInspection } from "./inspect";
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

describe("what the planner is allowed to return", () => {
  it("accepts the instruction set and rejects everything else", () => {
    const { instructions, rejected } = validateInstructions([
      { verb: "add", query: "kind:Application", limit: 5 },
      { verb: "connect", relationKinds: ["depends on"] },
      { verb: "layout", style: "flow" },
      { verb: "delete_all_entities" },
      { verb: "add" },
      { verb: "fetch", url: "https://example.com" },
      "not an object",
    ], vocab);
    expect(instructions.map((i) => i.verb)).toEqual(["add", "connect", "layout"]);
    expect(rejected).toHaveLength(4);
    expect(rejected.join(" ")).toContain("delete_all_entities");
  });

  it("clamps what a planner could otherwise inflate", () => {
    const { instructions } = validateInstructions([
      { verb: "add", query: "kind:Application", limit: 999999 },
      { verb: "expand", hops: 400 },
    ], vocab);
    expect(instructions[0]).toMatchObject({ verb: "add", limit: 200 });
    expect(instructions[1]).toMatchObject({ verb: "expand", hops: 4 });
  });

  it("snaps proposed values onto what the workspace actually has", () => {
    const { instructions } = validateInstructions([
      { verb: "group", by: "Lifecycle" },
      { verb: "connect", relationKinds: ["depends"] },
      { verb: "layout", style: "spiral" },
    ], vocab);
    expect(instructions[0]).toMatchObject({ by: "lifecycle", isAttribute: true });
    expect(instructions[1]).toMatchObject({ relationKinds: ["depends on"] });
    expect(instructions[2]).toMatchObject({ style: "grid" }); // an unknown style is not a crash
  });

  it("keeps a plan short enough to be a board", () => {
    const many = Array.from({ length: 40 }, () => ({ verb: "connect" }));
    const { instructions, rejected } = validateInstructions(many, vocab);
    expect(instructions).toHaveLength(24);
    expect(rejected.join(" ")).toContain("first 24");
  });

  it("writes an instruction back as the line a person would have typed", () => {
    expect(describeInstruction({ verb: "add", query: "kind:Application", limit: 60 })).toBe("add kind:Application");
    expect(describeInstruction({ verb: "expand", hops: 2, relationKinds: ["depends on"], direction: "in" })).toBe("expand 2 hops via depends on upstream");
    expect(describeInstruction({ verb: "layout", style: "columns", by: "lifecycle" })).toBe("lay out as columns by lifecycle");
  });
});

describe("choosing a planner", () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it("uses the model only when both the key and the model are set", () => {
    process.env = { ...env, ANTHROPIC_API_KEY: "", NEXUS_MODEL: "" };
    expect(modelConfigured()).toBe(false);
    expect(modelStatus()).toContain("ANTHROPIC_API_KEY and NEXUS_MODEL");

    process.env = { ...env, ANTHROPIC_API_KEY: "k", NEXUS_MODEL: "" };
    expect(modelConfigured()).toBe(false);
    expect(modelStatus()).toContain("NEXUS_MODEL");
    expect(modelStatus()).not.toContain("ANTHROPIC_API_KEY");

    process.env = { ...env, ANTHROPIC_API_KEY: "k", NEXUS_MODEL: "m" };
    expect(modelConfigured()).toBe(true);
    expect(modelStatus()).toBe("");
  });

  it("refuses to plan without configuration rather than calling anything", async () => {
    process.env = { ...env, ANTHROPIC_API_KEY: "", NEXUS_MODEL: "" };
    await expect(planWithModel("anything", { vocabulary: vocab, sampleNames: [], onBoard: 0, graph: ctx })).rejects.toThrow(/no model configured/);
  });
});

describe("what the planner may look at", () => {
  it("counts, samples and reads attribute values", () => {
    expect(runInspection(ctx, { op: "kinds" }).text).toContain("Application: 3");
    expect(runInspection(ctx, { op: "count", query: "kind:Application" }).text).toBe("3 entities match kind:Application");

    const sample = runInspection(ctx, { op: "sample", query: "kind:Application", limit: 2 });
    expect(sample.text).toContain("Maximo");
    expect(sample.text).toContain("owner: Grid Operations");
    expect(sample.label).toContain("3 match");

    // the answer to "which have no owner?" is now something it can read rather than guess
    const values = runInspection(ctx, { op: "values", attribute: "owner", query: "kind:Application" });
    expect(values.text).toContain("Grid Operations: 2");
    expect(values.text).toContain("1 have none");
  });

  it("reads a neighbourhood and the relation types", () => {
    expect(runInspection(ctx, { op: "neighbours", name: "Maximo" }).text).toContain("Maximo —depends on→ SCADA");
    expect(runInspection(ctx, { op: "neighbours", name: "Nothing here" }).text).toContain("nothing here is called");
    expect(runInspection(ctx, { op: "relations" }).text).toContain("depends on: 2");
  });

  it("refuses an inspection it does not offer, rather than guessing", () => {
    expect(validateInspection({ op: "exfiltrate", query: "*" })).toBeNull();
    expect(validateInspection({ op: "count" })).toBeNull(); // no query
    expect(validateInspection({ op: "sample", query: "kind:Application", limit: 9999 })).toMatchObject({ limit: 40 });
    expect(validateInspection("kinds")).toBeNull();
  });

  it("bounds what one look can return", () => {
    const many: ComposeContext = {
      relations: [],
      entities: Array.from({ length: 200 }, (_, i) => ({ id: `x${i}`, kind: "Application", name: `App ${i}`, description: "", attributes: {}, boards: [] })),
    };
    const sample = runInspection(many, { op: "sample", query: "kind:Application", limit: 40 });
    expect(sample.text.split("\n").length).toBeLessThanOrEqual(42);
    expect(sample.text).toContain("200 match");
  });
});

describe("laying a board out on a timeline", () => {
  const vocab = { kinds: ["Application"], relationKinds: [], attributeKeys: ["end of support", "owner"] };

  it("reads the axis and the lanes out of the sentence", () => {
    const line = parseLine("lay out on a timeline by end of support in lanes by owner", vocab);
    expect(line.instruction).toEqual({ verb: "layout", style: "timeline", by: "end of support", lanes: "owner" });
    expect(line.echo).toBe("Lay it out on a timeline by end of support in lanes by owner");
  });

  it("takes the shorter forms people write", () => {
    expect(parseLine("lay out over time by end of support", vocab).instruction).toMatchObject({ style: "timeline", by: "end of support" });
    expect(parseLine("arrange as a roadmap by end of support lanes by kind", vocab).instruction).toMatchObject({ style: "timeline", lanes: "kind" });
  });

  it("says what is missing rather than laying out nothing", () => {
    // an unreadable line becomes an "unknown" instruction carrying the hint, as every other does
    const line = parseLine("lay out on a timeline", vocab);
    expect(line.instruction).toMatchObject({ verb: "unknown" });
    expect(line.echo).toMatch(/needs a date/);
  });

  it("still understands the layouts that were there before", () => {
    expect(parseLine("lay out as flow", vocab).instruction).toEqual({ verb: "layout", style: "flow", by: undefined });
    expect(parseLine("lay out in columns by owner", vocab).instruction).toEqual({ verb: "layout", style: "columns", by: "owner" });
  });
});
