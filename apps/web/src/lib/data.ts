import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";

export async function getWorkspaceBySlug(slug: string) {
  const db = await getDb();
  return db.query.workspaces.findFirst({ where: eq(s.workspaces.slug, slug) });
}

export async function getWorkspaceShell(workspaceId: string, userId: string) {
  const db = await getDb();
  const [teams, rooms, favoriteRows] = await Promise.all([
    db.query.teams.findMany({ where: eq(s.teams.workspaceId, workspaceId), orderBy: s.teams.name }),
    db.query.rooms.findMany({ where: eq(s.rooms.workspaceId, workspaceId), orderBy: s.rooms.name }),
    db
      .select({ board: s.boards })
      .from(s.boardFavorites)
      .innerJoin(s.boards, eq(s.boardFavorites.boardId, s.boards.id))
      .where(and(eq(s.boardFavorites.userId, userId), eq(s.boards.workspaceId, workspaceId)))
      .orderBy(desc(s.boardFavorites.createdAt)),
  ]);
  return { teams, rooms, favorites: favoriteRows.map((r) => r.board) };
}

export type BoardCard = s.Board & { roomName: string; roomEmoji: string; favorite: boolean };

export async function getBoardsForWorkspace(workspaceId: string, userId: string, opts?: { roomId?: string; limit?: number; recentOnly?: boolean }) {
  const db = await getDb();
  const conditions = [eq(s.boards.workspaceId, workspaceId)];
  if (opts?.roomId) conditions.push(eq(s.boards.roomId, opts.roomId));
  if (opts?.recentOnly) conditions.push(isNotNull(s.boards.lastOpenedAt));
  const rows = await db
    .select({
      board: s.boards,
      roomName: s.rooms.name,
      roomEmoji: s.rooms.emoji,
      favorite: sql<number>`(select count(*) from board_favorites f where f.board_id = ${s.boards.id} and f.user_id = ${userId})`,
    })
    .from(s.boards)
    .innerJoin(s.rooms, eq(s.boards.roomId, s.rooms.id))
    .where(and(...conditions))
    .orderBy(opts?.recentOnly ? desc(s.boards.lastOpenedAt) : desc(s.boards.updatedAt))
    .limit(opts?.limit ?? 200);
  return rows.map<BoardCard>((r) => ({ ...r.board, roomName: r.roomName, roomEmoji: r.roomEmoji, favorite: r.favorite > 0 }));
}

export async function getRoom(roomId: string) {
  const db = await getDb();
  return db.query.rooms.findFirst({ where: eq(s.rooms.id, roomId), with: { team: true } });
}

export async function getRoomBoardCounts(workspaceId: string) {
  const db = await getDb();
  const rows = await db
    .select({ roomId: s.boards.roomId, n: sql<number>`count(*)` })
    .from(s.boards)
    .where(eq(s.boards.workspaceId, workspaceId))
    .groupBy(s.boards.roomId);
  return new Map(rows.map((r) => [r.roomId, r.n]));
}

export async function getTeamsWithMembers(workspaceId: string) {
  const db = await getDb();
  return db.query.teams.findMany({
    where: eq(s.teams.workspaceId, workspaceId),
    with: { members: { with: { user: true } }, rooms: true },
    orderBy: s.teams.name,
  });
}

export async function getTeam(teamId: string) {
  const db = await getDb();
  return db.query.teams.findFirst({
    where: eq(s.teams.id, teamId),
    with: { members: { with: { user: true } }, rooms: true },
  });
}

export async function getWorkspaceMembers(workspaceId: string) {
  const db = await getDb();
  return db.query.workspaceMembers.findMany({ where: eq(s.workspaceMembers.workspaceId, workspaceId), with: { user: true } });
}

export async function getBoardWithContext(boardId: string) {
  const db = await getDb();
  return db.query.boards.findFirst({
    where: eq(s.boards.id, boardId),
    with: { room: true, workspace: true },
  });
}

export async function getBoardsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.query.boards.findMany({ where: inArray(s.boards.id, ids) });
}
