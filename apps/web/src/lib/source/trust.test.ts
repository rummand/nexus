import { describe, expect, it } from "vitest";
import { defaultTrust, owns, routeOf, splitByRoute, splitWords, type SourceTrust, type Standing } from "./trust";
import type { ImportIntent } from "@/lib/import/plan";

/**
 * The two rules of #139, which are the whole governance model: ceremony for what is new or
 * contested, silence for what is routine. Every case here is a way one of the two goes wrong.
 */

const intent = (op: ImportIntent["op"], over: Partial<ImportIntent> = {}): ImportIntent => ({
  op, entityId: "ent_1", relationId: "", payload: {}, from: "", fresh: false, name: "Maximo", ...over,
});

const SERVICENOW: SourceTrust = { id: "snow", name: "ServiceNow", owns: ["lifecycle", "hosting"] };
const KNOWN: Standing = { reconciled: () => true };
const STRANGER: Standing = { reconciled: () => false };

describe("who owns what", () => {
  it("matches a field however it is spaced or cased", () => {
    expect(owns({ ...SERVICENOW, owns: ["Business Owner"] }, "business  owner")).toBe(true);
  });
  it("a star owns everything, which is a thing to narrow rather than leave", () => {
    expect(owns({ ...SERVICENOW, owns: ["*"] }, "anything at all")).toBe(true);
  });
  it("owning nothing is the default for a block somebody pasted", () => {
    expect(defaultTrust("paste", "p", "Pasted").owns).toEqual([]);
  });
});

describe("rule one: anything new lands on a branch", () => {
  it("holds a new object, whatever the source is trusted with", () => {
    const r = routeOf(intent("addEntity", { name: "Kafka Bridge", fresh: true }), { ...SERVICENOW, owns: ["*"] }, KNOWN);
    expect(r.route).toBe("branch");
    expect(r.why).toContain("is new");
  });

  it("holds a connection, because structure is a modelling claim", () => {
    expect(routeOf(intent("addRelation", { name: "A → B" }), { ...SERVICENOW, owns: ["*"] }, KNOWN).route).toBe("branch");
  });

  it("holds a field on an object nobody has reconciled", () => {
    const r = routeOf(intent("setAttribute", { payload: { key: "lifecycle", value: "live" } }), SERVICENOW, STRANGER);
    expect(r.route).toBe("branch");
    expect(r.why).toContain("reconciled");
  });
});

describe("rule two: a known object's new values flow straight through", () => {
  it("lets the owner write its own field on a reconciled object", () => {
    const r = routeOf(intent("setAttribute", { payload: { key: "lifecycle", value: "retired" } }), SERVICENOW, KNOWN);
    expect(r.route).toBe("through");
    expect(r.why).toContain("Routine");
  });

  it("refuses a field the source does not own, however well known the object is", () => {
    const r = routeOf(intent("setAttribute", { payload: { key: "business owner", value: "Finance" } }), SERVICENOW, KNOWN);
    expect(r.route).toBe("branch");
    expect(r.why).toContain("not the owner");
  });

  it("says so when a routine update overwrites something somebody validated", () => {
    const sealed: Standing = { reconciled: () => true, sealed: () => true };
    const r = routeOf(intent("setAttribute", { payload: { key: "lifecycle", value: "retired" } }), SERVICENOW, sealed);
    expect(r.route).toBe("through");
    expect(r.breaksSeal).toBe(true);
    expect(r.why).toContain("validated");
  });
});

describe("what a source may not decide on its own", () => {
  it("holds a retype unless the source is trusted with what things are", () => {
    expect(routeOf(intent("retypeEntity", { payload: { kind: "Platform" } }), SERVICENOW, KNOWN).route).toBe("branch");
    expect(routeOf(intent("retypeEntity", { payload: { kind: "Platform" } }), { ...SERVICENOW, ownsKind: true }, KNOWN).route).toBe("through");
  });

  it("holds a move unless the source owns the tree — which an EA repository does", () => {
    expect(routeOf(intent("setParent", { payload: { parentId: "ent_2" } }), SERVICENOW, KNOWN).route).toBe("branch");
    const leanix = defaultTrust("EA repository", "lx", "LeanIX");
    expect(leanix.ownsPlace).toBe(true);
    expect(routeOf(intent("setParent", { payload: { parentId: "ent_2" } }), leanix, KNOWN).route).toBe("through");
  });
});

describe("splitting a whole batch", () => {
  const batch = [
    intent("addEntity", { entityId: "ent_new", name: "Kafka Bridge", fresh: true }),
    intent("setAttribute", { payload: { key: "lifecycle", value: "retired" } }),
    intent("setAttribute", { payload: { key: "hosting", value: "Azure" } }),
    intent("setAttribute", { payload: { key: "business owner", value: "Finance" } }),
  ];

  it("sends the routine half through and holds the rest", () => {
    const split = splitByRoute(batch, SERVICENOW, KNOWN);
    expect(split.through).toHaveLength(2);
    expect(split.branch).toHaveLength(2);
    expect(split.routed).toHaveLength(4);
  });

  it("says it in one sentence somebody can agree to at a glance", () => {
    expect(splitWords(splitByRoute(batch, SERVICENOW, KNOWN)))
      .toBe("2 routine updates land; 2 claims wait on a branch.");
  });

  it("counts the seals it would break, before it breaks them", () => {
    const split = splitByRoute(batch, SERVICENOW, { reconciled: () => true, sealed: (_, key) => key === "lifecycle" });
    expect(split.seals).toBe(1);
    expect(splitWords(split)).toContain("1 validated value would be overwritten.");
  });

  it("holds everything when the source owns nothing, which is what a pasted block is", () => {
    const split = splitByRoute(batch, defaultTrust("paste", "p", "Pasted"), KNOWN);
    expect(split.through).toHaveLength(0);
    expect(splitWords(split)).toBe("4 claims wait on a branch.");
  });

  it("says nothing to do when there is nothing to do", () => {
    expect(splitWords(splitByRoute([], SERVICENOW, KNOWN))).toBe("Nothing to do.");
  });
});
