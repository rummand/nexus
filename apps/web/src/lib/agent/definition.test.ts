import { describe, expect, it } from "vitest";
import {
  checkDefinition,
  describeScope,
  parseBudget,
  parseVerbs,
  permits,
  VERBS,
  type DefinitionContext,
  type DefinitionInput,
} from "./definition";
import { validateProposals, type AgentGraph } from "./validate";

/**
 * What an agent is allowed to be.
 *
 * These are the rules a person will one day have to defend to a security review, so they are
 * tested as rules rather than as form validation. The refusals matter more than the acceptances:
 * every one of them is a way a fleet becomes unaccountable, and each is cheap to prevent here and
 * expensive to notice later.
 */

const ctx: DefinitionContext = { teamIds: new Set(["team_ea", "team_ops"]), providerIds: new Set(["mdl_1"]) };

const input = (over: Partial<DefinitionInput> = {}): DefinitionInput => ({
  name: "Vocabulary reviewer",
  purpose: "Find objects whose kind is spelled two ways and say which spelling the workspace uses.",
  ownerTeamId: "team_ea",
  scope: "kind:Application",
  verbs: ["renameKind"],
  ...over,
});

describe("describing an agent", () => {
  it("accepts a definition with a name, a purpose, an owner, a scope and a verb", () => {
    const check = checkDefinition(input(), ctx);
    expect(check.ok).toBe(true);
    expect(check.value).toMatchObject({ name: "Vocabulary reviewer", scope: "kind:Application", verbs: ["renameKind"] });
  });

  it("refuses an agent with no scope, because reading everything by default is how a fleet stops being accountable", () => {
    const check = checkDefinition(input({ scope: "  " }), ctx);
    expect(check.ok).toBe(false);
    expect(check.errors.join(" ")).toMatch(/what it may read/);
  });

  it("refuses an agent nobody owns", () => {
    expect(checkDefinition(input({ ownerTeamId: null }), ctx).errors.join(" ")).toMatch(/owner/);
    expect(checkDefinition(input({ ownerTeamId: "team_nope" }), ctx).errors.join(" ")).toMatch(/not in this workspace/);
  });

  it("refuses an agent that would run, cost money and have nothing it may say", () => {
    expect(checkDefinition(input({ verbs: [] }), ctx).ok).toBe(false);
    expect(checkDefinition(input({ verbs: ["deleteEverything"] }), ctx).ok).toBe(false);
  });

  it("refuses a purpose too thin to judge it against", () => {
    expect(checkDefinition(input({ purpose: "check stuff" }), ctx).errors.join(" ")).toMatch(/in a sentence/);
  });

  it("warns about merging rather than refusing it", () => {
    const check = checkDefinition(input({ verbs: ["merge"] }), ctx);
    expect(check.ok).toBe(true);
    expect(check.warnings.join(" ")).toMatch(/hard to unpick/);
  });

  it("starts a new agent in draft, whatever it was asked for", () => {
    expect(checkDefinition(input(), ctx).value.status).toBe("draft");
    expect(checkDefinition(input({ status: "active" }), ctx).value.status).toBe("active");
    expect(checkDefinition(input({ status: "emperor" }), ctx).value.status).toBe("draft");
  });

  it("clamps a budget rather than believing it", () => {
    expect(checkDefinition(input({ budget: { runsPerDay: 100000, maxProposals: 900 } }), ctx).value.budget)
      .toEqual({ runsPerDay: 96, maxProposals: 40 });
    expect(checkDefinition(input({ budget: { runsPerDay: 0 } }), ctx).value.budget.runsPerDay).toBe(1);
  });

  it("only lets it name a provider that is configured here", () => {
    expect(checkDefinition(input({ providerId: "mdl_1" }), ctx).ok).toBe(true);
    expect(checkDefinition(input({ providerId: "mdl_someone_elses" }), ctx).ok).toBe(false);
  });
});

describe("an agent proposing an agent", () => {
  const parent: DefinitionContext = { ...ctx, parentVerbs: ["setKind", "setAttribute"], parentBudget: { runsPerDay: 4, maxProposals: 10 } };

  it("may hand on what it has", () => {
    expect(checkDefinition(input({ verbs: ["setKind"], budget: { runsPerDay: 2, maxProposals: 5 } }), parent).ok).toBe(true);
  });

  it("may not hand on what it does not have — otherwise this is privilege escalation with a friendly name", () => {
    const check = checkDefinition(input({ verbs: ["setKind", "merge"] }), parent);
    expect(check.ok).toBe(false);
    expect(check.errors.join(" ")).toMatch(/may not grant that/);
  });

  it("may not be given a bigger budget than its parent", () => {
    expect(checkDefinition(input({ verbs: ["setKind"], budget: { runsPerDay: 40 } }), parent).errors.join(" ")).toMatch(/4 times a day/);
    expect(checkDefinition(input({ verbs: ["setKind"], budget: { maxProposals: 30 } }), parent).errors.join(" ")).toMatch(/at most 10 proposals/);
  });
});

describe("reading a row written by an older version", () => {
  it("keeps the verbs it recognises and drops the rest", () => {
    expect(parseVerbs('["setKind","fly","merge","setKind"]')).toEqual(["setKind", "merge"]);
    expect(parseVerbs("not json")).toEqual([]);
  });

  it("repairs a budget rather than trusting or discarding it", () => {
    expect(parseBudget('{"runsPerDay":3}')).toEqual({ runsPerDay: 3, maxProposals: 15 });
    expect(parseBudget("{}")).toEqual({ runsPerDay: 12, maxProposals: 15 });
    expect(parseBudget('{"runsPerDay":-4,"maxProposals":4000}')).toEqual({ runsPerDay: 1, maxProposals: 40 });
  });
});

describe("the verbs an agent was given", () => {
  const GRAPH: AgentGraph = {
    entities: [
      { id: "ent_a", kind: "", name: "PI Server", description: "The process historian.", attributes: {} },
      { id: "ent_b", kind: "Applications", name: "Historian", description: "Process historian.", attributes: {} },
    ],
    relations: [],
  };

  it("throws away a proposal the agent may not make, and says so out loud", () => {
    const { proposals, rejected } = validateProposals(
      { proposals: [{ change: "merge", survivorId: "ent_a", otherIds: ["ent_b"], why: "Same product.", readFrom: "ent_a", quote: "process historian" }] },
      GRAPH,
      new Set(),
      ["setKind"],
    );
    expect(proposals).toEqual([]);
    expect(rejected.join(" ")).toMatch(/may not propose that/);
  });

  it("lets through the ones it may make", () => {
    const { proposals } = validateProposals(
      { proposals: [{ change: "setKind", entityId: "ent_a", to: "Application", why: "It is a running system.", readFrom: "ent_a", quote: "process historian" }] },
      GRAPH,
      new Set(),
      ["setKind"],
    );
    expect(proposals).toHaveLength(1);
  });

  it("permits an action only when it is in the list", () => {
    expect(permits(["setKind"], { kind: "setKind", entityId: "e", to: "Application" })).toBe(true);
    expect(permits(["setKind"], { kind: "merge", survivorId: "a", otherIds: ["b"] })).toBe(false);
    // Something outside the five is never permitted, however the list is written.
    expect(permits([...VERBS], { kind: "deleteEntity", entityId: "e" })).toBe(false);
  });
});

describe("saying what a scope means", () => {
  it("reads a query back as a sentence, so the form can show it before anything runs", () => {
    expect(describeScope("kind:Application missing:owner")).toMatch(/kind “Application”/);
    expect(describeScope("kind:Application missing:owner")).toMatch(/no “owner”/);
  });
});
