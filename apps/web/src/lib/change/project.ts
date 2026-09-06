import type * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import type { AddEntityPayload, AddRelationPayload, Change, Projection, SetAttributePayload } from "./types";

/**
 * Applying a change set to a graph — in memory, never to the database.
 *
 * This is the heart of the feature and it is deliberately a pure function over rows. The graph
 * stays the estate as it is; a change set is intent, and intent projects a *view*. That is what
 * lets a to-be be speculative and wrong without corrupting the record of what is actually there,
 * and what lets two rival plans be compared without either of them having happened.
 *
 * Retired entities are kept in the output, marked. A view that simply dropped them would answer
 * "what does the estate look like after this?" while hiding the more interesting question, which
 * is what was attached to the thing you are about to remove.
 */

/** Apply changes in order, reporting the ones that no longer make sense rather than skipping them. */
export function project(entities: s.Entity[], relations: s.Relation[], changes: Change[]): Projection {
  const byId = new Map(entities.map((e) => [e.id, { ...e }]));
  const relationsById = new Map(relations.map((r) => [r.id, { ...r }]));
  const added = new Set<string>();
  const retired = new Set<string>();
  const changedIds = new Set<string>();
  const addedRelations = new Set<string>();
  const removedRelations = new Set<string>();
  const problems: Projection["problems"] = [];

  const workspaceId = entities[0]?.workspaceId ?? relations[0]?.workspaceId ?? "";
  const now = new Date().toISOString();

  for (const change of changes) {
    switch (change.op) {
      case "addEntity": {
        const id = change.entityId;
        const p = change.payload as unknown as AddEntityPayload;
        if (!id) {
          problems.push({ changeId: change.id, message: "an introduction with no id was written; it cannot be projected" });
          break;
        }
        if (byId.has(id)) {
          // The entity was built between planning and now: the plan has happened, not failed.
          added.add(id);
          break;
        }
        byId.set(id, {
          id,
          workspaceId,
          kind: p.kind ?? "",
          name: p.name ?? "",
          description: p.description ?? "",
          attributes: JSON.stringify(p.attributes ?? {}),
          source: "plan",
          createdAt: now,
          updatedAt: now,
        } as s.Entity);
        added.add(id);
        break;
      }
      case "retireEntity": {
        const id = change.entityId;
        if (!id || !byId.has(id)) {
          problems.push({ changeId: change.id, message: "the system this retires is no longer in the graph" });
          break;
        }
        retired.add(id);
        // Every relation into or out of a retired system is severed by definition; that is the
        // part of a retirement people forget, so it is computed rather than left to be listed.
        for (const [rid, r] of relationsById) {
          if (r.fromEntityId === id || r.toEntityId === id) removedRelations.add(rid);
        }
        break;
      }
      case "setAttribute": {
        const id = change.entityId;
        const entity = id ? byId.get(id) : undefined;
        const p = change.payload as unknown as SetAttributePayload;
        if (!entity) {
          problems.push({ changeId: change.id, message: "the system this changes is no longer in the graph" });
          break;
        }
        if (!p.key) {
          problems.push({ changeId: change.id, message: "a change with no attribute name cannot be applied" });
          break;
        }
        const attributes = parseAttributes(entity.attributes);
        if (p.value === "") delete attributes[p.key];
        else attributes[p.key] = p.value;
        entity.attributes = JSON.stringify(attributes);
        changedIds.add(entity.id);
        break;
      }
      case "addRelation": {
        const p = change.payload as unknown as AddRelationPayload;
        if (!byId.has(p.fromEntityId) || !byId.has(p.toEntityId)) {
          problems.push({ changeId: change.id, message: "this connects something that is not in the graph or in this change set" });
          break;
        }
        const id = change.relationId ?? change.id;
        relationsById.set(id, {
          id,
          workspaceId,
          fromEntityId: p.fromEntityId,
          toEntityId: p.toEntityId,
          kind: p.kind ?? "",
          attributes: "{}",
          source: "plan",
          createdAt: now,
          updatedAt: now,
        } as s.Relation);
        addedRelations.add(id);
        break;
      }
      case "removeRelation": {
        const id = change.relationId;
        if (!id || !relationsById.has(id)) {
          problems.push({ changeId: change.id, message: "the connection this removes is no longer in the graph" });
          break;
        }
        removedRelations.add(id);
        break;
      }
    }
  }

  return {
    entities: [...byId.values()],
    relations: [...relationsById.values()],
    added,
    retired,
    changed: changedIds,
    addedRelations,
    removedRelations,
    problems,
  };
}

/**
 * The to-be graph proper: retired systems and severed connections actually gone.
 *
 * `project` keeps them so a view can show them going; this is what you measure. Health scored on
 * the projection would count a system you are removing as a problem you still have.
 */
export function settled(projection: Projection): { entities: s.Entity[]; relations: s.Relation[] } {
  return {
    entities: projection.entities.filter((e) => !projection.retired.has(e.id)),
    relations: projection.relations.filter(
      (r) => !projection.removedRelations.has(r.id) && !projection.retired.has(r.fromEntityId) && !projection.retired.has(r.toEntityId),
    ),
  };
}

/** Project several change sets in target-date order — the estate after everything currently planned. */
export function projectAll(entities: s.Entity[], relations: s.Relation[], sets: Array<{ targetDate: string; changes: Change[] }>): Projection {
  const ordered = [...sets].sort((a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999"));
  return project(entities, relations, ordered.flatMap((set) => set.changes));
}
