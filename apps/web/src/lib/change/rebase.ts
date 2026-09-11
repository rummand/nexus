import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import type { AddEntityPayload, AddRelationPayload, Change, RetypeEntityPayload, SetAttributePayload, SetParentPayload } from "./types";

/**
 * Replaying a plan onto today's estate (#140, §5.94).
 *
 * The chronic problem with a target architecture is that reality moves underneath it and nobody
 * notices until the plan is fiction. Git's answer is to rebase: replay the work onto what `main`
 * says now, and whatever no longer applies shows up. *That application you planned to retire in
 * 2027 was decommissioned last month* is a conflict, and a conflict is a prompt.
 *
 * It is free once plans are branches, and it makes the definition of progress exact: **a plan is
 * finished when its diff against `main` is empty.** Reality arrives through the sources (§5.92),
 * the plan is rebased onto it, and what is left in the diff is precisely the work still to do.
 * No percentage-complete field that somebody updates by feel.
 *
 * Three verdicts, and the middle one is the whole point:
 *
 * - **outstanding** — it still has to happen. This is the plan.
 * - **landed** — reality already says this. Not a failure and not a conflict: it is the plan
 *   coming true, usually by somebody else's hand, and it should leave the branch quietly.
 * - **conflicted** — reality moved somewhere the plan cannot be replayed onto. Somebody has to
 *   decide, and telling them now is the only useful moment.
 *
 * Pure over rows, like the projection it complements.
 */

export type Verdict = "outstanding" | "landed" | "conflicted";

export interface Replayed {
  change: Change;
  verdict: Verdict;
  /** One sentence for the person reading the branch. */
  why: string;
}

export interface Rebase {
  replayed: Replayed[];
  outstanding: number;
  landed: number;
  conflicted: number;
  /** Nothing outstanding and nothing conflicted: the plan has arrived. */
  finished: boolean;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const RETIRED = "retired";

export function rebaseOnto(changes: Change[], entities: s.Entity[], relations: s.Relation[]): Rebase {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const wired = new Set(relations.map((r) => `${r.fromEntityId}|${norm(r.kind)}|${r.toEntityId}`));
  const relationById = new Map(relations.map((r) => [r.id, r]));

  const replayed = changes.map((change): Replayed => {
    const named = (id: string | null) => (id && byId.get(id)?.name) || "it";

    switch (change.op) {
      case "addEntity": {
        const p = change.payload as unknown as AddEntityPayload;
        // The object exists now. Either this plan built it or somebody else did; either way the
        // introduction has happened and carrying it forward would propose building it twice.
        if (change.entityId && byId.has(change.entityId)) {
          return { change, verdict: "landed", why: `“${p.name ?? named(change.entityId)}” exists now.` };
        }
        const sameName = entities.find((e) => norm(e.name) === norm(p.name ?? ""));
        if (p.name && sameName) {
          return { change, verdict: "conflicted", why: `Something called “${p.name}” already exists, built outside this plan. Is it the same thing?` };
        }
        return { change, verdict: "outstanding", why: `“${p.name || "a new object"}” still has to be introduced.` };
      }

      case "retireEntity": {
        const entity = change.entityId ? byId.get(change.entityId) : undefined;
        if (!entity) return { change, verdict: "landed", why: `It is gone from the model already.` };
        if (norm(parseAttributes(entity.attributes).lifecycle ?? "") === RETIRED) {
          return { change, verdict: "landed", why: `“${entity.name}” was retired without waiting for this plan.` };
        }
        return { change, verdict: "outstanding", why: `“${entity.name}” is still live.` };
      }

      case "setAttribute": {
        const entity = change.entityId ? byId.get(change.entityId) : undefined;
        const p = change.payload as unknown as SetAttributePayload;
        if (!entity) return { change, verdict: "conflicted", why: `The object this would change is no longer in the model.` };
        const current = parseAttributes(entity.attributes)[p.key] ?? "";
        if (norm(current) === norm(p.value)) {
          return { change, verdict: "landed", why: `${p.key} on “${entity.name}” already says “${p.value}”.` };
        }
        return { change, verdict: "outstanding", why: `${p.key} on “${entity.name}” says “${current || "nothing"}”; the plan says “${p.value}”.` };
      }

      case "retypeEntity": {
        const entity = change.entityId ? byId.get(change.entityId) : undefined;
        const p = change.payload as unknown as RetypeEntityPayload;
        if (!entity) return { change, verdict: "conflicted", why: `The object this would retype is no longer in the model.` };
        if (norm(entity.kind) === norm(p.kind ?? "")) {
          return { change, verdict: "landed", why: `“${entity.name}” is already a ${p.kind}.` };
        }
        return { change, verdict: "outstanding", why: `“${entity.name}” is a ${entity.kind || "nothing"}; the plan makes it a ${p.kind}.` };
      }

      case "setParent": {
        const entity = change.entityId ? byId.get(change.entityId) : undefined;
        const p = change.payload as unknown as SetParentPayload;
        if (!entity) return { change, verdict: "conflicted", why: `The object this would move is no longer in the model.` };
        const wanted = (p.parentId ?? "").trim() || null;
        if ((entity.parentId ?? null) === wanted) {
          return { change, verdict: "landed", why: `“${entity.name}” already sits where the plan puts it.` };
        }
        return { change, verdict: "outstanding", why: `“${entity.name}” has still to be moved.` };
      }

      case "addRelation": {
        const p = change.payload as unknown as AddRelationPayload;
        if (!byId.has(p.fromEntityId) || !byId.has(p.toEntityId)) {
          // One end may be introduced by this same plan, which is ordinary rather than broken.
          const introducedHere = changes.some((c) => c.op === "addEntity" && (c.entityId === p.fromEntityId || c.entityId === p.toEntityId));
          return introducedHere
            ? { change, verdict: "outstanding", why: `A connection waiting on something this plan introduces.` }
            : { change, verdict: "conflicted", why: `One end of this connection is no longer in the model.` };
        }
        if (wired.has(`${p.fromEntityId}|${norm(p.kind ?? "")}|${p.toEntityId}`)) {
          return { change, verdict: "landed", why: `“${named(p.fromEntityId)}” and “${named(p.toEntityId)}” are already connected.` };
        }
        return { change, verdict: "outstanding", why: `“${named(p.fromEntityId)}” still has to be connected to “${named(p.toEntityId)}”.` };
      }

      case "removeRelation": {
        if (!change.relationId || !relationById.has(change.relationId)) {
          return { change, verdict: "landed", why: `That connection is already gone.` };
        }
        return { change, verdict: "outstanding", why: `The connection is still there.` };
      }
    }
  });

  const count = (v: Verdict) => replayed.filter((r) => r.verdict === v).length;
  const outstanding = count("outstanding");
  const conflicted = count("conflicted");
  return { replayed, outstanding, landed: count("landed"), conflicted, finished: outstanding === 0 && conflicted === 0 };
}

/**
 * Where the plan stands, in one sentence.
 *
 * The number that matters is what is *left*, not what is done: a plan is finished when its diff
 * against the estate is empty, and that is a fact rather than somebody's percentage.
 */
export function progressWords(rebase: Rebase): string {
  if (!rebase.replayed.length) return "This plan is empty.";
  if (rebase.finished) return "This plan has arrived: the estate already matches every change in it.";
  const parts = [`${rebase.outstanding} still to do`];
  if (rebase.landed) parts.push(`${rebase.landed} already true`);
  if (rebase.conflicted) parts.push(`${rebase.conflicted} that reality has moved past`);
  return `${parts.join(", ")}.`;
}
