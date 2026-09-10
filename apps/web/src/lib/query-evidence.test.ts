import { describe, expect, it } from "vitest";
import { parseQuery } from "./query";
import { matchEntities, type QueryWorld } from "./query-match";
import { describeQueryText, evidenceFor, relationsAround } from "./query-evidence";

const entity = (id: string, name: string, kind: string, attributes: Record<string, string> = {}) =>
  ({ id, name, kind, description: "", attributes });

const world = (over: Partial<QueryWorld> = {}): QueryWorld => ({
  entities: [
    entity("crm", "CRM Cloud", "Application", { criticality: "high" }),
    entity("lake", "Data Lake", "IT Component", { criticality: "medium" }),
    entity("erp", "ERP Core", "Application", {}),
    entity("cap", "Billing", "Business Capability", {}),
  ],
  relations: [
    { id: "r1", from: "crm", to: "lake", kind: "sends data to" },
    { id: "r2", from: "erp", to: "lake", kind: "sends data to" },
    { id: "r3", from: "crm", to: "cap", kind: "supports" },
  ],
  boards: new Map(),
  ...over,
});

const ask = (w: QueryWorld, raw: string) => {
  const q = parseQuery(raw);
  return evidenceFor(w, q, matchEntities(w, q).length);
};

describe("a query that matched needs no explaining", () => {
  it("says nothing at all", () => {
    expect(ask(world(), "kind:Application").kind).toBe("none");
  });
});

describe("the subject of the question does not exist", () => {
  it("says the name is not a thing here, rather than that the answer is empty", () => {
    // These are different findings. "No results" reports the second when the first is true.
    const e = ask(world(), "related:Salesforce");
    expect(e.kind).toBe("unknown-seed");
    expect(e.headline).toMatch(/Nothing in this workspace is called “Salesforce”/);
  });

  it("offers the names it might have been", () => {
    const e = ask(world(), "related:CRM");
    // "CRM" is a substring of "CRM Cloud", so the seed resolves and this is not a gap at all.
    expect(e.kind).toBe("none");
    const miss = ask(world(), 'related:"Lake House"');
    expect(miss.kind).toBe("unknown-seed");
    expect(miss.pivots.map((p) => p.label)).toContain("Did you mean Data Lake?");
  });

  it("counts what each suggestion would return, so a dead suggestion is visible as one", () => {
    const e = ask(world(), "related:Lakes");
    const pivot = e.pivots.find((p) => p.label.includes("Data Lake"));
    expect(pivot?.count).toBe(2); // CRM Cloud and ERP Core both point at it
  });
});

describe("the vocabulary of the question does not exist", () => {
  it("says no relationship is called that, and names the ones that are", () => {
    const e = ask(world(), 'related:"Data Lake" rel:blocking');
    expect(e.kind).toBe("unknown-relation");
    expect(e.headline).toMatch(/No relationship in this workspace is called “blocking”/);
    expect(e.pivots.map((p) => p.label)).toContain("via sends data to");
  });

  it("says so plainly when nothing is connected to anything at all", () => {
    const w = world({ relations: [] });
    const e = ask(w, "rel:supports");
    expect(e.kind).toBe("unknown-relation");
    expect(e.detail).toMatch(/Nothing in this workspace is connected/);
  });

  it("suggests only the types that touch the seed, never the workspace's busiest regardless", () => {
    /*
     * Offering four suggestions that all return nothing is worse than offering none: it looks
     * like help and is a dead end four times. Data Lake is only ever the target of "sends data
     * to" — "supports" exists in the estate but not near it, so it must not be offered.
     */
    const e = ask(world(), 'related:"Data Lake" rel:blocking');
    expect(e.pivots.every((p) => p.count > 0)).toBe(true);
    expect(e.pivots.map((p) => p.label)).not.toContain("via supports");
  });

  it("does not fault a relationship name that is merely a substring of a real one", () => {
    expect(ask(world(), 'related:"Data Lake" rel:sends').kind).toBe("none");
  });
});

describe("the type of the question does not exist", () => {
  it("names the kinds the workspace does use, and only those that would return something", () => {
    const e = ask(world(), "kind:Server");
    expect(e.kind).toBe("unknown-kind");
    expect(e.pivots.every((p) => p.count > 0)).toBe(true);
    expect(e.pivots.map((p) => p.label)).toContain("kind Application");
  });

  it("says a declared-but-unused type is not necessarily a mistake", () => {
    expect(ask(world(), "kind:Server").detail).toMatch(/not necessarily wrong/);
  });
});

describe("the model simply has not recorded this", () => {
  it("reports the absence as a fact about the estate, not about the query", () => {
    /*
     * "Data Lake" exists, "supports" exists, and nothing records Data Lake supporting anything.
     * That is the finding worth surfacing — it is where the model is thin.
     */
    const e = ask(world(), 'from:"Data Lake"');
    expect(e.kind).toBe("no-evidence");
    expect(e.detail).toMatch(/absence is in the model/);
  });

  it("offers the other direction when that is where the evidence actually is", () => {
    const e = ask(world(), 'from:"Data Lake"');
    const flip = e.pivots.find((p) => p.label.includes("other direction"));
    expect(flip).toBeDefined();
    expect(flip!.count).toBe(2);
  });

  it("offers the relationship types that do touch the seed, with their weight", () => {
    const e = ask(world(), 'related:"CRM Cloud" rel:"sends data to" kind:"Business Capability"');
    // The pairing is impossible: CRM Cloud sends data only to an IT Component.
    expect(e.pivots.length).toBeGreaterThan(0);
  });

  it("says a thing connected to nothing is connected to nothing, in those words", () => {
    const w = world({ relations: [] });
    const e = ask(w, 'related:"Data Lake"');
    expect(e.kind).toBe("no-evidence");
    expect(e.headline).toMatch(/is not connected to anything/);
    expect(e.pivots).toEqual([]);
  });
});

describe("every condition is fine and the combination is not", () => {
  it("names the condition that, dropped, would return the most", () => {
    const e = ask(world(), "kind:Application criticality:medium");
    expect(e.kind).toBe("over-filtered");
    expect(e.headline).toMatch(/Every condition matches something on its own/);
    const labels = e.pivots.map((p) => p.label);
    expect(labels).toContain("without criticality:medium");
  });

  it("gives each pivot as a runnable query, not as prose", () => {
    const e = ask(world(), "kind:Application criticality:medium");
    const pivot = e.pivots.find((p) => p.label === "without criticality:medium");
    expect(pivot?.query).toBe("kind:Application");
  });

  it("admits when dropping any single condition still returns nothing", () => {
    const e = ask(world(), "kind:Server criticality:nonsense");
    // kind:Server is caught earlier as an unknown kind — the earlier, more specific diagnosis wins.
    expect(e.kind).toBe("unknown-kind");
  });
});

describe("an empty workspace", () => {
  it("is its own answer, and not a fault in the question", () => {
    const e = ask(world({ entities: [], relations: [] }), "kind:Application");
    expect(e.kind).toBe("empty-workspace");
    expect(e.headline).toMatch(/nothing in it yet/);
  });
});

describe("supporting pieces", () => {
  it("counts relationships around a seed by direction", () => {
    const around = relationsAround(world(), new Set(["lake"]));
    expect(around).toEqual([{ kind: "sends data to", direction: "in", count: 2 }]);
  });

  it("renders a query back into text that parses to the same thing", () => {
    const text = "kind:Application related:\"Data Lake\" has:owner";
    const round = describeQueryText(parseQuery(text));
    expect(parseQuery(round)).toEqual(parseQuery(text));
  });

  it("quotes a value with a space so the round trip survives it", () => {
    expect(describeQueryText(parseQuery('related:"Data Lake"'))).toBe('related:"Data Lake"');
  });
});
