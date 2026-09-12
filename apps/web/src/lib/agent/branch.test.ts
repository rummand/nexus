import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { agentBranchNeedsAHuman, agentBranchWords, changesFromProposals, HUMAN_SIGN_OFF } from "./branch";
import type { Proposal, ProposalAction } from "../graph-types";

/**
 * An agent's work as a branch (#141, §5.96), and the boundary that must not bend.
 */

const entity = (id: string, name: string, kind = "Application", attributes: Record<string, string> = {}): s.Entity =>
  ({ id, workspaceId: "ws", kind, name, description: "", attributes: JSON.stringify(attributes), parentId: null, source: "agent", createdAt: "", updatedAt: "" }) as s.Entity;

const proposal = (key: string, action: ProposalAction, title = key): Proposal =>
  ({ key, type: "kind", confidence: "high", title, detail: "", entityIds: [], action });

describe("what an agent's findings become on a branch", () => {
  it("carries a retype", () => {
    const { changes } = changesFromProposals([proposal("p1", { kind: "setKind", entityId: "a", to: "Platform" })], []);
    expect(changes).toEqual([{ op: "retypeEntity", entityId: "a", relationId: null, payload: { kind: "Platform" }, note: "p1" }]);
  });

  it("carries an attribute and a connection", () => {
    const { changes } = changesFromProposals([
      proposal("p1", { kind: "setAttribute", entityId: "a", key: "owner", to: "Grid Ops" }),
      proposal("p2", { kind: "addRelation", fromEntityId: "a", toEntityId: "b", to: "depends on" }),
    ], []);
    expect(changes.map((c) => c.op)).toEqual(["setAttribute", "addRelation"]);
    expect(changes[1]!.payload).toEqual({ fromEntityId: "a", toEntityId: "b", kind: "depends on" });
  });

  it("carries the agent's own sentence onto every change it writes", () => {
    const { changes } = changesFromProposals([proposal("p1", { kind: "setKind", entityId: "a", to: "Platform" }, "Maximo looks like a Platform")], []);
    expect(changes[0]!.note).toBe("Maximo looks like a Platform");
  });

  it("expands a sweep into one change per object, so it can be reviewed object by object", () => {
    const estate = [entity("a", "A", "Widget"), entity("b", "B", "Widget"), entity("c", "C", "Application")];
    const { changes } = changesFromProposals([proposal("p1", { kind: "renameKind", from: "Widget", to: "Application" })], estate);
    expect(changes).toHaveLength(2);
    expect(changes.every((c) => c.op === "retypeEntity")).toBe(true);
  });

  it("expands an attribute-value sweep the same way", () => {
    const estate = [entity("a", "A", "Application", { lifecycle: "live" }), entity("b", "B", "Application", { lifecycle: "Live" })];
    const { changes } = changesFromProposals([proposal("p1", { kind: "renameAttributeValue", key: "lifecycle", from: "live", to: "production" })], estate);
    expect(changes).toHaveLength(2);
  });

  it("writes the new key before clearing the old one, so a half-read branch has not lost the value", () => {
    const estate = [entity("a", "A", "Application", { "biz owner": "Finance" })];
    const { changes } = changesFromProposals([proposal("p1", { kind: "renameAttributeKey", from: "biz owner", to: "business owner" })], estate);
    expect(changes.map((c) => c.payload)).toEqual([
      { key: "business owner", value: "Finance" },
      { key: "biz owner", value: "" },
    ]);
  });

  it("says so when a sweep would touch nothing, rather than writing an empty branch", () => {
    const { changes, left } = changesFromProposals([proposal("p1", { kind: "renameKind", from: "Widget", to: "Application" })], []);
    expect(changes).toHaveLength(0);
    expect(left[0]!.why).toContain("Nothing is a Widget any more");
  });
});

describe("what an agent may not put on a branch", () => {
  it("leaves a merge as a proposal: identity is not state", () => {
    const { changes, left } = changesFromProposals([proposal("p1", { kind: "merge", survivorId: "a", otherIds: ["b"] })], []);
    expect(changes).toHaveLength(0);
    expect(left[0]!.why).toContain("decision about identity");
  });

  it("leaves a deletion as a proposal: a plan may retire, only a person may delete", () => {
    const { left } = changesFromProposals([proposal("p1", { kind: "deleteEntity", entityId: "a" })], [entity("a", "A")]);
    expect(left[0]!.why).toContain("only a person can delete one");
  });

  it("leaves a relation retype as a proposal, because no op holds it yet", () => {
    const { left } = changesFromProposals([proposal("p1", { kind: "setRelationKind", relationId: "r", to: "feeds" })], []);
    expect(left[0]!.why).toContain("not something a change set can hold");
  });

  it("never drops a finding silently: everything is either carried or explained", () => {
    const proposals = [
      proposal("p1", { kind: "setKind", entityId: "a", to: "Platform" }),
      proposal("p2", { kind: "merge", survivorId: "a", otherIds: ["b"] }),
    ];
    const { changes, left } = changesFromProposals(proposals, []);
    expect(changes.length + left.length).toBe(proposals.length);
  });
});

describe("the boundary that must not bend", () => {
  it("an agent's branch needs a person's name on it", () => {
    expect(agentBranchNeedsAHuman({ agentId: "ag_1" }, [])).toBe(true);
  });

  it("…and is satisfied once somebody has read it", () => {
    expect(agentBranchNeedsAHuman({ agentId: "ag_1" }, [{ ruleId: HUMAN_SIGN_OFF }])).toBe(false);
  });

  it("an owner's approval is not the same thing as having read the machine's work", () => {
    expect(agentBranchNeedsAHuman({ agentId: "ag_1" }, [{ ruleId: "own_grid" }])).toBe(true);
  });

  it("a branch a person wrote needs nothing of the kind", () => {
    expect(agentBranchNeedsAHuman({ agentId: null }, [])).toBe(false);
  });

  it("says what it proposes, and that none of it has landed", () => {
    expect(agentBranchWords("Duplicate finder", 12, 3))
      .toBe("Duplicate finder proposes 12 changes on a branch of its own. 3 of its findings could not be written as changes and stay proposals. Nothing it says reaches the model until somebody merges it.");
  });
});
