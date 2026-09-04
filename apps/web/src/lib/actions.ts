"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { currentUser } from "./session";
import { emptyDocument, serializeDocument } from "@/canvas/document";
import { buildTemplate, type TemplateId } from "@/canvas/templates";

const now = () => new Date().toISOString();

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || nanoid(6);
}

async function workspaceSlug(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  if (!ws) throw new Error("Workspace not found");
  return ws.slug;
}

// ---- spaces -----------------------------------------------------------------

export async function createSpace(input: { workspaceId: string; name: string; description?: string; emoji?: string; teamId?: string | null; visibility?: "open" | "private" }) {
  const db = await getDb();
  const name = input.name.trim();
  if (!name) return { error: "Name is required" };
  const id = `space_${nanoid(10)}`;
  await db.insert(s.spaces).values({
    id,
    workspaceId: input.workspaceId,
    name,
    description: input.description?.trim() ?? "",
    emoji: input.emoji?.trim() || "🗂️",
    teamId: input.teamId || null,
    visibility: input.visibility ?? "open",
  });
  const slug = await workspaceSlug(input.workspaceId);
  revalidatePath(`/w/${slug}`, "layout");
  redirect(`/w/${slug}/spaces/${id}`);
}

export async function renameSpace(spaceId: string, name: string) {
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) return;
  const [space] = await db.update(s.spaces).set({ name: trimmed, updatedAt: now() }).where(eq(s.spaces.id, spaceId)).returning();
  if (space) revalidatePath(`/w/${await workspaceSlug(space.workspaceId)}`, "layout");
}

export async function updateSpace(spaceId: string, patch: { description?: string; emoji?: string; teamId?: string | null; visibility?: "open" | "private" }) {
  const db = await getDb();
  const [space] = await db.update(s.spaces).set({ ...patch, updatedAt: now() }).where(eq(s.spaces.id, spaceId)).returning();
  if (space) revalidatePath(`/w/${await workspaceSlug(space.workspaceId)}`, "layout");
}

export async function deleteSpace(spaceId: string) {
  const db = await getDb();
  const [space] = await db.delete(s.spaces).where(eq(s.spaces.id, spaceId)).returning();
  if (!space) return;
  const slug = await workspaceSlug(space.workspaceId);
  revalidatePath(`/w/${slug}`, "layout");
  redirect(`/w/${slug}`);
}

// ---- boards ----------------------------------------------------------------

export async function createBoard(input: { workspaceId: string; spaceId: string; name?: string; description?: string; template?: TemplateId }) {
  const db = await getDb();
  const user = await currentUser();
  const id = `brd_${nanoid(10)}`;
  const template = input.template ?? "blank";
  const document = template === "blank" ? emptyDocument() : buildTemplate(template);
  await db.insert(s.boards).values({
    id,
    workspaceId: input.workspaceId,
    spaceId: input.spaceId,
    name: input.name?.trim() || "Untitled board",
    description: input.description?.trim() ?? "",
    createdById: user.id,
    document: serializeDocument(document),
    lastOpenedAt: now(),
  });
  revalidatePath(`/w/${await workspaceSlug(input.workspaceId)}`, "layout");
  redirect(`/b/${id}`);
}

export async function renameBoard(boardId: string, name: string) {
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) return;
  const [board] = await db.update(s.boards).set({ name: trimmed, updatedAt: now() }).where(eq(s.boards.id, boardId)).returning();
  if (board) revalidatePath(`/w/${await workspaceSlug(board.workspaceId)}`, "layout");
}

export async function moveBoard(boardId: string, spaceId: string) {
  const db = await getDb();
  const space = await db.query.spaces.findFirst({ where: eq(s.spaces.id, spaceId) });
  if (!space) return;
  const [board] = await db.update(s.boards).set({ spaceId, updatedAt: now() }).where(eq(s.boards.id, boardId)).returning();
  if (board) revalidatePath(`/w/${await workspaceSlug(board.workspaceId)}`, "layout");
}

export async function updateBoardDescription(boardId: string, description: string) {
  const db = await getDb();
  const [board] = await db.update(s.boards).set({ description: description.trim(), updatedAt: now() }).where(eq(s.boards.id, boardId)).returning();
  if (board) revalidatePath(`/w/${await workspaceSlug(board.workspaceId)}`, "layout");
}

export async function deleteBoard(boardId: string) {
  const db = await getDb();
  const [board] = await db.delete(s.boards).where(eq(s.boards.id, boardId)).returning();
  if (board) revalidatePath(`/w/${await workspaceSlug(board.workspaceId)}`, "layout");
}

export async function duplicateBoard(boardId: string) {
  const db = await getDb();
  const user = await currentUser();
  const src = await db.query.boards.findFirst({ where: eq(s.boards.id, boardId) });
  if (!src) return;
  const id = `brd_${nanoid(10)}`;
  await db.insert(s.boards).values({
    id,
    workspaceId: src.workspaceId,
    spaceId: src.spaceId,
    name: `${src.name} (copy)`,
    description: src.description,
    document: src.document,
    createdById: user.id,
  });
  revalidatePath(`/w/${await workspaceSlug(src.workspaceId)}`, "layout");
}

export async function toggleFavorite(boardId: string) {
  const db = await getDb();
  const user = await currentUser();
  const existing = await db.query.boardFavorites.findFirst({
    where: and(eq(s.boardFavorites.userId, user.id), eq(s.boardFavorites.boardId, boardId)),
  });
  if (existing) {
    await db.delete(s.boardFavorites).where(and(eq(s.boardFavorites.userId, user.id), eq(s.boardFavorites.boardId, boardId)));
  } else {
    await db.insert(s.boardFavorites).values({ userId: user.id, boardId });
  }
  const board = await db.query.boards.findFirst({ where: eq(s.boards.id, boardId) });
  if (board) revalidatePath(`/w/${await workspaceSlug(board.workspaceId)}`, "layout");
  return !existing;
}

export async function markBoardOpened(boardId: string) {
  const db = await getDb();
  await db.update(s.boards).set({ lastOpenedAt: now() }).where(eq(s.boards.id, boardId));
}

// ---- teams -----------------------------------------------------------------

export async function createTeam(input: { workspaceId: string; name: string; description?: string; color?: string }) {
  const db = await getDb();
  const user = await currentUser();
  const name = input.name.trim();
  if (!name) return { error: "Name is required" };
  const id = `team_${nanoid(10)}`;
  await db.insert(s.teams).values({
    id,
    workspaceId: input.workspaceId,
    slug: slugify(name),
    name,
    description: input.description?.trim() ?? "",
    color: input.color ?? "#6366f1",
  });
  await db.insert(s.teamMembers).values({ teamId: id, userId: user.id, role: "lead" });
  const slug = await workspaceSlug(input.workspaceId);
  revalidatePath(`/w/${slug}`, "layout");
  redirect(`/w/${slug}/teams/${id}`);
}

export async function renameTeam(teamId: string, name: string) {
  const db = await getDb();
  const trimmed = name.trim();
  if (!trimmed) return;
  const [team] = await db.update(s.teams).set({ name: trimmed }).where(eq(s.teams.id, teamId)).returning();
  if (team) revalidatePath(`/w/${await workspaceSlug(team.workspaceId)}`, "layout");
}

export async function setTeamMembership(teamId: string, userId: string, member: boolean) {
  const db = await getDb();
  if (member) {
    await db.insert(s.teamMembers).values({ teamId, userId, role: "member" }).onConflictDoNothing();
  } else {
    await db.delete(s.teamMembers).where(and(eq(s.teamMembers.teamId, teamId), eq(s.teamMembers.userId, userId)));
  }
  const team = await db.query.teams.findFirst({ where: eq(s.teams.id, teamId) });
  if (team) revalidatePath(`/w/${await workspaceSlug(team.workspaceId)}`, "layout");
}

export async function deleteTeam(teamId: string) {
  const db = await getDb();
  const [team] = await db.delete(s.teams).where(eq(s.teams.id, teamId)).returning();
  if (!team) return;
  const slug = await workspaceSlug(team.workspaceId);
  revalidatePath(`/w/${slug}`, "layout");
  redirect(`/w/${slug}/teams`);
}
