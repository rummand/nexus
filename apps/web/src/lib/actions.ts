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
import { buildBoardFromGraph, graphForWorkspace, importGraph, parseAttributes, parseImportText } from "./graph";
import type { ImportResult, Proposal } from "./graph-types";
import { mergeEntities, recordDecision, renameAttributeKey, renameAttributeValue, setEntityAttribute } from "./proposals";

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
  try {
    await db.update(s.boards).set({ lastOpenedAt: now() }).where(eq(s.boards.id, boardId));
  } catch (e) {
    // best-effort bookkeeping; a transient lock must never break opening a board
    console.warn("markBoardOpened failed", e instanceof Error ? e.message : e);
  }
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

// ---- knowledge graph ---------------------------------------------------------

export async function importGraphText(workspaceId: string, text: string, sourceName?: string): Promise<ImportResult | { error: string }> {
  const db = await getDb();
  let payload;
  try {
    payload = parseImportText(text);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not parse input" };
  }
  if (payload.entities.length === 0 && payload.relations.length === 0) return { error: "Nothing to import — expected kind,name[,description] rows or JSON." };
  const result = await importGraph(db, workspaceId, payload, sourceName ? `import:${sourceName}` : "import");
  revalidatePath(`/w/${await workspaceSlug(workspaceId)}`, "layout");
  return result;
}

export async function renameKind(workspaceId: string, from: string, to: string) {
  const db = await getDb();
  const target = to.trim();
  if (!target) return;
  await db.update(s.entities).set({ kind: target, updatedAt: now() }).where(and(eq(s.entities.workspaceId, workspaceId), eq(s.entities.kind, from)));
  revalidatePath(`/w/${await workspaceSlug(workspaceId)}`, "layout");
}

export async function updateEntity(entityId: string, patch: { kind?: string; name?: string; description?: string }) {
  const db = await getDb();
  const [row] = await db.update(s.entities).set({ ...patch, updatedAt: now() }).where(eq(s.entities.id, entityId)).returning();
  if (row) revalidatePath(`/w/${await workspaceSlug(row.workspaceId)}`, "layout");
}

/** Rename an attribute key across the workspace (the kind card's schema chips). */
export async function renameAttributeKeyAction(workspaceId: string, from: string, to: string) {
  const db = await getDb();
  const target = to.trim();
  if (!target || target === from) return;
  await renameAttributeKey(db, workspaceId, from, target);
  revalidatePath(`/w/${await workspaceSlug(workspaceId)}`, "layout");
}

/** Set (or, with an empty value, remove) one attribute on one entity — the table view's cell editor. */
export async function setEntityAttributeAction(entityId: string, key: string, value: string) {
  const db = await getDb();
  const k = key.trim();
  if (!k) return { error: "An attribute key is required" };
  const [row] = await db.select().from(s.entities).where(eq(s.entities.id, entityId));
  if (!row) return { error: "Entity not found" };
  if (value.trim()) await setEntityAttribute(db, entityId, k, value.trim());
  else {
    const { [k]: _removed, ...rest } = parseAttributes(row.attributes);
    void _removed;
    await db.update(s.entities).set({ attributes: JSON.stringify(rest), updatedAt: now() }).where(eq(s.entities.id, entityId));
  }
  revalidatePath(`/w/${await workspaceSlug(row.workspaceId)}`, "layout");
}

export async function deleteEntity(entityId: string) {
  const db = await getDb();
  const [row] = await db.delete(s.entities).where(eq(s.entities.id, entityId)).returning();
  if (row) revalidatePath(`/w/${await workspaceSlug(row.workspaceId)}`, "layout");
}

/** Lay the (optionally kind-filtered) graph out on a new board in the given space. */
export async function createBoardFromGraph(input: { workspaceId: string; spaceId: string; name?: string; kinds?: string[] }) {
  const db = await getDb();
  const user = await currentUser();
  const { entities, relations } = await graphForWorkspace(db, input.workspaceId, input.kinds);
  if (entities.length === 0) return { error: "The graph has no entities to lay out." };
  const name = input.name?.trim() || (input.kinds?.length ? `${input.kinds.join(", ")} — from graph` : "Whole graph");
  const doc = buildBoardFromGraph(entities, relations, name);
  const id = `brd_${nanoid(10)}`;
  await db.insert(s.boards).values({
    id,
    workspaceId: input.workspaceId,
    spaceId: input.spaceId,
    name,
    description: `Laid out from the knowledge graph: ${entities.length} entities, ${relations.length} relations.`,
    createdById: user.id,
    document: serializeDocument(doc),
    lastOpenedAt: now(),
  });
  // index the board's cards right away so the inventory shows them
  const { syncBoardToGraph } = await import("./graph");
  await syncBoardToGraph(db, { id, workspaceId: input.workspaceId }, doc);
  revalidatePath(`/w/${await workspaceSlug(input.workspaceId)}`, "layout");
  redirect(`/b/${id}`);
}

// ---- agent proposals ---------------------------------------------------------

export async function acceptProposal(workspaceId: string, proposal: Proposal, override?: string) {
  const db = await getDb();
  const a = proposal.action;
  switch (a.kind) {
    case "merge":
      await mergeEntities(db, workspaceId, a.survivorId, a.otherIds);
      break;
    case "renameKind":
      await db.update(s.entities).set({ kind: override ?? a.to, updatedAt: now() }).where(and(eq(s.entities.workspaceId, workspaceId), eq(s.entities.kind, a.from)));
      break;
    case "setKind": {
      const to = (override ?? a.to).trim();
      if (!to) return { error: "A kind is required" };
      await db.update(s.entities).set({ kind: to, updatedAt: now() }).where(eq(s.entities.id, a.entityId));
      break;
    }
    case "setRelationKind": {
      const to = (override ?? a.to).trim();
      if (!to) return { error: "A label is required" };
      await db.update(s.relations_).set({ kind: to, updatedAt: now() }).where(eq(s.relations_.id, a.relationId));
      break;
    }
    case "deleteEntity":
      await db.delete(s.entities).where(eq(s.entities.id, a.entityId));
      break;
    case "renameAttributeKey":
      await renameAttributeKey(db, workspaceId, a.from, (override ?? a.to).trim() || a.to);
      break;
    case "renameAttributeValue":
      await renameAttributeValue(db, workspaceId, a.key, a.from, (override ?? a.to).trim() || a.to);
      break;
    case "setAttribute": {
      const to = (override ?? a.to).trim();
      if (!to) return { error: "A value is required" };
      await setEntityAttribute(db, a.entityId, a.key, to);
      break;
    }
  }
  await recordDecision(db, workspaceId, proposal.key, "accepted");
  revalidatePath(`/w/${await workspaceSlug(workspaceId)}`, "layout");
}

export async function dismissProposal(workspaceId: string, key: string) {
  const db = await getDb();
  await recordDecision(db, workspaceId, key, "dismissed");
  revalidatePath(`/w/${await workspaceSlug(workspaceId)}`, "layout");
}

/** Merge from a board: returns the id mapping so the open canvas can relink its cards. */
export async function mergeEntitiesAction(workspaceId: string, survivorId: string, otherIds: string[]) {
  const db = await getDb();
  const result = await mergeEntities(db, workspaceId, survivorId, otherIds);
  revalidatePath(`/w/${await workspaceSlug(workspaceId)}`, "layout");
  return { ...result, survivorId, otherIds };
}

export async function renameRelationKind(workspaceId: string, from: string, to: string) {
  const db = await getDb();
  const target = to.trim();
  await db.update(s.relations_).set({ kind: target, updatedAt: now() }).where(and(eq(s.relations_.workspaceId, workspaceId), eq(s.relations_.kind, from)));
  revalidatePath(`/w/${await workspaceSlug(workspaceId)}`, "layout");
}
