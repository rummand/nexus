import { describe, expect, it } from "vitest";
import { validateSuggestions } from "./suggest";
import type { DefinitionContext } from "./definition";

/**
 * An agent proposing an agent.
 *
 * This is the feature that would be irresponsible without tests, so the tests are written as the
 * rules rather than as coverage. The one that matters most is capability monotonicity: if a narrow
 * agent can hand its child a verb it does not have itself, "agents building agents" is privilege
 * escalation with a friendly name, and every other safeguard in the fleet is decoration.
 */

const narrow: DefinitionContext = {
  teamIds: new Set(["team_ea"]),
  providerIds: new Set(),
  parentVerbs: ["setAttribute"],
  parentBudget: { runsPerDay: 4, maxProposals: 10 },
};

const good = {
  name: "Interface ownership",
  purpose: "Every interface should say who runs it. Find the ones that do not and propose an owner from the object's own words.",
  scope: "kind:Interface missing:owner",
  verbs: ["setAttribute"],
  why: "Eleven interfaces have no owner and no agent reads interfaces.",
};

const review = (agents: unknown[], ctx = narrow, existing: string[] = []) =>
  validateSuggestions({ agents }, ctx, "team_ea", existing);

describe("what an agent may suggest", () => {
  it("accepts one that stays inside what its parent can do", () => {
    const { suggested, rejected } = review([good]);
    expect(rejected).toEqual([]);
    expect(suggested).toHaveLength(1);
    expect(suggested[0]!.input).toMatchObject({ name: "Interface ownership", verbs: ["setAttribute"], ownerTeamId: "team_ea" });
    // Nobody has approved it, so it is not an agent yet and cannot run.
    expect(suggested[0]!.input.status).toBe("proposed");
  });

  it("refuses a verb its parent does not have", () => {
    const { suggested, rejected } = review([{ ...good, name: "Duplicate hunter", verbs: ["merge"] }]);
    expect(suggested).toEqual([]);
    expect(rejected.join(" ")).toMatch(/may not grant that/);
  });

  it("gives a child no more budget than its parent has", () => {
    const { suggested } = review([good]);
    expect(suggested[0]!.input.budget).toEqual({ runsPerDay: 4, maxProposals: 10 });
  });

  it("refuses one that gives no reason from this model", () => {
    expect(review([{ ...good, why: "" }]).rejected.join(" ")).toMatch(/no reason/);
  });

  it("refuses one with no scope, like any other agent", () => {
    expect(review([{ ...good, scope: "" }]).rejected.join(" ")).toMatch(/what it may read/);
  });

  it("will not propose an agent that already exists", () => {
    const { suggested, rejected } = review([good], narrow, ["interface ownership"]);
    expect(suggested).toEqual([]);
    expect(rejected.join(" ")).toMatch(/already an agent by that name/);
  });

  it("will not propose the same agent twice in one answer", () => {
    expect(review([good, good]).suggested).toHaveLength(1);
  });

  it("takes at most six, and survives rubbish", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...good, name: `Agent ${i}` }));
    expect(review(many).suggested.length).toBeLessThanOrEqual(6);
    expect(validateSuggestions(null, narrow, "team_ea", []).rejected.join(" ")).toMatch(/nothing usable/);
    expect(validateSuggestions({ agents: "no" }, narrow, "team_ea", []).rejected.join(" ")).toMatch(/no agents/);
  });

  it("keeps the reason where a person will read it", () => {
    // The run that produced it is one of many by the time somebody looks; "why does this exist" is
    // the only question that matters then.
    expect(review([good]).suggested[0]!.why).toMatch(/Eleven interfaces/);
  });
});
