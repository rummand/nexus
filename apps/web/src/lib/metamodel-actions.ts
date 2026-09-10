"use server";

import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { deny } from "@/lib/auth/guard";
import { remembering } from "./history/record";
import { currentActor } from "./history/current";
import { metaModel } from "./metamodel";
import { framework, planApply, type ApplyPlan, type Framework } from "./frameworks";


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

/** Which workspace a declaration belongs to, for the guard (§5.46). */
async function denyNodeType(id: string) {
  const db = await getDb();
  const row = await db.query.nodeTypes.findFirst({ where: eq(s.nodeTypes.id, id) });
  if (!row) return { error: "That type is gone." };
  return deny(row.workspaceId, "graph.edit");
}

async function denyRelationType(id: string) {
  const db = await getDb();
  const row = await db.query.relationTypes.findFirst({ where: eq(s.relationTypes.id, id) });
  if (!row) return { error: "That relation type is gone." };
  return deny(row.workspaceId, "graph.edit");
}

/** A field and a rule reach their workspace through the type they belong to. */
async function denyFieldRow(id: string) {
  const db = await getDb();
  const row = await db.query.nodeTypeFields.findFirst({ where: eq(s.nodeTypeFields.id, id) });
  if (!row) return { error: "That field is gone." };
  return denyNodeType(row.nodeTypeId);
}

async function denyRuleRow(id: string) {
  const db = await getDb();
  const row = await db.query.relationRules.findFirst({ where: eq(s.relationRules.id, id) });
  if (!row) return { error: "That rule is gone." };
  return denyRelationType(row.relationTypeId);
}

export async function createNodeType(workspaceId: string, name: string, description = "", color = "") {
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
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
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
  return createNodeType(workspaceId, name);
}

export async function updateNodeType(id: string, patch: { name?: string; description?: string; color?: string; parentId?: string | null }) {
  const no = await denyNodeType(id);
  if (no) return no;
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
    await remembering(db, { workspaceId: row.workspaceId, actor: await currentActor(), context: `renamed the type “${row.name}”` }, { workspace: true }, async () => {
      await db.update(s.entities).set({ kind: nextName, updatedAt: now() }).where(and(eq(s.entities.workspaceId, row.workspaceId), eq(s.entities.kind, row.name)));
    });
    await db.update(s.relationRules).set({ fromType: nextName }).where(eq(s.relationRules.fromType, row.name));
    await db.update(s.relationRules).set({ toType: nextName }).where(eq(s.relationRules.toType, row.name));
  }
  await touched(row.workspaceId);
  return { ok: true };
}

/** Removes the declaration only. Entities keep their kind — the type simply becomes undeclared again. */
export async function deleteNodeType(id: string) {
  const no = await denyNodeType(id);
  if (no) return no;
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
  const no = await denyNodeType(nodeTypeId);
  if (no) return no;
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
  const no = await denyFieldRow(id);
  if (no) return no;
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
    await remembering(db, { workspaceId: type.workspaceId, actor: await currentActor(), context: `renamed the field “${field.key}”` }, { ids: rows.map((r) => r.id) }, async () => {
      for (const e of rows) {
        const attrs = JSON.parse(e.attributes || "{}") as Record<string, string>;
        if (!(field.key in attrs)) continue;
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(attrs)) next[k === field.key ? nextKey : k] = v;
        await db.update(s.entities).set({ attributes: JSON.stringify(next), updatedAt: now() }).where(eq(s.entities.id, e.id));
      }
    });
  }
  await touched(type.workspaceId);
  return { ok: true };
}

/** Removes the declaration; the attribute stays on instances and shows as undeclared again. */
export async function deleteField(id: string) {
  const no = await denyFieldRow(id);
  if (no) return no;
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
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
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
  const no = await denyRelationType(id);
  if (no) return no;
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
  const no = await denyRelationType(id);
  if (no) return no;
  const db = await getDb();
  const [row] = await db.delete(s.relationTypes).where(eq(s.relationTypes.id, id)).returning();
  if (row) await touched(row.workspaceId);
  return { ok: true };
}

// ---- rules -------------------------------------------------------------------------------

export async function addRule(relationTypeId: string, fromType: string, toType: string, cardinality = "many-to-many") {
  const no = await denyRelationType(relationTypeId);
  if (no) return no;
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
  const no = await denyRuleRow(id);
  if (no) return no;
  const db = await getDb();
  const [rule] = await db.delete(s.relationRules).where(eq(s.relationRules.id, id)).returning();
  if (rule) {
    const [type] = await db.select().from(s.relationTypes).where(eq(s.relationTypes.id, rule.relationTypeId));
    if (type) await touched(type.workspaceId);
  }
  return { ok: true };
}

/** The workspace layer a framework's type belongs in, or null when the framework is unlayered. */
function layerIdFor(fw: Framework, layerIds: Map<string, string>, layer: string | undefined): string | null {
  if (!layer) return null;
  const named = fw.layers.find((l) => l.key === layer);
  return named ? layerIds.get(named.name.trim().toLowerCase()) ?? null : null;
}

/**
 * Adopt a modelling framework (§5.57).
 *
 * Purely additive, by construction rather than by care: everything already declared is left exactly
 * as it is, including its description and its fields, because a workspace's own words beat a
 * template's. That is what makes this safe to offer to a workspace that has been running for a year
 * rather than only to an empty one — and it means adopting the same framework twice is a no-op.
 *
 * The plan is worked out twice: once for the screen so somebody can read what will happen, and once
 * here against the model as it stands at the moment of the write, because the two can be minutes
 * apart and the second one is the one that must be true.
 *
 * Types that already exist keep whatever provenance they had. A framework does not get to claim
 * something this organisation had already invented for itself just because the names collide.
 */
export async function adoptFramework(workspaceId: string, frameworkId: string): Promise<{ applied: ApplyPlan } | { error: string }> {
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
  const fw = framework(frameworkId);
  if (!fw) return { error: "That framework is not one of the ones on offer." };

  const db = await getDb();
  const before = await metaModel(db, workspaceId);
  const plan = planApply(fw, before);

  const nodeTypeIds = new Map<string, string>();
  for (const t of before.nodeTypes) if (t.id) nodeTypeIds.set(t.name.trim().toLowerCase(), t.id);
  const relTypeIds = new Map<string, string>();
  for (const t of before.relationTypes) if (t.id) relTypeIds.set(t.name.trim().toLowerCase(), t.id);

  /*
   * The framework's layers, first, because its types are placed in them (§5.58).
   *
   * A layer whose name the workspace already has is reused rather than duplicated: two frameworks
   * that both call a band "Business" mean the same band, and the alternative is a stack with the
   * same word in it twice. Position is appended, so an existing stack keeps its order and the new
   * bands land underneath rather than shuffling what somebody already arranged.
   */
  const layerIds = new Map<string, string>();
  for (const l of before.layers) layerIds.set(l.name.trim().toLowerCase(), l.id);
  let nextPosition = before.layers.reduce((n, l) => Math.max(n, l.position + 1), 0);
  for (const l of fw.layers) {
    const at = l.name.trim().toLowerCase();
    if (layerIds.has(at)) continue;
    const id = `lyr_${nanoid(10)}`;
    await db.insert(s.layers).values({
      id, workspaceId, name: l.name, description: l.blurb, source: fw.id, position: nextPosition++,
    });
    layerIds.set(at, id);
  }

  for (const t of fw.nodeTypes) {
    const at = t.name.trim().toLowerCase();
    if (!nodeTypeIds.has(at)) {
      const id = `nt_${nanoid(10)}`;
      await db.insert(s.nodeTypes).values({
        id, workspaceId, name: t.name, description: t.description, color: t.color,
        framework: fw.id, layerId: layerIdFor(fw, layerIds, t.layer),
      });
      nodeTypeIds.set(at, id);
    }
  }

  /*
   * A type that already existed keeps its own name, description and fields — but if nobody has put
   * it in a layer, the framework's opinion is better than none. Placing an unplaced type is as
   * additive as adding a missing field; moving a placed one would not be.
   */
  for (const t of fw.nodeTypes) {
    const layerId = layerIdFor(fw, layerIds, t.layer);
    if (!layerId) continue;
    const id = nodeTypeIds.get(t.name.trim().toLowerCase());
    if (!id) continue;
    const [row] = await db.select().from(s.nodeTypes).where(eq(s.nodeTypes.id, id));
    if (row && !row.layerId) await db.update(s.nodeTypes).set({ layerId, updatedAt: now() }).where(eq(s.nodeTypes.id, id));
  }

  /* Parents second: a type's parent may be a type this same framework has only just created. */
  for (const t of fw.nodeTypes) {
    if (!t.parent) continue;
    const id = nodeTypeIds.get(t.name.trim().toLowerCase());
    const parentId = nodeTypeIds.get(t.parent.trim().toLowerCase());
    if (!id || !parentId) continue;
    const [row] = await db.select().from(s.nodeTypes).where(eq(s.nodeTypes.id, id));
    if (row && !row.parentId) await db.update(s.nodeTypes).set({ parentId, updatedAt: now() }).where(eq(s.nodeTypes.id, id));
  }

  for (const t of fw.nodeTypes) {
    const typeId = nodeTypeIds.get(t.name.trim().toLowerCase());
    if (!typeId) continue;
    const have = await db.select().from(s.nodeTypeFields).where(eq(s.nodeTypeFields.nodeTypeId, typeId));
    const haveKeys = new Set(have.map((f) => f.key.trim().toLowerCase()));
    let position = have.length;
    for (const f of t.fields) {
      if (haveKeys.has(f.key.trim().toLowerCase())) continue;
      await db.insert(s.nodeTypeFields).values({
        id: `ntf_${nanoid(10)}`, nodeTypeId: typeId, key: f.key, dataType: f.dataType,
        description: f.description, required: Boolean(f.required), options: JSON.stringify(f.options ?? []),
        position: position++,
      });
    }
  }

  for (const t of fw.relationTypes) {
    const at = t.name.trim().toLowerCase();
    let typeId = relTypeIds.get(at);
    if (!typeId) {
      typeId = `rt_${nanoid(10)}`;
      await db.insert(s.relationTypes).values({ id: typeId, workspaceId, name: t.name, description: t.description, framework: fw.id });
      relTypeIds.set(at, typeId);
    }
    const have = await db.select().from(s.relationRules).where(eq(s.relationRules.relationTypeId, typeId));
    const haveRules = new Set(have.map((r) => `${r.fromType.trim().toLowerCase()}>${r.toType.trim().toLowerCase()}`));
    for (const rule of t.rules) {
      if (haveRules.has(`${rule.from.trim().toLowerCase()}>${rule.to.trim().toLowerCase()}`)) continue;
      await db.insert(s.relationRules).values({
        id: `rr_${nanoid(10)}`, relationTypeId: typeId, fromType: rule.from, toType: rule.to, cardinality: rule.cardinality,
      });
    }
  }

  /*
   * The adoption is recorded even when the plan was a no-op: "we model with C4" is a statement
   * about this organisation, and it can be true of a workspace that happened to have declared
   * every one of those types by hand first.
   */
  const already = await db.select().from(s.frameworkAdoptions)
    .where(and(eq(s.frameworkAdoptions.workspaceId, workspaceId), eq(s.frameworkAdoptions.frameworkId, fw.id)));
  if (already.length === 0) {
    const actor = await currentActor();
    await db.insert(s.frameworkAdoptions).values({
      id: `fwa_${nanoid(10)}`, workspaceId, frameworkId: fw.id,
      adoptedBy: actor.id, adoptedByName: actor.name,
    });
  }

  await touched(workspaceId);
  return { applied: plan };
}

/**
 * Stop saying this workspace models with a framework.
 *
 * Deletes the adoption and nothing else. By the time somebody changes their mind the types it
 * brought may hold hundreds of objects, and a modelling decision reversed must not take the estate
 * with it — so the types stay, still marked with where they came from, and can be deleted one at a
 * time by somebody who has looked at what is in them.
 */
export async function abandonFramework(workspaceId: string, frameworkId: string) {
  const no = await deny(workspaceId, "graph.edit");
  if (no) return no;
  const db = await getDb();
  await db.delete(s.frameworkAdoptions)
    .where(and(eq(s.frameworkAdoptions.workspaceId, workspaceId), eq(s.frameworkAdoptions.frameworkId, frameworkId)));
  await touched(workspaceId);
  return { ok: true };
}
