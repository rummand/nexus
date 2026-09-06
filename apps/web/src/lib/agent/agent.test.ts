import { describe, expect, it } from "vitest";
import { sample } from "./propose";
import { validateProposals, type AgentGraph } from "./validate";

/**
 * The model is not here, and that is the point.
 *
 * Everything that decides whether a model's answer is safe is pure and sits in `validate.ts`, so
 * the interesting half of the agent is tested against fixture answers — including the answers a
 * model gets wrong, which is the half that matters. If these tests pass, no reply the model can
 * compose reaches the database without a person clicking.
 */

const entity = (id: string, name: string, kind = "Application", description = "", attributes: Record<string, string> = {}) =>
  ({ id, kind, name, description, attributes });

const GRAPH: AgentGraph = {
  entities: [
    entity("ent_a", "Maximo", "Application", "Work-order management for field maintenance.", { owner: "Asset Management" }),
    entity("ent_b", "SCADA", "Application", "Supervisory control for the transmission grid.", {}),
    entity("ent_c", "PI Server", "", "The process historian. Stores tag data from SCADA.", {}),
    entity("ent_d", "Data lake", "Data Object", "Curated views for reporting.", { owner: "Data Platform" }),
    entity("ent_e", "Historian", "Applications", "Process historian.", {}),
  ],
  relations: [{ id: "rel_1", fromEntityId: "ent_a", toEntityId: "ent_d", kind: "feeds" }],
};

const one = (fields: Record<string, unknown>) => ({ proposals: [fields] });

describe("what the model is allowed to claim", () => {
  it("accepts a typing proposal that quotes the object's own words", () => {
    const { proposals, rejected } = validateProposals(
      one({ change: "setKind", entityId: "ent_c", to: "Application", why: "It is a running system, not a document.", readFrom: "ent_c", quote: "The process historian" }),
      GRAPH,
    );
    expect(rejected).toEqual([]);
    expect(proposals[0]).toMatchObject({
      type: "untyped",
      action: { kind: "setKind", entityId: "ent_c", to: "Application" },
      source: "agent",
    });
    expect(proposals[0]!.evidence![0]).toContain("The process historian");
  });

  it("throws away a claim it cannot quote, and says so", () => {
    const { proposals, rejected } = validateProposals(
      one({ change: "setKind", entityId: "ent_c", to: "Application", why: "Obviously an application.", readFrom: "ent_c", quote: "runs on Kubernetes in Frankfurt" }),
      GRAPH,
    );
    expect(proposals).toEqual([]);
    expect(rejected[0]).toMatch(/quoted words that “PI Server” does not say/);
  });

  it("throws away a claim about an object that does not exist", () => {
    const { proposals, rejected } = validateProposals(
      one({ change: "setKind", entityId: "ent_nope", to: "Application", why: "It is one.", readFrom: "ent_nope", quote: "a system" }),
      GRAPH,
    );
    expect(proposals).toEqual([]);
    expect(rejected[0]).toMatch(/not in this graph/);
  });

  it("refuses a verb it does not have", () => {
    const { proposals, rejected } = validateProposals(
      one({ change: "deleteEntity", entityId: "ent_a", why: "It is out of support.", readFrom: "ent_a", quote: "Work-order management" }),
      GRAPH,
    );
    expect(proposals).toEqual([]);
    expect(rejected[0]).toMatch(/is not something the agent can propose/);
  });

  it("insists on a reason, because a proposal nobody can judge is not reviewable", () => {
    const { rejected } = validateProposals(
      one({ change: "setKind", entityId: "ent_c", to: "Application", readFrom: "ent_c", quote: "process historian" }),
      GRAPH,
    );
    expect(rejected[0]).toMatch(/no reason given/);
  });
});

describe("keeping the vocabulary", () => {
  it("snaps a kind onto the spelling the workspace already uses", () => {
    const { proposals } = validateProposals(
      one({ change: "setKind", entityId: "ent_c", to: "application", why: "It is a running system.", readFrom: "ent_c", quote: "process historian" }),
      GRAPH,
    );
    expect(proposals[0]!.action).toMatchObject({ kind: "setKind", to: "Application" });
  });

  it("says plainly when a proposed kind would be a new one", () => {
    const { proposals } = validateProposals(
      one({ change: "setKind", entityId: "ent_c", to: "Technology Service", why: "Infrastructure, not an app.", readFrom: "ent_c", quote: "process historian" }),
      GRAPH,
    );
    expect(proposals[0]!.detail).toMatch(/would be a new kind/);
  });

  it("renames a kind only when the workspace really spells it that way", () => {
    const good = validateProposals(
      one({ change: "renameKind", from: "Applications", to: "Application", why: "One vocabulary.", readFrom: "ent_e", quote: "Applications" }),
      GRAPH,
    );
    expect(good.proposals[0]).toMatchObject({ type: "kind", action: { kind: "renameKind", from: "Applications", to: "Application" } });
    expect(good.proposals[0]!.entityIds).toEqual(["ent_e"]);

    const bad = validateProposals(
      one({ change: "renameKind", from: "Componenta", to: "Component", why: "Typo.", readFrom: "ent_e", quote: "Applications" }),
      GRAPH,
    );
    expect(bad.rejected[0]).toMatch(/a kind this workspace does not use/);
  });
});

describe("relations the model would draw", () => {
  it("proposes one, keeping the relation vocabulary", () => {
    const { proposals } = validateProposals(
      one({ change: "addRelation", fromEntityId: "ent_c", toEntityId: "ent_b", relationKind: "feeds", why: "The historian stores SCADA's tags.", readFrom: "ent_c", quote: "Stores tag data from SCADA" }),
      GRAPH,
    );
    expect(proposals[0]).toMatchObject({
      type: "newRelation",
      title: "PI Server feeds SCADA",
      action: { kind: "addRelation", fromEntityId: "ent_c", toEntityId: "ent_b", to: "feeds" },
    });
  });

  it("does not propose a relation that is already drawn, in either direction", () => {
    const forward = validateProposals(
      one({ change: "addRelation", fromEntityId: "ent_a", toEntityId: "ent_d", relationKind: "feeds", why: "It does.", readFrom: "ent_a", quote: "Work-order management" }),
      GRAPH,
    );
    const back = validateProposals(
      one({ change: "addRelation", fromEntityId: "ent_d", toEntityId: "ent_a", relationKind: "feeds", why: "It does.", readFrom: "ent_a", quote: "Work-order management" }),
      GRAPH,
    );
    expect(forward.rejected[0]).toMatch(/already connected/);
    expect(back.rejected[0]).toMatch(/already connected/);
  });

  it("refuses a relation from something to itself", () => {
    const { rejected } = validateProposals(
      one({ change: "addRelation", fromEntityId: "ent_a", toEntityId: "ent_a", relationKind: "feeds", why: "Loop.", readFrom: "ent_a", quote: "Work-order management" }),
      GRAPH,
    );
    expect(rejected[0]).toMatch(/to itself/);
  });
});

describe("attributes", () => {
  it("fills a blank, quoting what it read", () => {
    const { proposals } = validateProposals(
      one({ change: "setAttribute", entityId: "ent_b", key: "owner", to: "Grid Operations", why: "Its description says it is the transmission grid's.", readFrom: "ent_b", quote: "Supervisory control for the transmission grid" }),
      GRAPH,
    );
    expect(proposals[0]).toMatchObject({ type: "attributeMissing", action: { kind: "setAttribute", entityId: "ent_b", key: "owner", to: "Grid Operations" } });
    // same key as the rule-derived version, so a dismissal covers both
    expect(proposals[0]!.key).toBe("attrmissing:ent_b:owner");
  });

  it("will not overwrite an answer somebody already gave", () => {
    const { proposals, rejected } = validateProposals(
      one({ change: "setAttribute", entityId: "ent_a", key: "owner", to: "IT", why: "IT runs it.", readFrom: "ent_a", quote: "Work-order management" }),
      GRAPH,
    );
    expect(proposals).toEqual([]);
    expect(rejected[0]).toMatch(/already says owner is “Asset Management”/);
  });
});

describe("how much a model's opinion is worth", () => {
  it("never returns high confidence, so a model's guess is never bulk-accepted", () => {
    const { proposals } = validateProposals(
      { proposals: [
        { change: "setKind", entityId: "ent_c", to: "Application", why: "A system.", readFrom: "ent_c", quote: "process historian", confidence: "high" },
        { change: "addRelation", fromEntityId: "ent_c", toEntityId: "ent_b", relationKind: "feeds", why: "It does.", readFrom: "ent_c", quote: "Stores tag data from SCADA", confidence: "high" },
      ] },
      GRAPH,
    );
    expect(proposals.map((p) => p.confidence)).toEqual(["medium", "medium"]);
  });

  it("treats a merge as the irreversible thing it is", () => {
    const { proposals } = validateProposals(
      one({ change: "merge", survivorId: "ent_c", otherIds: ["ent_e"], why: "PI Server is the product; Historian is what people call it.", readFrom: "ent_c", quote: "The process historian", confidence: "medium" }),
      GRAPH,
    );
    expect(proposals[0]).toMatchObject({ type: "merge", confidence: "low", key: "merge:ent_c,ent_e" });
    expect(proposals[0]!.detail).toMatch(/cannot be undone/);
  });

  it("drops a proposal somebody has already decided on, and its own duplicates", () => {
    const claim = { change: "setKind", entityId: "ent_c", to: "Application", why: "A system.", readFrom: "ent_c", quote: "process historian" };
    const twice = validateProposals({ proposals: [claim, claim] }, GRAPH);
    expect(twice.proposals).toHaveLength(1);

    const decided = validateProposals({ proposals: [claim] }, GRAPH, new Set(["untyped:ent_c"]));
    expect(decided.proposals).toEqual([]);
  });

  it("survives a model that answers with rubbish", () => {
    expect(validateProposals(null, GRAPH).rejected).toEqual(["the model returned nothing usable"]);
    expect(validateProposals({}, GRAPH).rejected).toEqual(["the model returned no proposals"]);
    expect(validateProposals({ proposals: ["nonsense", 7, null] }, GRAPH).proposals).toEqual([]);
  });
});

describe("a graph too big to send", () => {
  it("goes whole when it fits", () => {
    expect(sample(GRAPH).sampled).toBe(false);
  });

  it("keeps the objects most worth looking at when it does not", () => {
    const many: AgentGraph = {
      entities: [
        ...Array.from({ length: 500 }, (_, i) => entity(`ent_${i}`, `System ${i}`, "Application", "", { owner: "x" })),
        entity("ent_untyped", "Mystery box", "", "Nobody knows."),
      ],
      relations: [],
    };
    const { graph, sampled } = sample(many);
    expect(sampled).toBe(true);
    expect(graph.entities).toHaveLength(400);
    expect(graph.entities.map((e) => e.id)).toContain("ent_untyped");
  });
});
