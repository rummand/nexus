/*
 * No `server-only` marker, deliberately: this is reached through `graph.ts`, which the canvas
 * imports from a client component, and the marker would fail the whole client build. It is a
 * server module by virtue of needing a `Db` — the same convention `graph.ts` itself follows.
 */
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { boardSetName } from "./board-write";

/**
 * The change set a board opens for itself (#149, §5.100).
 *
 * Somebody standing on `main` draws a new application. It cannot go into the estate — nothing new
 * lands unseen — and it cannot go nowhere. So the board opens a branch of its own, and reuses it
 * for everything drawn afterwards.
 *
 * **One branch per board, not one per save.** The same shape as a source branch (§5.92): a board
 * keeps producing claims for as long as people draw on it, and a branch per autosave would be a
 * review queue nobody could read. It is found by `boardId` and reused while it is still open;
 * once it is delivered or abandoned the next new object opens a fresh one, which is right — that
 * is a new piece of work, not a reopening of a finished one.
 */

const now = () => new Date().toISOString();

/** The board's open branch, or a new one. Never returns a delivered or abandoned set. */
export async function openBoardSet(
  db: Db,
  board: { id: string; workspaceId: string; name?: string },
  createdById?: string | null,
): Promise<string> {
  const existing = await db.query.changeSets.findFirst({
    where: and(
      eq(s.changeSets.boardId, board.id),
      eq(s.changeSets.workspaceId, board.workspaceId),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  // draft and planned are both still open; delivered is history and abandoned is a decision.
  if (existing && (existing.status === "draft" || existing.status === "planned")) return existing.id;

  const id = `chg_${nanoid(10)}`;
  await db.insert(s.changeSets).values({
    id,
    workspaceId: board.workspaceId,
    name: boardSetName(board.name ?? ""),
    description:
      "Objects drawn on this board. They are proposals until this is delivered — nothing new "
      + "enters the model without somebody seeing it.",
    status: "draft",
    boardId: board.id,
    createdById: createdById ?? null,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

/**
 * What this board has drawn and not yet agreed (#149, §5.101).
 *
 * Read on every board open and handed to the canvas, rather than marked onto the cards. The
 * distinction is the whole lesson of the first attempt: a mark in the document is persisted, can
 * go stale, and disappears when the document is replaced in place. This is derived from the branch
 * every time, so it cannot be any of those things.
 *
 * Only an *open* branch counts. Once it is delivered the objects are in the estate and once it is
 * abandoned they are not coming, and in neither case is there anything for a person to add.
 */
export async function outstandingDrafts(
  db: Db,
  boardId: string,
): Promise<{ setId: string; setName: string; entityIds: string[]; relationIds: string[] } | null> {
  const set = await db.query.changeSets.findFirst({
    where: eq(s.changeSets.boardId, boardId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!set || (set.status !== "draft" && set.status !== "planned")) return null;
  const rows = await db.select().from(s.changes).where(eq(s.changes.changeSetId, set.id));
  const entityIds = rows.filter((r) => r.op === "addEntity" && r.entityId).map((r) => r.entityId!);
  const relationIds = rows.filter((r) => r.op === "addRelation" && r.relationId).map((r) => r.relationId!);
  if (!entityIds.length && !relationIds.length) return null;
  return { setId: set.id, setName: set.name, entityIds, relationIds };
}
