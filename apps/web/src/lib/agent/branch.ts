import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import type { Proposal, ProposalAction } from "../graph-types";

/**
 * An agent's work, as a branch (#141, §5.96).
 *
 * **The only autonomy boundary that is actually safe**, and the one that makes a fleet worth
 * having: let agents run continuously — infer owners, spot duplicates, flag the eighty orphans,
 * keep lifecycle in step with the CMDB — and let every one of them arrive as a branch a person
 * reviews as a whole.
 *
 * Four things change the moment an agent has a branch instead of write access:
 *
 * - the permission is trivial to reason about — it may write to its own branch and nowhere else;
 * - its work is reviewable *together*, rather than as two hundred proposals somebody clicks
 *   through one at a time until they stop reading;
 * - an agent that is wrong costs nothing, because the branch is abandoned;
 * - and it can be replayed onto today's estate (§5.94) when `main` moves, which today means
 *   re-running it and losing every decision already taken on its output.
 *
 * What does **not** change, from §5.85: an agent may clear the mechanical part of a campaign and
 * may never validate. Validation is somebody putting their name to it.
 *
 * This is pure: proposals in, changes out, and an honest list of what could not be carried.
 */

export interface Carried {
  changes: Array<Pick<s.ChangeRow, "op" | "entityId" | "relationId"> & { payload: Record<string, unknown>; note: string }>;
  /**
   * Proposals that cannot be expressed as changes, with why. Never silently dropped.
   *
   * Keyed by the proposal's own `key`, which is derived from the change proposed rather than
   * minted per run — so the same finding two runs apart is the same row here.
   */
  left: Array<{ key: string; title: string; why: string }>;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Turn what an agent proposed into what a branch can hold.
 *
 * The interesting cases are the ones that do not map. A merge of two duplicates and a deletion
 * are not change-set operations — the model deliberately has no op for either, because one
 * destroys history and the other is a decision about identity rather than about state. They stay
 * proposals, and the caller is told so rather than finding out by their absence.
 */
export function changesFromProposals(proposals: Proposal[], entities: s.Entity[]): Carried {
  const carried: Carried = { changes: [], left: [] };
  const byId = new Map(entities.map((e) => [e.id, e]));

  const add = (
    op: s.ChangeRow["op"],
    fields: { entityId?: string | null; relationId?: string | null; payload: Record<string, unknown> },
    note: string,
  ) => carried.changes.push({ op, entityId: fields.entityId ?? null, relationId: fields.relationId ?? null, payload: fields.payload, note });

  for (const proposal of proposals) {
    const action: ProposalAction = proposal.action;
    // Every change says why, and the why is the agent's own sentence: a branch of two hundred
    // commits nobody can explain is not reviewable, whoever wrote it.
    const note = proposal.title;

    switch (action.kind) {
      case "setKind":
        add("retypeEntity", { entityId: action.entityId, payload: { kind: action.to } }, note);
        break;

      case "setAttribute":
        add("setAttribute", { entityId: action.entityId, payload: { key: action.key, value: action.to } }, note);
        break;

      case "addRelation":
        add("addRelation", { payload: { fromEntityId: action.fromEntityId, toEntityId: action.toEntityId, kind: action.to } }, note);
        break;

      /*
       * The bulk actions expand: "call every Widget an Application" is a retype per object, which
       * is what makes it reviewable — somebody can see the forty it would touch, and drop the two
       * that are wrong, instead of taking the whole sweep or none of it.
       */
      case "renameKind": {
        const affected = entities.filter((e) => norm(e.kind) === norm(action.from));
        if (!affected.length) { carried.left.push({ key: proposal.key, title: proposal.title, why: `Nothing is a ${action.from} any more.` }); break; }
        for (const entity of affected) add("retypeEntity", { entityId: entity.id, payload: { kind: action.to } }, note);
        break;
      }

      case "renameAttributeValue": {
        const affected = entities.filter((e) => norm(parseAttributes(e.attributes)[action.key] ?? "") === norm(action.from));
        if (!affected.length) { carried.left.push({ key: proposal.key, title: proposal.title, why: `Nothing says “${action.from}” any more.` }); break; }
        for (const entity of affected) add("setAttribute", { entityId: entity.id, payload: { key: action.key, value: action.to } }, note);
        break;
      }

      case "renameAttributeKey": {
        const affected = entities.filter((e) => (parseAttributes(e.attributes)[action.from] ?? "").trim());
        if (!affected.length) { carried.left.push({ key: proposal.key, title: proposal.title, why: `Nothing carries ${action.from} any more.` }); break; }
        for (const entity of affected) {
          const value = parseAttributes(entity.attributes)[action.from] ?? "";
          // Write the new key first, then clear the old: a branch that is reviewed halfway
          // through should never have lost the value.
          add("setAttribute", { entityId: entity.id, payload: { key: action.to, value } }, note);
          add("setAttribute", { entityId: entity.id, payload: { key: action.from, value: "" } }, note);
        }
        break;
      }

      case "merge":
        carried.left.push({
          key: proposal.key, title: proposal.title,
          why: "Merging two objects is a decision about identity, not about state, and a change set has no op for it. It stays a proposal.",
        });
        break;

      case "deleteEntity":
        carried.left.push({
          key: proposal.key, title: proposal.title,
          why: byId.has(action.entityId)
            ? "Deleting destroys the record of something that existed. A plan can retire an object; only a person can delete one."
            : "It is already gone.",
        });
        break;

      case "setRelationKind":
        carried.left.push({
          key: proposal.key, title: proposal.title,
          why: "Retyping a relation is not something a change set can hold yet. It stays a proposal.",
        });
        break;
    }
  }
  return carried;
}

/** What the branch would be called, in the agent's own name. */
export function agentBranchName(agentName: string, when: Date): string {
  const day = when.toISOString().slice(0, 10);
  return `${agentName}, ${day}`.slice(0, 120);
}

/**
 * The rule that must not bend (§5.85, §5.96).
 *
 * An agent may write a branch and may never merge one. Not because an agent's judgement is
 * necessarily worse — on evidence it is often better, since it can cite what it read — but
 * because a model that changes itself while everybody sleeps and cannot say whose decision it
 * was is not a system of record. So an agent-authored branch needs a person's name on it *at
 * all*, even where no MODELOWNERS rule (§5.93) happens to cover what it touches.
 */
export function agentBranchNeedsAHuman(set: { agentId: string | null }, approvals: Array<{ ruleId: string }>): boolean {
  if (!set.agentId) return false;
  return !approvals.some((a) => a.ruleId === HUMAN_SIGN_OFF || a.ruleId === "__override");
}

/** The pseudo-rule a person signs to say they have read an agent's branch. */
export const HUMAN_SIGN_OFF = "__agent_reviewed";

export function agentBranchWords(agentName: string, changes: number, left: number): string {
  const parts = [`${agentName} proposes ${changes} change${changes === 1 ? "" : "s"} on a branch of its own.`];
  if (left) parts.push(`${left} of its findings could not be written as changes and stay proposals.`);
  parts.push("Nothing it says reaches the model until somebody merges it.");
  return parts.join(" ");
}
