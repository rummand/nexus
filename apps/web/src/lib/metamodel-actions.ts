"use server";

import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";


/**
 * Editing the meta-model. Renaming a type is the interesting one: the declared row and every
 * instance must move together, or the declaration silently stops matching its own data.
 */

const now = () => new Date().toISOString();

/** Revalidate the workspace's pages after a meta-model change. */
async function touched(workspaceId: string) {
  const db = await getDb();
  const [ws] = await db.select({ slug: s.workspaces.slug }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (ws) revalidatePath(`/w/${ws.slug}`, "layout");
}

// ---- node types --------------------------------------------------------------------------

export async function createNodeType(workspaceId: string, name: string, description = "", color = "") {
  const trimmed = name.trim();
  if (!trimmed) return { error: "A name is required" };
  const db = await getDb();
  const clash = await db.select().from(s.nodeTypes).where(and(eq(s.nodeTypes.workspaceId, workspaceId), sql`lower(${s.nodeTypes.name}) = ${trimmed.toLowerCase()}`));
  if (clash.length) return { error: `“${trimmed}” already exists` };
  const id = `nt_${nanoid(10)}`;
  await db.insert(s.nodeTypes).values({ id, workspaceId, name: trimmed, description: description.trim(), color });
  await touched(workspaceId);
  return { id };
}

/** Declare a kind that so far only exists in the data — the "promote" action. */
export async function declareNodeType(workspaceId: string, name: string) {
  return createNodeType(workspaceId, name);
}

export async function updateNodeType(id: string, patch: { name?: string; description?: string; color?: string; parentId?: string | null }) {
  const db = await getDb();
  const [row] = await db.select().from(s.nodeTypes).where(eq(s.nodeTypes.id, id));
  if (!row) return { error: "Type not found" };

  const rename = patch.name !== undefined && patch.name.trim() && patch.name.trim() !== row.name;
  const nextName = rename ? patch.name!.trim() : row.name;
  if (rename) {
    const clash = await db.select().from(s.nodeTypes).where(and(eq(s.nodeTypes.workspaceId, row.workspaceId), sql`lower(${s.nodeTypes.name}) = ${nextName.toLowerCase()}`));
    if (clash.some((c) => c.id !== id)) return { error: `“${nextName}” already exists` };
  }
  if (patch.parentId === id) return { error: "A type cannot be its own parent" };

  await db.update(s.nodeTypes).set({
    name: nextName,
    description: patch.description?.trim() ?? row.description,
    color: patch.color ?? row.color,
    parentId: patch.parentId === undefined ? row.parentId : patch.parentId,
    updatedAt: now(),
  }).where(eq(s.nodeTypes.id, id));

  // keep the instances in step, or the declaration stops describing its own data
  if (rename) {
    await db.update(s.entities).set({ kind: nextName, updatedAt: now() }).where(and(eq(s.entities.workspaceId, row.workspaceId), eq(s.entities.kind, row.name)));
    await db.update(s.relationRules).set({ fromType: nextName }).where(eq(s.relationRules.fromType, row.name));
    await db.update(s.relationRules).set({ toType: nextName }).where(eq(s.relationRules.toType, row.name));
  }
  await touched(row.workspaceId);
  return { ok: true };
}

/** Removes the declaration only. Entities keep their kind — the type simply becomes undeclared again. */
export async function deleteNodeType(id: string) {
  const db = await getDb();
  const [row] = await db.delete(s.nodeTypes).where(eq(s.nodeTypes.id, id)).returning();
  if (row) {
    await db.update(s.nodeTypes).set({ parentId: null }).where(eq(s.nodeTypes.parentId, id));
    await touched(row.workspaceId);
  }
  return { ok: true };
}

// ---- fields ------------------------------------------------------------------------------

export async function addField(nodeTypeId: string, key: string, dataType = "text", options: string[] = []) {
  const trimmed = key.trim();
  if (!trimmed) return { error: "A field key is required" };
  const db = await getDb();
  const [type] = await db.select().from(s.nodeTypes).where(eq(s.nodeTypes.id, nodeTypeId));
  if (!type) return { error: "Type not found" };
  const existing = await db.select().from(s.nodeTypeFields).where(eq(s.nodeTypeFields.nodeTypeId, nodeTypeId));
  if (existing.some((f) => f.key.toLowerCase() === trimmed.toLowerCase())) return { error: `“${trimmed}” is already a field` };
  await db.insert(s.nodeTypeFields).values({
    id: `fld_${nanoid(10)}`,
    nodeTypeId,
    key: trimmed,
    dataType,
    options: JSON.stringify(options),
    position: existing.length,
  });
  await touched(type.workspaceId);
  return { ok: true };
}

export async function updateField(id: string, patch: { key?: string; dataType?: string; required?: boolean; description?: string; options?: string[] }) {
  const db = await getDb();
  const [field] = await db.select().from(s.nodeTypeFields).where(eq(s.nodeTypeFields.id, id));
  if (!field) return { error: "Field not found" };
  const [type] = await db.select().from(s.nodeTypes).where(eq(s.nodeTypes.id, field.nodeTypeId));
  if (!type) return { error: "Type not found" };

  const rename = patch.key !== undefined && patch.key.trim() && patch.key.trim() !== field.key;
  const nextKey = rename ? patch.key!.trim() : field.key;
  await db.update(s.nodeTypeFields).set({
    key: nextKey,
    dataType: patch.dataType ?? field.dataType,
    required: patch.required ?? field.required,
    description: patch.description?.trim() ?? field.description,
    options: patch.options ? JSON.stringify(patch.options) : field.options,
  }).where(eq(s.nodeTypeFields.id, id));

  // renaming a field renames the attribute on every instance of the type
  if (rename) {
    const rows = await db.select().from(s.entities).where(and(eq(s.entities.workspaceId, type.workspaceId), eq(s.entities.kind, type.name)));
    for (const e of rows) {
      const attrs = JSON.parse(e.attributes || "{}") as Record<string, string>;
      if (!(field.key in attrs)) continue;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(attrs)) next[k === field.key ? nextKey : k] = v;
      await db.update(s.entities).set({ attributes: JSON.stringify(next), updatedAt: now() }).where(eq(s.entities.id, e.id));
    }
  }
  await touched(type.workspaceId);
  return { ok: true };
}

/** Removes the declaration; the attribute stays on instances and shows as undeclared again. */
export async function deleteField(id: string) {
  const db = await getDb();
  const [field] = await db.delete(s.nodeTypeFields).where(eq(s.nodeTypeFields.id, id)).returning();
  if (field) {
    const [type] = await db.select().from(s.nodeTypes).where(eq(s.nodeTypes.id, field.nodeTypeId));
    if (type) await touched(type.workspaceId);
  }
  return { ok: true };
}

// ---- relation types ----------------------------------------------------------------------

export async function createRelationType(workspaceId: string, name: string, description = "") {
  const trimmed = name.trim();
  if (!trimmed) return { error: "A name is required" };
  const db = await getDb();
  const clash = await db.select().from(s.relationTypes).where(and(eq(s.relationTypes.workspaceId, workspaceId), sql`lower(${s.relationTypes.name}) = ${trimmed.toLowerCase()}`));
  if (clash.length) return { error: `“${trimmed}” already exists` };
  const id = `rt_${nanoid(10)}`;
  await db.insert(s.relationTypes).values({ id, workspaceId, name: trimmed, description: description.trim() });
  await touched(workspaceId);
  return { id };
}

export async function updateRelationType(id: string, patch: { name?: string; description?: string }) {
  const db = await getDb();
  const [row] = await db.select().from(s.relationTypes).where(eq(s.relationTypes.id, id));
  if (!row) return { error: "Type not found" };
  const rename = patch.name !== undefined && patch.name.trim() && patch.name.trim() !== row.name;
  const nextName = rename ? patch.name!.trim() : row.name;
  if (rename) {
    const clash = await db.select().from(s.relationTypes).where(and(eq(s.relationTypes.workspaceId, row.workspaceId), sql`lower(${s.relationTypes.name}) = ${nextName.toLowerCase()}`));
    if (clash.some((c) => c.id !== id)) return { error: `“${nextName}” already exists` };
  }
  await db.update(s.relationTypes).set({ name: nextName, description: patch.description?.trim() ?? row.description, updatedAt: now() }).where(eq(s.relationTypes.id, id));
  if (rename) await db.update(s.relations_).set({ kind: nextName, updatedAt: now() }).where(and(eq(s.relations_.workspaceId, row.workspaceId), eq(s.relations_.kind, row.name)));
  await touched(row.workspaceId);
  return { ok: true };
}

export async function deleteRelationType(id: string) {
  const db = await getDb();
  const [row] = await db.delete(s.relationTypes).where(eq(s.relationTypes.id, id)).returning();
  if (row) await touched(row.workspaceId);
  return { ok: true };
}

// ---- rules -------------------------------------------------------------------------------

export async function addRule(relationTypeId: string, fromType: string, toType: string, cardinality = "many-to-many") {
  if (!fromType.trim() || !toType.trim()) return { error: "Both ends are required" };
  const db = await getDb();
  const [type] = await db.select().from(s.relationTypes).where(eq(s.relationTypes.id, relationTypeId));
  if (!type) return { error: "Relation type not found" };
  const existing = await db.select().from(s.relationRules).where(eq(s.relationRules.relationTypeId, relationTypeId));
  if (existing.some((r) => r.fromType.toLowerCase() === fromType.trim().toLowerCase() && r.toType.toLowerCase() === toType.trim().toLowerCase())) {
    return { error: "That rule already exists" };
  }
  await db.insert(s.relationRules).values({ id: `rr_${nanoid(10)}`, relationTypeId, fromType: fromType.trim(), toType: toType.trim(), cardinality });
  await touched(type.workspaceId);
  return { ok: true };
}

export async function deleteRule(id: string) {
  const db = await getDb();
  const [rule] = await db.delete(s.relationRules).where(eq(s.relationRules.id, id)).returning();
  if (rule) {
    const [type] = await db.select().from(s.relationTypes).where(eq(s.relationTypes.id, rule.relationTypeId));
    if (type) await touched(type.workspaceId);
  }
  return { ok: true };
}
