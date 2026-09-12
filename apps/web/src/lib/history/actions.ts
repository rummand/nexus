"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { currentUser } from "@/lib/session";

/**
 * Naming a moment (#112, §5.98).
 *
 * Guarded by `graph.edit` rather than anything heavier: naming a moment writes one row, changes
 * nothing about the estate, and the people who want to mark "before the LeanIX import" are the
 * same people doing the import. Deleting one removes the label and not the history, which is the
 * property that makes it safe to hand out.
 */

const now = () => new Date().toISOString();

async function slugOf(workspaceId: string) {
  const db = await getDb();
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  return ws?.slug ?? "";
}

export async function markCheckpoint(input: { workspaceId: string; label: string; note?: string; at?: string }): Promise<{ id: string } | { error: string }> {
  const no = await deny(input.workspaceId, "graph.edit");
  if (no) return no;
  const label = input.label.trim().slice(0, 120);
  if (!label) return { error: "What is this moment called?" };

  /*
   * A moment in the future is not a checkpoint, it is a date in a plan — and the rewind would
   * return today's estate for it, which reads as "nothing has changed since" and is a lie.
   */
  const at = input.at?.trim() ? new Date(input.at) : new Date();
  if (Number.isNaN(at.getTime())) return { error: "That is not a date." };
  if (at.getTime() > Date.now() + 60_000) return { error: "A checkpoint marks a moment that has happened. For a date ahead, make a plan on the roadmap." };

  const db = await getDb();
  const user = await currentUser();
  const id = `cpt_${nanoid(10)}`;
  await db.insert(s.checkpoints).values({
    id,
    workspaceId: input.workspaceId,
    label,
    at: at.toISOString(),
    note: (input.note ?? "").trim().slice(0, 500),
    createdById: user.id,
    createdAt: now(),
  });
  const slug = await slugOf(input.workspaceId);
  if (slug) revalidatePath(`/w/${slug}/checkpoints`);
  return { id };
}

export async function forgetCheckpoint(workspaceId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
  const db = await getDb();
  // The label goes; the history it pointed at is untouched, which is why this needs no ceremony.
  await db.delete(s.checkpoints).where(and(eq(s.checkpoints.id, id), eq(s.checkpoints.workspaceId, workspaceId)));
  const slug = await slugOf(workspaceId);
  if (slug) revalidatePath(`/w/${slug}/checkpoints`);
  return { ok: true };
}
