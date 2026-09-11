import { describe, expect, it } from "vitest";
import { bands, cards, filterCards, health } from "./metamodel-board";
import type { MetaModel, MetaNodeType, MetaRelationType } from "./metamodel";
import type { Conformance, TypeConformance } from "./metamodel-conformance";

const field = (key: string, declared: boolean) => ({
  id: declared ? `f_${key}` : null, key, dataType: "text", description: "", required: false,
  options: [] as string[], section: "", usage: 3, presence: declared ? ("declared" as const) : ("undeclared" as const),
});

const node = (over: Partial<MetaNodeType> = {}): MetaNodeType => ({
  id: "nt_1", name: "Application", description: "", color: "#f59e0b", parentId: null,
  instances: 23, fields: [field("owner", true)], presence: "declared", framework: "", layerId: null,
  ...over,
});

const rel = (over: Partial<MetaRelationType> = {}): MetaRelationType => ({
  id: "rt_1", name: "uses", description: "", instances: 5,
  rules: [{ id: "r1", fromType: "Application", toType: "IT Component", cardinality: "many" }],
  observedPairs: [], presence: "declared", framework: "", layerId: null,
  ...over,
});

const model = (over: Partial<MetaModel> = {}): MetaModel => ({
  nodeTypes: [node()], relationTypes: [], layers: [],
  totals: { entities: 23, relations: 0, undeclaredNodeTypes: 0, undeclaredRelationTypes: 0, violations: 0 },
  ...over,
});

const conf = (byType: TypeConformance[] = [], over: Partial<Conformance> = {}): Conformance => ({
  breaches: [], byType, score: 100, checked: 23, typed: 100,
  counts: { "kind-undeclared": 0, "field-missing": 0, "field-type": 0, "field-option": 0, "relation-undeclared": 0, "relation-rule": 0 },
  ...over,
});

describe("one card, one nudge", () => {
  it("asks for a declaration before anything else, and counts what is waiting on it", () => {
    // An undeclared type cannot break a rule: there is no rule. So this outranks every complaint.
    const [c] = cards(model({ nodeTypes: [node({ id: null, presence: "undeclared", instances: 23 })] }), conf());
    expect(c!.declared).toBe(false);
    expect(c!.nudge?.kind).toBe("undeclared");
    expect(c!.nudge?.text).toMatch(/23 objects/);
  });

  it("prefers a breach to an undeclared field, because a breach contradicts a decision already made", () => {
    const m = model({ nodeTypes: [node({ fields: [field("owner", true), field("tier", false)] })] });
    const [c] = cards(m, conf([{ name: "Application", kind: "node", instances: 23, offenders: 4, breaches: 7, declared: true }]));
    expect(c!.nudge?.kind).toBe("breaches");
    expect(c!.nudge?.text).toBe("4 objects break the rules here");
  });

  it("says it in the singular when it is one", () => {
    const m = model({ nodeTypes: [node()] });
    const [c] = cards(m, conf([{ name: "Application", kind: "node", instances: 23, offenders: 1, breaches: 1, declared: true }]));
    expect(c!.nudge?.text).toBe("1 object breaks the rules here");
  });

  it("mentions fields the data has and the declaration does not", () => {
    const m = model({ nodeTypes: [node({ fields: [field("owner", true), field("tier", false), field("cost", false)] })] });
    const [c] = cards(m, conf());
    expect(c!.nudge?.kind).toBe("undeclared-fields");
    expect(c!.nudge?.text).toBe("2 fields in the data, not declared");
  });

  it("uses the relation's own words rather than a field's", () => {
    const m = model({
      nodeTypes: [],
      relationTypes: [rel({ observedPairs: [{ fromType: "A", toType: "B", count: 2, declared: false }] })],
    });
    const [c] = cards(m, conf());
    expect(c!.nudge?.text).toBe("1 pairing in the data, no rule allows");
  });

  it("notices a type declared with nothing in it", () => {
    const [c] = cards(model({ nodeTypes: [node({ fields: [] })] }), conf());
    expect(c!.nudge?.kind).toBe("no-fields");
  });

  it("says nothing at all about a type that is fine", () => {
    const [c] = cards(model(), conf());
    expect(c!.nudge).toBeNull();
  });

  it("puts the biggest types first, because the question is what the estate is made of", () => {
    const m = model({
      nodeTypes: [node({ name: "Aardvark", instances: 1 }), node({ name: "Zebra", instances: 40 })],
    });
    expect(cards(m, conf()).map((c) => c.name)).toEqual(["Zebra", "Aardvark"]);
  });
});

describe("the two numbers, and which one is the problem", () => {
  it("names coverage as the constraint when most of the estate is undescribed", () => {
    // The trap this exists to defuse: 100% conformance over 4% of the estate is not a good model.
    const h = health(cards(model(), conf()), conf([], { typed: 12, score: 100 }));
    expect(h.coverage).toBe(12);
    expect(h.verdict).toMatch(/describes 12%/);
    expect(h.verdict).toMatch(/worth more than any rule/);
  });

  it("names the breaches when there are some and coverage is respectable", () => {
    const report = conf([], {
      typed: 90, score: 70,
      breaches: [{ kind: "field-missing", detail: "", subjectId: "e1", subjectName: "X", subject: "entity", typeName: "Application" }],
    });
    expect(health(cards(model(), report), report).verdict).toMatch(/90% of the estate is described, and 70%/);
  });

  it("counts a breach the same way the conformance score does, or the two disagree on screen", () => {
    // Both "nobody declared this kind" and "nobody declared this relation type" are excluded by
    // conformance() itself. Using a different definition here is how one page shows two truths.
    const report = conf([], {
      typed: 56, score: 100,
      breaches: [
        { kind: "kind-undeclared", detail: "", subjectId: "e1", subjectName: "X", subject: "entity", typeName: "Ghost" },
        { kind: "relation-undeclared", detail: "", subjectId: "r1", subjectName: "A → B", subject: "relation", typeName: "owns" },
      ],
    });
    expect(health(cards(model(), report), report).breaches).toBe(0);
  });

  it("does not count an undeclared kind as a broken rule", () => {
    /*
     * The self-contradiction this fixes, seen in the browser: "100% of that obeys the rules. The
     * breaches are listed against the types they belong to." An undeclared kind is a missing
     * rule, not a broken one, and coverage is already the number for it — counting it twice made
     * the two halves of one sentence disagree.
     */
    const report = conf([], {
      typed: 56, score: 100,
      breaches: [{ kind: "kind-undeclared", detail: "", subjectId: "e1", subjectName: "X", subject: "entity", typeName: "Ghost" }],
    });
    const h = health(cards(model(), report), report);
    expect(h.breaches).toBe(0);
    expect(h.verdict).not.toMatch(/breaches are listed/);
  });

  it("says so plainly when there is nothing left to do", () => {
    expect(health(cards(model(), conf()), conf()).verdict).toBe("Every type is declared and the data obeys all of it.");
  });

  it("counts the types with something to do, which is what the filter chip promises", () => {
    const m = model({ nodeTypes: [node(), node({ name: "Ghost", id: null, presence: "undeclared" })] });
    expect(health(cards(m, conf()), conf()).needsAttention).toBe(1);
  });
});

describe("honesty at the edges", () => {
  it("reports conformance as undefined, not perfect, when nothing is described", () => {
    // A model covering none of the estate has nothing conforming and nothing breaking. The ratio
    // of those is not 100% — and a full green bar beside "0% described" is the worst kind of lie,
    // because it is the flattering one.
    const report = conf([], { typed: 0, score: 100, checked: 0 });
    const h = health(cards(model(), report), report);
    expect(h.conformance).toBeNull();
  });

  it("reports it as a number the moment there is anything to divide", () => {
    const report = conf([], { typed: 80, score: 75, checked: 20 });
    expect(health(cards(model(), report), report).conformance).toBe(75);
  });
});

describe("a band says what all of its cards say, once", () => {
  it("hoists a nudge every card shares", () => {
    const m = model({ nodeTypes: [node({ id: null, presence: "undeclared" }), node({ name: "B", id: null, presence: "undeclared" })] });
    const [band] = bands(cards(m, conf()), m, "kind");
    expect(band!.shared?.kind).toBe("undeclared");
    expect(band!.shared?.text).toMatch(/None of these are declared/);
  });

  it("leaves the cards to speak when they disagree", () => {
    const m = model({ nodeTypes: [node({ id: null, presence: "undeclared" }), node({ name: "B" })] });
    const [band] = bands(cards(m, conf()), m, "kind");
    expect(band!.shared).toBeNull();
  });

  it("says nothing for a band of one, where a heading would be longer than the card", () => {
    const m = model({ nodeTypes: [node({ id: null, presence: "undeclared" })] });
    expect(bands(cards(m, conf()), m, "kind")[0]!.shared).toBeNull();
  });
});

describe("filtering and banding", () => {
  const m = model({
    nodeTypes: [node(), node({ name: "Ghost", id: null, presence: "undeclared", instances: 2 })],
    layers: [{ id: "l1", name: "Application", description: "", color: "#f59e0b", position: 1, source: "" }],
  });
  const all = cards(m, conf([{ name: "Application", kind: "node", instances: 23, offenders: 2, breaches: 3, declared: true }]));

  it("searches the name and the description", () => {
    expect(filterCards(all, "ghost", "all").map((c) => c.name)).toEqual(["Ghost"]);
  });

  it("narrows to what needs a person", () => {
    expect(filterCards(all, "", "attention")).toHaveLength(2);
    expect(filterCards(all, "", "undeclared").map((c) => c.name)).toEqual(["Ghost"]);
    expect(filterCards(all, "", "breaches").map((c) => c.name)).toEqual(["Application"]);
    // An undeclared type is never in the breach filter: it has no rules to break.
    expect(filterCards(all, "", "breaches").every((c) => c.declared)).toBe(true);
  });

  it("gives everything one band when nothing is grouping it", () => {
    expect(bands(all, m, "none")).toHaveLength(1);
    expect(bands([], m, "none")).toEqual([]);
  });

  it("bands by layer in the stack's own order, and collects what nobody placed", () => {
    const placed = cards(model({ ...m, nodeTypes: [node({ layerId: "l1" }), node({ name: "Loose" })] }), conf());
    const out = bands(placed, m, "layer");
    expect(out.map((b) => b.id)).toEqual(["l1", "unplaced"]);
    expect(out[1]!.note).toMatch(/read from the data/);
  });

  it("drops a band nothing is in rather than drawing an empty shelf", () => {
    const empty = { ...m, layers: [...m.layers, { id: "l2", name: "Empty", description: "", color: "#ccc", position: 2, source: "" }] };
    expect(bands(all, empty, "layer").some((b) => b.id === "l2")).toBe(false);
  });

  it("bands by kind when asked, and keeps the two halves named as a reader would name them", () => {
    const both = cards(model({ nodeTypes: [node()], relationTypes: [rel()] }), conf());
    expect(bands(both, m, "kind").map((b) => b.label)).toEqual(["Object types", "Relationship types"]);
  });
});
