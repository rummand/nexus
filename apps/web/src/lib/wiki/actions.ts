"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { currentActor } from "@/lib/history/current";
import { migrateDocument, parseDocument } from "@/canvas/document";
import { isEntityId } from "@/lib/graph-types";
import { slugFor } from "./pages";
import { boardWriteup, type WriteupRelation } from "./writeup";

/**
 * Writing in the wiki (§5.60).
 *
 * One rule runs through all of it: a page is content somebody wrote, so nothing here may lose it
 * silently. Deleting a page with children re-parents them rather than taking the subtree; renaming
 * keeps the slug, because a slug is a link somebody may have pasted into a mail six months ago.
 */

const now = () => new Date().toISOString();

async function touched(workspaceId: string) {
  const db = await getDb();
  const [ws] = await db.select({ slug: s.workspaces.slug }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (ws) revalidatePath(`/w/${ws.slug}`, "layout");
}

/** Which workspace a page belongs to, for the guard (§5.46). */
async function denyPage(id: string) {
  const db = await getDb();
  const row = await db.query.wikiPages.findFirst({ where: eq(s.wikiPages.id, id) });
  if (!row) return { error: "That page is gone." };
  const no = await deny(row.workspaceId, "wiki.edit");
  return no ?? { ok: true as const, row };
}

export async function createPage(workspaceId: string, input: { title: string; parentId?: string | null; body?: string; source?: string }) {
  const no = await deny(workspaceId, "wiki.edit");
  if (no) return no;
  const title = input.title.trim() || "Untitled";
  const db = await getDb();
  const siblings = await db.select().from(s.wikiPages).where(eq(s.wikiPages.workspaceId, workspaceId));
  const actor = await currentActor();
  const id = `wik_${nanoid(10)}`;
  await db.insert(s.wikiPages).values({
    id, workspaceId, title,
    slug: slugFor(title, new Set(siblings.map((r) => r.slug))),
    parentId: input.parentId ?? null,
    body: input.body ?? "",
    source: input.source ?? "",
    position: siblings.filter((r) => (r.parentId ?? null) === (input.parentId ?? null)).length,
    createdById: actor.id,
    updatedByName: actor.name,
  });
  await touched(workspaceId);
  const [made] = await db.select().from(s.wikiPages).where(eq(s.wikiPages.id, id));
  return { id, slug: made?.slug ?? "" };
}

/**
 * Save a page's body.
 *
 * The slug does not move when the title does. A wiki's addresses are the half of it people share,
 * and a rename that breaks every link to a page is a rename nobody dares do.
 */
export async function savePage(id: string, patch: { title?: string; body?: string; icon?: string }) {
  const guard = await denyPage(id);
  if ("error" in guard) return guard;
  const db = await getDb();
  const actor = await currentActor();
  const next: Partial<typeof s.wikiPages.$inferInsert> = { updatedAt: now(), updatedByName: actor.name };
  if (patch.title !== undefined) next.title = patch.title.trim() || "Untitled";
  if (patch.body !== undefined) next.body = patch.body;
  if (patch.icon !== undefined) next.icon = patch.icon.slice(0, 8);
  await db.update(s.wikiPages).set(next).where(eq(s.wikiPages.id, id));
  await touched(guard.row.workspaceId);
  return { ok: true };
}

/** Move a page under another, or to the root. A page may not be its own ancestor. */
export async function movePage(id: string, parentId: string | null) {
  const guard = await denyPage(id);
  if ("error" in guard) return guard;
  const db = await getDb();
  const rows = await db.select().from(s.wikiPages).where(eq(s.wikiPages.workspaceId, guard.row.workspaceId));
  if (parentId) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    let at = byId.get(parentId);
    const seen = new Set<string>();
    while (at && !seen.has(at.id)) {
      if (at.id === id) return { error: "A page cannot be filed inside itself." };
      seen.add(at.id);
      at = at.parentId ? byId.get(at.parentId) : undefined;
    }
  }
  await db.update(s.wikiPages)
    .set({ parentId, position: rows.filter((r) => (r.parentId ?? null) === parentId).length, updatedAt: now() })
    .where(eq(s.wikiPages.id, id));
  await touched(guard.row.workspaceId);
  return { ok: true };
}

/**
 * Delete a page. Its children move up to where it was; they are not deleted with it.
 */
export async function deletePage(id: string) {
  const guard = await denyPage(id);
  if ("error" in guard) return guard;
  const db = await getDb();
  await db.update(s.wikiPages).set({ parentId: guard.row.parentId, updatedAt: now() })
    .where(and(eq(s.wikiPages.workspaceId, guard.row.workspaceId), eq(s.wikiPages.parentId, id)));
  await db.delete(s.wikiPages).where(eq(s.wikiPages.id, id));
  await touched(guard.row.workspaceId);
  return { ok: true };
}

/**
 * Draft a page from a board (§5.60).
 *
 * The draft is deterministic and made of references — see `writeup.ts` for why. The relations it
 * tabulates come from the graph rather than from the board's connectors, because a connector is a
 * line somebody drew and a relation is the claim it turned into.
 */
export async function pageFromBoard(workspaceId: string, boardId: string) {
  const no = await deny(workspaceId, "wiki.edit");
  if (no) return no;
  const db = await getDb();
  const [board] = await db.select().from(s.boards)
    .where(and(eq(s.boards.workspaceId, workspaceId), eq(s.boards.id, boardId)));
  if (!board) return { error: "That board is not in this workspace." };

  const document = migrateDocument(parseDocument(board.document));
  const onBoard = new Set(
    Object.values(document.elements)
      .map((el) => (el.type === "card" ? el.meta?.entityId : undefined))
      .filter((v): v is string => typeof v === "string" && isEntityId(v)),
  );

  let relations: WriteupRelation[] = [];
  if (onBoard.size > 0) {
    const [entities, rels] = await Promise.all([
      db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
      db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
    ]);
    const nameOf = new Map(entities.map((e) => [e.id, e.name]));
    relations = rels
      .filter((r) => onBoard.has(r.fromEntityId) && onBoard.has(r.toEntityId))
      .map((r) => ({ fromName: nameOf.get(r.fromEntityId) ?? "?", kind: r.kind, toName: nameOf.get(r.toEntityId) ?? "?" }))
      .sort((a, b) => a.fromName.localeCompare(b.fromName) || a.toName.localeCompare(b.toName));
  }

  const { title, body } = boardWriteup({ boardId: board.id, boardName: board.name, document, relations });
  return createPage(workspaceId, { title, body, source: `board:${board.id}` });
}
