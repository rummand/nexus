import { describe, expect, it } from "vitest";
import { approvalsRequired, becauseWords, maySign, outstandingWords, overrideWords, standingOf, type OwnerRule, type Touched } from "./owners";

/**
 * Who has to agree (#141, §5.93). Every case here is a way governance goes wrong in practice:
 * ownership that stops working when somebody adds a level, a domain lead shadowing a team, an
 * approval standing mistaken for write permission, and a rule with no way through.
 */

/** Grid Services › Metering › Meter reading, plus an application nobody has placed. */
const TREE = [
  { id: "cap_grid", parentId: null },
  { id: "cap_metering", parentId: "cap_grid" },
  { id: "cap_reading", parentId: "cap_metering" },
  { id: "app_loose", parentId: null },
];

const rule = (over: Partial<OwnerRule> = {}): OwnerRule => ({
  id: "r1", scope: "subtree", scopeValue: "cap_grid", userId: "u_jes", teamId: null,
  scopeLabel: "Grid Services", ownerLabel: "Jes Olesen", ...over,
});

const touched = (entityId: string, name: string, kind = "Capability"): Touched => ({ entityId, name, kind });

describe("which owners a branch has to ask", () => {
  it("asks nobody when nobody owns anything", () => {
    expect(approvalsRequired([touched("cap_reading", "Meter reading")], [], TREE)).toEqual([]);
  });

  it("asks the owner of a subtree about something two levels inside it", () => {
    const required = approvalsRequired([touched("cap_reading", "Meter reading")], [rule()], TREE);
    expect(required).toHaveLength(1);
    expect(required[0]!.rule.ownerLabel).toBe("Jes Olesen");
    expect(required[0]!.because.map((t) => t.name)).toEqual(["Meter reading"]);
  });

  it("asks the owner about the root of their own subtree", () => {
    expect(approvalsRequired([touched("cap_grid", "Grid Services")], [rule()], TREE)).toHaveLength(1);
  });

  it("does not ask them about something outside it", () => {
    expect(approvalsRequired([touched("app_loose", "Maximo", "Application")], [rule()], TREE)).toEqual([]);
  });

  it("keeps working when somebody inserts a level in the middle", () => {
    const deeper = [...TREE, { id: "cap_new", parentId: "cap_reading" }];
    expect(approvalsRequired([touched("cap_new", "Remote reads")], [rule()], deeper)).toHaveLength(1);
  });

  it("asks the owner of a type, wherever the object sits", () => {
    const byKind = rule({ id: "r2", scope: "kind", scopeValue: "Application", scopeLabel: "every Application", ownerLabel: "The platform team" });
    expect(approvalsRequired([touched("app_loose", "Maximo", "Application")], [byKind], TREE)).toHaveLength(1);
  });

  it("matches a type however it is cased", () => {
    const byKind = rule({ id: "r2", scope: "kind", scopeValue: "application", scopeLabel: "every Application", ownerLabel: "X" });
    expect(approvalsRequired([touched("app_loose", "Maximo", "Application")], [byKind], TREE)).toHaveLength(1);
  });

  it("puts the narrowest rule first, because that is the one somebody will chase", () => {
    const all = rule({ id: "r_all", scope: "everything", scopeValue: "", scopeLabel: "the whole model", ownerLabel: "The architecture board" });
    const required = approvalsRequired([touched("cap_reading", "Meter reading")], [all, rule()], TREE);
    expect(required.map((r) => r.rule.scope)).toEqual(["subtree", "everything"]);
  });

  it("asks one owner once, however many of their objects a branch touches", () => {
    const required = approvalsRequired(
      [touched("cap_metering", "Metering"), touched("cap_reading", "Meter reading")],
      [rule()],
      TREE,
    );
    expect(required).toHaveLength(1);
    expect(required[0]!.because).toHaveLength(2);
  });
});

describe("what is still outstanding", () => {
  const required = approvalsRequired([touched("cap_reading", "Meter reading")], [rule()], TREE);

  it("waits, and names who it is waiting for", () => {
    const standing = standingOf(required, []);
    expect(standing.satisfied).toBe(false);
    expect(outstandingWords(standing)).toBe("Waiting for Jes Olesen.");
  });

  it("is satisfied once that owner has signed", () => {
    const standing = standingOf(required, [{ ruleId: "r1", byName: "Jes Olesen", at: "2026-09-11" }]);
    expect(standing.satisfied).toBe(true);
    expect(outstandingWords(standing)).toContain("Approved by its owner");
  });

  it("says plainly when nobody owns what a branch touches", () => {
    expect(outstandingWords(standingOf([], []))).toBe("Nobody owns what this touches, so nobody has to agree.");
  });

  it("explains to an owner why they are being asked", () => {
    expect(becauseWords(required[0]!)).toBe('Jes Olesen owns Grid Services; this touches “Meter reading”.');
  });
});

describe("who may sign, which is not who may write", () => {
  it("lets the named person sign, and nobody else", () => {
    expect(maySign(rule(), { userId: "u_jes", teamIds: [] })).toBe(true);
    expect(maySign(rule(), { userId: "u_someone", teamIds: ["t_ea"] })).toBe(false);
  });

  it("lets any member of an owning team sign", () => {
    const team = rule({ userId: null, teamId: "t_ea" });
    expect(maySign(team, { userId: "u_anyone", teamIds: ["t_ea"] })).toBe(true);
    expect(maySign(team, { userId: "u_anyone", teamIds: ["t_other"] })).toBe(false);
  });

  it("refuses a rule that names nobody rather than letting anybody sign it", () => {
    expect(maySign(rule({ userId: null, teamId: null }), { userId: "u_jes", teamIds: ["t_ea"] })).toBe(false);
  });
});

describe("the override", () => {
  it("says whose name is on it and what was skipped", () => {
    const standing = standingOf(approvalsRequired([touched("cap_reading", "Meter reading")], [rule()], TREE), []);
    expect(overrideWords(standing, "Jane Doe")).toBe("Jane Doe merged this without waiting for Jes Olesen.");
  });
});
