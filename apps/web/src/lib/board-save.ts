import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseDocument, serializeDocument, type CanvasDocument } from "@/canvas/document";
import { autoCheckpoint } from "./versions";

/**
 * The result of a conditional board save.
 *
 * "conflict" is not an error to retry: somebody else saved between this client reading the board
 * and writing it, so saving anyway would silently drop their work. We have no merge, so the only
 * honest answer is to refuse and say so.
 */
export type SaveResult =
  | { status: "saved"; revision: number; workspaceId: string; updatedAt: string }
  | { status: "notFound" }
  | { status: "conflict"; revision: number };

/**
 * Write a board document, optionally conditional on the revision the client last saw.
 *
 * `expected === null` keeps the old last-writer-wins behaviour for callers that do not track a
 * revision (an older tab, a script). Passing a revision opts into the guard.
 */
export async function saveBoardDocument(db: Db, boardId: string, doc: CanvasDocument, expected: number | null): Promise<SaveResult> {
  const previous = await db.query.boards.findFirst({
    where: eq(s.boards.id, boardId),
    columns: { document: true, revision: true },
  });
  if (!previous) return { status: "notFound" };
  // time-based checkpoint of the state we are about to overwrite
  await autoCheckpoint(db, boardId, parseDocument(previous.document));

  const updatedAt = new Date().toISOString();
  const next = previous.revision + 1;
  const [row] = await db
    .update(s.boards)
    .set({ document: serializeDocument(doc), updatedAt, revision: next })
    .where(expected === null ? eq(s.boards.id, boardId) : and(eq(s.boards.id, boardId), eq(s.boards.revision, expected)))
    .returning({ id: s.boards.id, workspaceId: s.boards.workspaceId });

  if (!row) return { status: "conflict", revision: previous.revision };
  return { status: "saved", revision: next, workspaceId: row.workspaceId, updatedAt };
}
