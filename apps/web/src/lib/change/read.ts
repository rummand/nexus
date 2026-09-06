import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import type { Change, ChangeSet } from "./types";
import type { Dependency } from "./order";
import type { Plateau } from "./plateau";

/**
 * Reading change sets back out.
 *
 * The payload column is JSON written by a version of the code that may no longer exist, so it is
 * parsed defensively here and nowhere else: everything downstream can treat a `Change` as a
 * `Change`.
 */

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toChange(row: s.ChangeRow): Change {
  return {
    id: row.id,
    op: row.op,
    entityId: row.entityId,
    relationId: row.relationId,
    payload: parsePayload(row.payload),
    note: row.note,
    createdAt: row.createdAt,
  };
}

export async function listChangeSets(db: Db, workspaceId: string): Promise<ChangeSet[]> {
  const sets = await db
    .select()
    .from(s.changeSets)
    .where(eq(s.changeSets.workspaceId, workspaceId))
    .orderBy(asc(s.changeSets.targetDate), asc(s.changeSets.createdAt));
  if (!sets.length) return [];
  const rows = await db
    .select()
    .from(s.changes)
    .where(inArray(s.changes.changeSetId, sets.map((set) => set.id)))
    .orderBy(asc(s.changes.createdAt));
  const bySet = new Map<string, Change[]>();
  for (const row of rows) {
    const list = bySet.get(row.changeSetId) ?? [];
    list.push(toChange(row));
    bySet.set(row.changeSetId, list);
  }
  return sets.map((set) => ({ ...set, changes: bySet.get(set.id) ?? [] }));
}

export async function getChangeSet(db: Db, changeSetId: string): Promise<ChangeSet | null> {
  const set = await db.query.changeSets.findFirst({ where: eq(s.changeSets.id, changeSetId) });
  if (!set) return null;
  const rows = await db.select().from(s.changes).where(eq(s.changes.changeSetId, changeSetId)).orderBy(asc(s.changes.createdAt));
  return { ...set, changes: rows.map(toChange) };
}

/** Every dependency edge in a workspace. Small enough that filtering client-side is fine. */
export async function listDependencies(db: Db, workspaceId: string): Promise<Dependency[]> {
  const rows = await db
    .select({ changeSetId: s.changeSetDependencies.changeSetId, dependsOnId: s.changeSetDependencies.dependsOnId })
    .from(s.changeSetDependencies)
    .innerJoin(s.changeSets, eq(s.changeSetDependencies.changeSetId, s.changeSets.id))
    .where(eq(s.changeSets.workspaceId, workspaceId));
  return rows;
}

/** Plateaus with their membership. */
export async function listPlateaus(db: Db, workspaceId: string): Promise<Plateau[]> {
  const rows = await db
    .select()
    .from(s.plateaus)
    .where(eq(s.plateaus.workspaceId, workspaceId))
    .orderBy(asc(s.plateaus.targetDate), asc(s.plateaus.createdAt));
  if (!rows.length) return [];
  const members = await db
    .select({ plateauId: s.plateauChangeSets.plateauId, changeSetId: s.plateauChangeSets.changeSetId })
    .from(s.plateauChangeSets)
    .where(inArray(s.plateauChangeSets.plateauId, rows.map((p) => p.id)));
  const byPlateau = new Map<string, string[]>();
  for (const m of members) {
    const list = byPlateau.get(m.plateauId) ?? [];
    list.push(m.changeSetId);
    byPlateau.set(m.plateauId, list);
  }
  return rows.map((p) => ({ ...p, changeSetIds: byPlateau.get(p.id) ?? [] }));
}

/** The graph rows a projection needs. */
export async function graphRows(db: Db, workspaceId: string): Promise<{ entities: s.Entity[]; relations: s.Relation[] }> {
  const [entities, relations] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
  ]);
  return { entities, relations };
}
