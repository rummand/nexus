"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { currentUser } from "@/lib/session";
import { parseAttributes } from "@/lib/graph";
import { getChangeSet, graphRows, listChangeSets, listDependencies } from "./read";
import { project } from "./project";
import { blocking, wouldCycle } from "./order";
import type { AddEntityPayload, AddRelationPayload, ChangeSetStatus, SetAttributePayload } from "./types";

const now = () => new Date().toISOString();

/**
 * One shape for every write here.
 *
 * Without an explicit union TypeScript widens `{ok:true} | {error:string}` into a single object
 * with both keys optional, and every call site then has to cope with `string | undefined` for an
 * error that is either present or not.
 */
export type ChangeResult = { ok: true } | { error: string };

async function slugOf(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  return ws?.slug ?? "";
}

async function touch(workspaceId: string, changeSetId?: string) {
  const db = await getDb();
  if (changeSetId) await db.update(s.changeSets).set({ updatedAt: now() }).where(eq(s.changeSets.id, changeSetId));
  const slug = await slugOf(workspaceId);
  if (slug) {
    revalidatePath(`/w/${slug}/roadmap`);
    revalidatePath(`/w/${slug}/graph`);
  }
}

export async function createChangeSet(input: { workspaceId: string; name: string; description?: string; targetDate?: string }) {
  const db = await getDb();
  const user = await currentUser();
  const id = `chg_${nanoid(10)}`;
  await db.insert(s.changeSets).values({
    id,
    workspaceId: input.workspaceId,
    name: input.name.trim() || "Untitled change",
    description: input.description?.trim() ?? "",
    targetDate: normaliseDate(input.targetDate),
    status: "draft",
    createdById: user.id,
    createdAt: now(),
    updatedAt: now(),
  });
  await touch(input.workspaceId);
  return { id };
}

/** An ISO date or nothing. A half-parsed date is worse than an undated plan. */
function normaliseDate(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

export async function updateChangeSet(changeSetId: string, patch: { name?: string; description?: string; targetDate?: string; status?: ChangeSetStatus }): Promise<ChangeResult> {
  const db = await getDb();
  const set = await db.query.changeSets.findFirst({ where: eq(s.changeSets.id, changeSetId) });
  if (!set) return { error: "That change set is gone." };
  // Delivering is not a status you can type your way into: it has to go through `deliverChangeSet`,
  // which is the thing that actually moves the graph.
  if (patch.status === "delivered") return { error: "Use Deliver to apply a change set." };
  // Past that guard, `patch.status` can only be a pre-delivery status, so any status change here
  // would be walking a delivered change set backwards.
  if (set.status === "delivered" && patch.status) {
    return { error: "This has been delivered; the graph already carries it." };
  }
  await db
    .update(s.changeSets)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim() || "Untitled change" } : {}),
      ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
      ...(patch.targetDate !== undefined ? { targetDate: normaliseDate(patch.targetDate) } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      updatedAt: now(),
    })
    .where(eq(s.changeSets.id, changeSetId));
  await touch(set.workspaceId);
  return { ok: true };
}

export async function deleteChangeSet(changeSetId: string): Promise<ChangeResult> {
  const db = await getDb();
  const set = await db.query.changeSets.findFirst({ where: eq(s.changeSets.id, changeSetId) });
  if (!set) return { ok: true };
  await db.delete(s.changeSets).where(eq(s.changeSets.id, changeSetId));
  await touch(set.workspaceId);
  return { ok: true };
}

/** Add one intention to a change set. Ids for introduced systems are minted here, before they exist. */
export async function addChange(input: {
  changeSetId: string;
  op: s.ChangeRow["op"];
  entityId?: string | null;
  relationId?: string | null;
  payload?: AddEntityPayload | SetAttributePayload | AddRelationPayload | Record<string, unknown>;
  note?: string;
}): Promise<{ id: string; entityId: string | null; relationId: string | null } | { error: string }> {
  const db = await getDb();
  const set = await db.query.changeSets.findFirst({ where: eq(s.changeSets.id, input.changeSetId) });
  if (!set) return { error: "That change set is gone." };
  if (set.status === "delivered") return { error: "This has been delivered; start a new change set." };

  const id = `chn_${nanoid(10)}`;
  // A new system needs an id now so a relation written in the same breath can point at it.
  const entityId = input.op === "addEntity" ? (input.entityId ?? `ent_${nanoid(10)}`) : (input.entityId ?? null);
  const relationId = input.op === "addRelation" ? (input.relationId ?? `rel_${nanoid(10)}`) : (input.relationId ?? null);

  await db.insert(s.changes).values({
    id,
    changeSetId: input.changeSetId,
    op: input.op,
    entityId,
    relationId,
    payload: JSON.stringify(input.payload ?? {}),
    note: input.note?.trim() ?? "",
    createdAt: now(),
  });
  await touch(set.workspaceId, set.id);
  return { id, entityId, relationId };
}

export async function removeChange(changeId: string): Promise<ChangeResult> {
  const db = await getDb();
  const row = await db.query.changes.findFirst({ where: eq(s.changes.id, changeId) });
  if (!row) return { ok: true };
  const set = await db.query.changeSets.findFirst({ where: eq(s.changeSets.id, row.changeSetId) });
  if (set?.status === "delivered") return { error: "This has been delivered; it cannot be edited." };
  await db.delete(s.changes).where(eq(s.changes.id, changeId));
  if (set) await touch(set.workspaceId, set.id);
  return { ok: true };
}

/**
 * Make one change set wait for another.
 *
 * Refused if it would make a loop: two plans that each wait for the other is not a roadmap anybody
 * can deliver, and the honest moment to say so is when the second edge is drawn rather than when
 * somebody tries to deliver either of them.
 */
export async function addDependency(changeSetId: string, dependsOnId: string): Promise<ChangeResult> {
  if (changeSetId === dependsOnId) return { error: "A change set cannot wait for itself." };
  const db = await getDb();
  const [set, blocker] = await Promise.all([
    db.query.changeSets.findFirst({ where: eq(s.changeSets.id, changeSetId) }),
    db.query.changeSets.findFirst({ where: eq(s.changeSets.id, dependsOnId) }),
  ]);
  if (!set || !blocker) return { error: "One of those change sets is gone." };
  if (set.workspaceId !== blocker.workspaceId) return { error: "Those change sets are in different workspaces." };
  if (set.status === "delivered") return { error: "This has been delivered; it is not waiting for anything." };

  const deps = await listDependencies(db, set.workspaceId);
  if (deps.some((d) => d.changeSetId === changeSetId && d.dependsOnId === dependsOnId)) return { ok: true };
  if (wouldCycle(deps, changeSetId, dependsOnId)) {
    return { error: `“${blocker.name}” already waits for this one, directly or through another plan.` };
  }
  await db.insert(s.changeSetDependencies).values({ changeSetId, dependsOnId, createdAt: now() }).onConflictDoNothing();
  await touch(set.workspaceId, set.id);
  return { ok: true };
}

export async function removeDependency(changeSetId: string, dependsOnId: string): Promise<ChangeResult> {
  const db = await getDb();
  const set = await db.query.changeSets.findFirst({ where: eq(s.changeSets.id, changeSetId) });
  await db
    .delete(s.changeSetDependencies)
    .where(and(eq(s.changeSetDependencies.changeSetId, changeSetId), eq(s.changeSetDependencies.dependsOnId, dependsOnId)));
  if (set) await touch(set.workspaceId, set.id);
  return { ok: true };
}

/**
 * Apply a change set to the graph. This is the one operation here that moves the estate.
 *
 * Retirement sets `lifecycle: retired` and severs the system's relations rather than deleting the
 * node. The graph is meant to outlive the things in it — a system you retired last year is the
 * answer to "what did we replace it with", and a model that forgets it cannot answer that. If you
 * genuinely want it gone, deleting an entity is still a separate, deliberate act.
 */
export async function deliverChangeSet(changeSetId: string): Promise<{ ok: true; introduced: number; retired: number; altered: number; connected: number; severed: number } | { error: string }> {
  const db = await getDb();
  const set = await getChangeSet(db, changeSetId);
  if (!set) return { error: "That change set is gone." };
  if (set.status === "delivered") return { error: "This was already delivered." };

  // Nothing is delivered out of order. A plan whose blocker has not landed is not merely early —
  // its changes are written against an estate that does not exist yet.
  const [all, deps] = await Promise.all([listChangeSets(db, set.workspaceId), listDependencies(db, set.workspaceId)]);
  const waiting = blocking(set.id, all, deps);
  if (waiting.length) {
    const first = waiting[0]!;
    return {
      error:
        waiting.length === 1
          ? `This waits for “${first.name}”, which is ${first.reason === "abandoned" ? "abandoned — decide what happens to this plan first" : "not delivered yet"}.`
          : `This waits for ${waiting.length} other change sets, starting with “${first.name}”.`,
    };
  }

  const { entities, relations } = await graphRows(db, set.workspaceId);
  const projection = project(entities, relations, set.changes);
  // A stale plan is refused rather than half-applied: the person should see what no longer fits
  // and decide, and a partial delivery is the hardest kind of mess to unpick.
  if (projection.problems.length) {
    return { error: `${projection.problems.length} change${projection.problems.length === 1 ? "" : "s"} no longer fit the graph. Fix or remove them first.` };
  }

  const existing = new Set(entities.map((e) => e.id));
  const ts = now();
  let introduced = 0;
  let retired = 0;
  let altered = 0;
  let connected = 0;
  let severed = 0;

  for (const change of set.changes) {
    switch (change.op) {
      case "addEntity": {
        const p = change.payload as unknown as AddEntityPayload;
        if (!change.entityId || existing.has(change.entityId)) break;
        await db.insert(s.entities).values({
          id: change.entityId,
          workspaceId: set.workspaceId,
          kind: p.kind ?? "",
          name: p.name ?? "",
          description: p.description ?? "",
          attributes: JSON.stringify(p.attributes ?? {}),
          // Provenance: this exists because a plan said so, and the plan is still readable.
          source: `plan:${set.id}`,
          createdAt: ts,
          updatedAt: ts,
        });
        existing.add(change.entityId);
        introduced++;
        break;
      }
      case "retireEntity": {
        if (!change.entityId) break;
        const entity = entities.find((e) => e.id === change.entityId);
        if (!entity) break;
        const attributes = parseAttributes(entity.attributes);
        attributes.lifecycle = "retired";
        await db.update(s.entities).set({ attributes: JSON.stringify(attributes), updatedAt: ts }).where(eq(s.entities.id, change.entityId));
        const gone = await db
          .delete(s.relations_)
          .where(and(eq(s.relations_.workspaceId, set.workspaceId), eq(s.relations_.fromEntityId, change.entityId)))
          .returning({ id: s.relations_.id });
        const gone2 = await db
          .delete(s.relations_)
          .where(and(eq(s.relations_.workspaceId, set.workspaceId), eq(s.relations_.toEntityId, change.entityId)))
          .returning({ id: s.relations_.id });
        severed += gone.length + gone2.length;
        retired++;
        break;
      }
      case "setAttribute": {
        const p = change.payload as unknown as SetAttributePayload;
        const entity = entities.find((e) => e.id === change.entityId);
        if (!entity || !p.key) break;
        const attributes = parseAttributes(entity.attributes);
        if (p.value === "") delete attributes[p.key];
        else attributes[p.key] = p.value;
        await db.update(s.entities).set({ attributes: JSON.stringify(attributes), updatedAt: ts }).where(eq(s.entities.id, entity.id));
        altered++;
        break;
      }
      case "addRelation": {
        const p = change.payload as unknown as AddRelationPayload;
        if (!change.relationId || !p.fromEntityId || !p.toEntityId) break;
        await db
          .insert(s.relations_)
          .values({
            id: change.relationId,
            workspaceId: set.workspaceId,
            fromEntityId: p.fromEntityId,
            toEntityId: p.toEntityId,
            kind: p.kind ?? "",
            attributes: "{}",
            source: `plan:${set.id}`,
            createdAt: ts,
            updatedAt: ts,
          })
          .onConflictDoNothing();
        connected++;
        break;
      }
      case "removeRelation": {
        if (!change.relationId) break;
        await db.delete(s.relations_).where(eq(s.relations_.id, change.relationId));
        severed++;
        break;
      }
    }
  }

  await db.update(s.changeSets).set({ status: "delivered", deliveredAt: ts, updatedAt: ts }).where(eq(s.changeSets.id, changeSetId));
  await touch(set.workspaceId, set.id);
  return { ok: true, introduced, retired, altered, connected, severed };
}
