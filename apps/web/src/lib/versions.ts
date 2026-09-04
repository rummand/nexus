import { and, desc, eq, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseDocument, serializeDocument, type CanvasDocument } from "@/canvas/document";

/**
 * Board version history. A checkpoint is the full document at a point in time.
 * - auto: taken on save when the last checkpoint is older than AUTO_INTERVAL_MS
 * - manual: "Save checkpoint" with an optional label
 * - restore: the state that was replaced by a restore (so restores are reversible)
 * Auto checkpoints are pruned to MAX_AUTO per board; manual ones are kept.
 */

export const AUTO_INTERVAL_MS = 10 * 60 * 1000;
export const MAX_AUTO = 30;

export interface VersionSummary {
  id: string;
  label: string;
  reason: "auto" | "manual" | "restore";
  objectCount: number;
  createdAt: string;
  createdBy: string | null;
}

export async function listVersions(db: Db, boardId: string): Promise<VersionSummary[]> {
  const rows = await db
    .select({ v: s.boardVersions, userName: s.users.name })
    .from(s.boardVersions)
    .leftJoin(s.users, eq(s.boardVersions.createdById, s.users.id))
    .where(eq(s.boardVersions.boardId, boardId))
    .orderBy(desc(s.boardVersions.createdAt));
  return rows.map((r) => ({ id: r.v.id, label: r.v.label, reason: r.v.reason, objectCount: r.v.objectCount, createdAt: r.v.createdAt, createdBy: r.userName ?? null }));
}

export async function createVersion(db: Db, boardId: string, doc: CanvasDocument, reason: "auto" | "manual" | "restore", label = "", createdById: string | null = null) {
  const id = `ver_${nanoid(12)}`;
  await db.insert(s.boardVersions).values({ id, boardId, label: label.trim(), reason, document: serializeDocument(doc), objectCount: Object.keys(doc.elements).length, createdById, createdAt: new Date().toISOString() });
  if (reason === "auto") await pruneAuto(db, boardId);
  return id;
}

async function pruneAuto(db: Db, boardId: string) {
  const autos = await db.select({ id: s.boardVersions.id, createdAt: s.boardVersions.createdAt }).from(s.boardVersions).where(and(eq(s.boardVersions.boardId, boardId), eq(s.boardVersions.reason, "auto"))).orderBy(desc(s.boardVersions.createdAt));
  const cutoff = autos[MAX_AUTO - 1];
  if (autos.length > MAX_AUTO && cutoff) await db.delete(s.boardVersions).where(and(eq(s.boardVersions.boardId, boardId), eq(s.boardVersions.reason, "auto"), lt(s.boardVersions.createdAt, cutoff.createdAt)));
}

/**
 * Called on every save with the document *before* the save. Takes an auto checkpoint of that
 * previous state when no checkpoint exists yet or the latest one is older than the interval.
 */
export async function autoCheckpoint(db: Db, boardId: string, previous: CanvasDocument, nowMs = Date.now()) {
  if (Object.keys(previous.elements).length === 0) return false;
  const [latest] = await db.select({ createdAt: s.boardVersions.createdAt }).from(s.boardVersions).where(eq(s.boardVersions.boardId, boardId)).orderBy(desc(s.boardVersions.createdAt)).limit(1);
  if (latest && nowMs - new Date(latest.createdAt).getTime() < AUTO_INTERVAL_MS) return false;
  await createVersion(db, boardId, previous, "auto");
  return true;
}

/** The stored document of one version (null when it does not belong to the board). */
export async function getVersionDocument(db: Db, boardId: string, versionId: string): Promise<CanvasDocument | null> {
  const version = await db.query.boardVersions.findFirst({ where: and(eq(s.boardVersions.id, versionId), eq(s.boardVersions.boardId, boardId)) });
  return version ? parseDocument(version.document) : null;
}

/** Restore a version: checkpoint the current state, then replace the board document. */
export async function restoreVersion(db: Db, boardId: string, versionId: string, createdById: string | null = null): Promise<CanvasDocument | null> {
  const version = await db.query.boardVersions.findFirst({ where: and(eq(s.boardVersions.id, versionId), eq(s.boardVersions.boardId, boardId)) });
  const board = await db.query.boards.findFirst({ where: eq(s.boards.id, boardId) });
  if (!version || !board) return null;
  const current = parseDocument(board.document);
  await createVersion(db, boardId, current, "restore", `Before restoring ${new Date(version.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`, createdById);
  const doc = parseDocument(version.document);
  await db.update(s.boards).set({ document: serializeDocument(doc), updatedAt: new Date().toISOString() }).where(eq(s.boards.id, boardId));
  return doc;
}
