import { and, eq, like, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseDocument, serializeDocument } from "@/canvas/document";

/**
 * Graph-first relation editing (entity drawer). Boards remain the other way to create relations:
 * a connector between two cards syncs into this table on save.
 */

const norm = (v: string) => v.trim().toLowerCase();

/** Create a relation unless an identical one (same ends, same kind) already exists; returns its id. */
export async function createRelation(db: Db, workspaceId: string, fromEntityId: string, kind: string, toEntityId: string, source = "graph"): Promise<{ id: string; created: boolean }> {
  if (fromEntityId === toEntityId) throw new Error("A relation needs two different entities");
  const ends = await db.select({ id: s.entities.id, workspaceId: s.entities.workspaceId }).from(s.entities).where(and(eq(s.entities.workspaceId, workspaceId), eq(s.entities.id, fromEntityId)));
  const other = await db.select({ id: s.entities.id }).from(s.entities).where(and(eq(s.entities.workspaceId, workspaceId), eq(s.entities.id, toEntityId)));
  if (!ends.length || !other.length) throw new Error("Both entities must exist in this workspace");
  const existing = await db.select().from(s.relations_).where(and(eq(s.relations_.fromEntityId, fromEntityId), eq(s.relations_.toEntityId, toEntityId)));
  const dupe = existing.find((r) => norm(r.kind) === norm(kind));
  if (dupe) return { id: dupe.id, created: false };
  const id = `rel_${nanoid(12)}`;
  const ts = new Date().toISOString();
  await db.insert(s.relations_).values({ id, workspaceId, fromEntityId, toEntityId, kind: kind.trim(), source, createdAt: ts, updatedAt: ts });
  return { id, created: true };
}

/**
 * Delete a relation and remove the connectors that draw it from every board document — otherwise
 * the next autosave of such a board would recreate the relation from the connector.
 */
export async function deleteRelation(db: Db, relationId: string): Promise<{ deleted: boolean; boardsUpdated: number }> {
  const rel = await db.query.relations_.findFirst({ where: eq(s.relations_.id, relationId) });
  if (!rel) return { deleted: false, boardsUpdated: 0 };
  const boards = await db.select().from(s.boards).where(and(eq(s.boards.workspaceId, rel.workspaceId), like(s.boards.document, `%${relationId}%`)));
  let boardsUpdated = 0;
  for (const board of boards) {
    const doc = parseDocument(board.document);
    const doomed = Object.values(doc.elements).filter((el) => el.type === "connector" && el.meta?.relationId === relationId).map((el) => el.id);
    if (!doomed.length) continue;
    for (const id of doomed) delete doc.elements[id];
    await db.update(s.boards).set({ document: serializeDocument(doc), updatedAt: new Date().toISOString(), revision: sql`${s.boards.revision} + 1` }).where(eq(s.boards.id, board.id));
    boardsUpdated++;
  }
  await db.delete(s.relations_).where(eq(s.relations_.id, relationId));
  return { deleted: true, boardsUpdated };
}
