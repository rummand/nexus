import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { currentCheckout, refChoices } from "@/lib/change/checkout";
import * as s from "@/db/schema";

export async function getWorkspaceBySlug(slug: string) {
  const db = await getDb();
  return db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
}

export async function getWorkspaceShell(workspaceId: string, userId: string) {
  const db = await getDb();
  const [teams, spaces, favoriteRows, checkout, refs] = await Promise.all([
    db.query.teams.findMany({ where: eq(s.teams.workspaceId, workspaceId), orderBy: s.teams.name }),
    db.query.spaces.findMany({ where: eq(s.spaces.workspaceId, workspaceId), orderBy: s.spaces.name }),
    db
      .select({ board: s.boards })
      .from(s.boardFavorites)
      .innerJoin(s.boards, eq(s.boardFavorites.boardId, s.boards.id))
      .where(and(eq(s.boardFavorites.userId, userId), eq(s.boards.workspaceId, workspaceId)))
      .orderBy(desc(s.boardFavorites.createdAt)),
    // Which ref this person is standing on, and where else they could stand (§5.82). Part of the
    // shell because it is chrome: it is on every page, so it is loaded once with the rest of it.
    currentCheckout(db, workspaceId, userId),
    refChoices(db, workspaceId),
  ]);
  return { teams, spaces, favorites: favoriteRows.map((r) => r.board), checkout, refs };
}

export type BoardCard = s.Board & { spaceName: string; spaceEmoji: string; favorite: boolean };

export async function getBoardsForWorkspace(workspaceId: string, userId: string, opts?: { spaceId?: string; limit?: number; recentOnly?: boolean }) {
  const db = await getDb();
  const conditions = [eq(s.boards.workspaceId, workspaceId)];
  if (opts?.spaceId) conditions.push(eq(s.boards.spaceId, opts.spaceId));
  if (opts?.recentOnly) conditions.push(isNotNull(s.boards.lastOpenedAt));
  const rows = await db
    .select({
      board: s.boards,
      spaceName: s.spaces.name,
      spaceEmoji: s.spaces.emoji,
      favorite: sql<number>`(select count(*) from board_favorites f where f.board_id = ${s.boards.id} and f.user_id = ${userId})`,
    })
    .from(s.boards)
    .innerJoin(s.spaces, eq(s.boards.spaceId, s.spaces.id))
    .where(and(...conditions))
    .orderBy(opts?.recentOnly ? desc(s.boards.lastOpenedAt) : desc(s.boards.updatedAt))
    .limit(opts?.limit ?? 200);
  return rows.map<BoardCard>((r) => ({ ...r.board, spaceName: r.spaceName, spaceEmoji: r.spaceEmoji, favorite: r.favorite > 0 }));
}

export async function getSpace(spaceId: string) {
  const db = await getDb();
  return db.query.spaces.findFirst({ where: eq(s.spaces.id, spaceId), with: { team: true } });
}

export async function getSpaceBoardCounts(workspaceId: string) {
  const db = await getDb();
  const rows = await db
    .select({ spaceId: s.boards.spaceId, n: sql<number>`count(*)` })
    .from(s.boards)
    .where(eq(s.boards.workspaceId, workspaceId))
    .groupBy(s.boards.spaceId);
  return new Map(rows.map((r) => [r.spaceId, r.n]));
}

export async function getTeamsWithMembers(workspaceId: string) {
  const db = await getDb();
  return db.query.teams.findMany({
    where: eq(s.teams.workspaceId, workspaceId),
    with: { members: { with: { user: true } }, spaces: true },
    orderBy: s.teams.name,
  });
}

export async function getTeam(teamId: string) {
  const db = await getDb();
  return db.query.teams.findFirst({
    where: eq(s.teams.id, teamId),
    with: { members: { with: { user: true } }, spaces: true },
  });
}

/**
 * The workspaces somebody belongs to (§5.48).
 *
 * Membership, not existence: the schema has been workspace-scoped since the first week, but every
 * page resolved a workspace by slug and showed it to anybody who was signed in. A second workspace
 * makes that a hole rather than a curiosity, so this is also what the layout checks.
 */
export async function getWorkspacesFor(userId: string) {
  const db = await getDb();
  const rows = await db.query.workspaceMembers.findMany({
    where: eq(s.workspaceMembers.userId, userId),
    with: { workspace: true },
  });
  return rows
    .map((r) => ({ id: r.workspaceId, slug: r.workspace.slug, name: r.workspace.name, role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getWorkspaceMembers(workspaceId: string) {
  const db = await getDb();
  return db.query.workspaceMembers.findMany({ where: eq(s.workspaceMembers.workspaceId, workspaceId), with: { user: true } });
}

export async function getBoardWithContext(boardId: string) {
  const db = await getDb();
  return db.query.boards.findFirst({
    where: eq(s.boards.id, boardId),
    with: { space: true, workspace: true },
  });
}

export async function getBoardsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.query.boards.findMany({ where: inArray(s.boards.id, ids) });
}
