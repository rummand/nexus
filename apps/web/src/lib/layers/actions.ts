"use server";

import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { metaModel } from "@/lib/metamodel";
import { inferLayers } from "./infer";
import { observedEdges, typeCounts } from "./read";

/**
 * Editing the stack (§5.58).
 *
 * Deleting a layer is the one with a decision in it: the types in it are not deleted with it, they
 * are unplaced. A layer is an opinion about the model, and withdrawing an opinion must not delete
 * the things it was about — the same rule that governs abandoning a framework (§5.57). The foreign
 * key does it, with `on delete set null`.
 */

const now = () => new Date().toISOString();

async function touched(workspaceId: string) {
  const db = await getDb();
  const [ws] = await db.select({ slug: s.workspaces.slug }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (ws) revalidatePath(`/w/${ws.slug}`, "layout");
}

/** Which workspace a layer belongs to, for the guard (§5.46). */
async function denyLayer(id: string) {
  const db = await getDb();
  const row = await db.query.layers.findFirst({ where: eq(s.layers.id, id) });
  if (!row) return { error: "That layer is gone." };
  const no = await deny(row.workspaceId, "graph.edit");
  return no ?? { ok: true as const, workspaceId: row.workspaceId, row };
}

export async function createLayer(workspaceId: string, name: string, description = "") {
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
  const trimmed = name.trim();
  if (!trimmed) return { error: "A name is required" };
  const db = await getDb();
  const existing = await db.select().from(s.layers).where(eq(s.layers.workspaceId, workspaceId));
  if (existing.some((l) => l.name.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { error: `“${trimmed}” already exists` };
  }
  const id = `lyr_${nanoid(10)}`;
  await db.insert(s.layers).values({
    id, workspaceId, name: trimmed, description: description.trim(), source: "",
    position: existing.reduce((n, l) => Math.max(n, l.position + 1), 0),
  });
  await touched(workspaceId);
  return { id };
}

export async function updateLayer(id: string, patch: { name?: string; description?: string; color?: string }) {
  const guard = await denyLayer(id);
  if ("error" in guard) return guard;
  const db = await getDb();
  const next: Partial<typeof s.layers.$inferInsert> = { updatedAt: now() };
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return { error: "A name is required" };
    next.name = trimmed;
  }
  if (patch.description !== undefined) next.description = patch.description.trim();
  if (patch.color !== undefined) next.color = patch.color;
  await db.update(s.layers).set(next).where(eq(s.layers.id, id));
  await touched(guard.workspaceId);
  return { ok: true };
}

/**
 * Delete a layer. The types in it are unplaced, never deleted.
 */
export async function deleteLayer(id: string) {
  const guard = await denyLayer(id);
  if ("error" in guard) return guard;
  const db = await getDb();
  await db.delete(s.layers).where(eq(s.layers.id, id));
  await touched(guard.workspaceId);
  return { ok: true };
}

/** Move one layer up or down the stack, renumbering the whole workspace so positions stay dense. */
export async function moveLayer(id: string, direction: "up" | "down") {
  const guard = await denyLayer(id);
  if ("error" in guard) return guard;
  const db = await getDb();
  const all = (await db.select().from(s.layers).where(eq(s.layers.workspaceId, guard.workspaceId)))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const i = all.findIndex((l) => l.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return { ok: true };
  [all[i], all[j]] = [all[j]!, all[i]!];
  for (const [position, l] of all.entries()) {
    if (l.position !== position) await db.update(s.layers).set({ position, updatedAt: now() }).where(eq(s.layers.id, l.id));
  }
  await touched(guard.workspaceId);
  return { ok: true };
}

/** Put a node type in a layer, or take it out of all of them. */
export async function placeNodeType(nodeTypeId: string, layerId: string | null) {
  const db = await getDb();
  const row = await db.query.nodeTypes.findFirst({ where: eq(s.nodeTypes.id, nodeTypeId) });
  if (!row) return { error: "That type is gone." };
  const no = await deny(row.workspaceId, "graph.edit");
  if (no) return no;
  if (layerId) {
    const layer = await db.query.layers.findFirst({ where: and(eq(s.layers.id, layerId), eq(s.layers.workspaceId, row.workspaceId)) });
    if (!layer) return { error: "That layer is gone." };
  }
  await db.update(s.nodeTypes).set({ layerId, updatedAt: now() }).where(eq(s.nodeTypes.id, nodeTypeId));
  await touched(row.workspaceId);
  return { ok: true };
}

/** The same for a relation type, where a layer is vocabulary rather than position. */
export async function placeRelationType(relationTypeId: string, layerId: string | null) {
  const db = await getDb();
  const row = await db.query.relationTypes.findFirst({ where: eq(s.relationTypes.id, relationTypeId) });
  if (!row) return { error: "That relation type is gone." };
  const no = await deny(row.workspaceId, "graph.edit");
  if (no) return no;
  await db.update(s.relationTypes).set({ layerId, updatedAt: now() }).where(eq(s.relationTypes.id, relationTypeId));
  await touched(row.workspaceId);
  return { ok: true };
}

/**
 * Take the layering the estate suggests (§5.58, §2.2).
 *
 * The proposal is recomputed here rather than posted from the browser: it is derived from the graph
 * and the graph may have moved on, and a client that can name its own bands could put anything in
 * them. What is written is what the data says at the moment of the write.
 *
 * Additive, like everything else that writes a model: a band whose name the workspace already has
 * is reused, and a type somebody has already placed by hand is left where they put it. An agent
 * that overwrites a person's decision is one people turn off.
 */
export async function adoptInferredLayering(workspaceId: string) {
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
  const db = await getDb();
  const model = await metaModel(db, workspaceId);
  const reading = inferLayers(typeCounts(model), observedEdges(model));
  if (!reading.confident) return { error: reading.verdict };

  const byName = new Map(model.layers.map((l) => [l.name.trim().toLowerCase(), l]));
  let position = model.layers.reduce((n, l) => Math.max(n, l.position + 1), 0);
  const types = new Map(model.nodeTypes.map((t) => [t.name.trim().toLowerCase(), t]));

  let created = 0;
  let placed = 0;
  let declared = 0;
  for (const band of reading.layers) {
    const at = band.name.trim().toLowerCase();
    let id = byName.get(at)?.id;
    if (!id) {
      id = `lyr_${nanoid(10)}`;
      await db.insert(s.layers).values({
        id, workspaceId, name: band.name, description: band.why, source: "agent", position: position++,
      });
      // Seen by the rest of this loop too, so two bands can never race to create the same name.
      byName.set(at, { id, name: band.name, description: band.why, color: "", position: position - 1, source: "agent" });
      created++;
    }
    for (const typeName of band.types) {
      const t = types.get(typeName.trim().toLowerCase());
      if (!t) continue;
      if (t.id) {
        if (t.layerId) continue; // never move a type somebody placed themselves
        await db.update(s.nodeTypes).set({ layerId: id, updatedAt: now() }).where(eq(s.nodeTypes.id, t.id));
        placed++;
        continue;
      }
      /*
       * The kind grew from the data and nobody has declared it, so there is no row to put in a
       * layer. Declaring it is the honest consequence of accepting the layering rather than a side
       * effect to hide: you cannot place a kind that is not a type. It is additive — the name,
       * colour and instances are exactly what the data already had — and the button says so.
       */
      const id2 = `nt_${nanoid(10)}`;
      await db.insert(s.nodeTypes).values({ id: id2, workspaceId, name: t.name, color: t.color, layerId: id });
      declared++;
      placed++;
    }
  }
  await touched(workspaceId);
  return { created, declared, placed, bands: reading.layers.length };
}
