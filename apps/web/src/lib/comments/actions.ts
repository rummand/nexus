"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { currentUser } from "@/lib/session";
import { deny, viewer } from "@/lib/auth/guard";
import { cleanBody, threadsOf, type Comment, type Thread } from "./threads";

/**
 * Saying something about a board (§5.50).
 *
 * `board.comment` rather than `board.edit`, so a **guest** can take part: the reviewer you invite
 * to look at an architecture is exactly the person with something to say about it, and a comment
 * changes no model data.
 *
 * Editing and deleting are **your own words only** — not an administrator's power. Somebody able to
 * rewrite what a colleague said would make the whole record worthless, and there is no version of
 * that which is worth the convenience. Resolving is different: it settles a conversation rather
 * than changing it, so anybody who may comment may resolve, and it is reversible.
 */

async function boardWorkspace(boardId: string) {
  const db = await getDb();
  const [row] = await db.select({ workspaceId: s.boards.workspaceId }).from(s.boards).where(eq(s.boards.id, boardId));
  return row?.workspaceId ?? null;
}

/** Every comment on a board, already folded into conversations. */
export async function threadsForBoard(boardId: string): Promise<Thread[]> {
  const workspaceId = await boardWorkspace(boardId);
  if (!workspaceId) return [];
  // Reading is membership, which the workspace layout has established; there is no capability for
  // it and inventing one here would be a second, quieter access rule.
  if (!(await viewer(workspaceId)).role) return [];
  const db = await getDb();
  const rows = await db.select().from(s.comments).where(eq(s.comments.boardId, boardId)).orderBy(asc(s.comments.createdAt));
  return threadsOf(rows.map(toComment));
}

function toComment(row: s.CommentRow): Comment {
  return {
    id: row.id,
    boardId: row.boardId,
    elementId: row.elementId,
    anchorLabel: row.anchorLabel,
    parentId: row.parentId,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    resolvedAt: row.resolvedAt,
    resolvedByName: row.resolvedByName,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
  };
}

export async function addComment(input: {
  boardId: string;
  body: string;
  /** "" for a comment about the board as a whole. */
  elementId?: string;
  /** What the element is called right now, kept so a deleted card is still named. */
  anchorLabel?: string;
  /** The thread this answers, if it answers one. */
  parentId?: string | null;
}): Promise<{ id: string } | { error: string }> {
  const workspaceId = await boardWorkspace(input.boardId);
  if (!workspaceId) return { error: "That board is gone." };
  const no = await deny(workspaceId, "board.comment");
  if (no) return no;

  const body = cleanBody(input.body);
  if (!body) return { error: "Write something first." };

  const user = await currentUser();
  const db = await getDb();

  /*
   * Only two levels. A reply to a reply joins the same thread rather than starting a third rung,
   * because a canvas comment is a conversation about one thing and an arbitrarily deep tree is a
   * shape nobody can read in a popover.
   */
  let parentId: string | null = null;
  if (input.parentId) {
    const [parent] = await db.select().from(s.comments).where(and(eq(s.comments.id, input.parentId), eq(s.comments.boardId, input.boardId)));
    if (!parent) return { error: "That conversation is gone." };
    parentId = parent.parentId ?? parent.id;
  }

  const id = `cmt_${nanoid(12)}`;
  await db.insert(s.comments).values({
    id,
    workspaceId,
    boardId: input.boardId,
    elementId: input.elementId ?? "",
    anchorLabel: (input.anchorLabel ?? "").slice(0, 120),
    parentId,
    authorId: user.id,
    authorName: user.name,
    body,
  });
  return { id };
}

/** Your own words, changed by you. */
export async function editComment(commentId: string, body: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const [row] = await db.select().from(s.comments).where(eq(s.comments.id, commentId));
  if (!row) return { error: "That comment is gone." };
  const no = await deny(row.workspaceId, "board.comment");
  if (no) return no;

  const user = await currentUser();
  if (row.authorId !== user.id) return { error: "You can only edit what you wrote." };
  const next = cleanBody(body);
  if (!next) return { error: "An empty comment is a deleted one — use delete." };

  await db.update(s.comments).set({ body: next, editedAt: new Date().toISOString() }).where(eq(s.comments.id, commentId));
  return { ok: true };
}

/**
 * Your own words, taken back — and the replies to them are not.
 *
 * Deleting an opening comment leaves its replies behind as threads of their own (`threadsOf`
 * promotes them), because somebody withdrawing their question should not silently delete three
 * colleagues' answers to it.
 */
export async function deleteComment(commentId: string): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const [row] = await db.select().from(s.comments).where(eq(s.comments.id, commentId));
  if (!row) return { error: "That comment is gone." };
  const no = await deny(row.workspaceId, "board.comment");
  if (no) return no;

  const user = await currentUser();
  if (row.authorId !== user.id) return { error: "You can only delete what you wrote." };
  await db.delete(s.comments).where(eq(s.comments.id, commentId));
  return { ok: true };
}

/** Settle a conversation, or reopen it. Anybody who may comment may do either. */
export async function resolveThread(threadId: string, resolved: boolean): Promise<{ ok: true } | { error: string }> {
  const db = await getDb();
  const [row] = await db.select().from(s.comments).where(and(eq(s.comments.id, threadId), isNull(s.comments.parentId)));
  if (!row) return { error: "That conversation is gone." };
  const no = await deny(row.workspaceId, "board.comment");
  if (no) return no;

  const user = await currentUser();
  await db
    .update(s.comments)
    .set(
      resolved
        ? { resolvedAt: new Date().toISOString(), resolvedById: user.id, resolvedByName: user.name }
        : { resolvedAt: null, resolvedById: null, resolvedByName: "" },
    )
    .where(eq(s.comments.id, threadId));
  return { ok: true };
}
