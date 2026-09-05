import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseDocument, serializeDocument } from "@/canvas/document";
import type { Proposal } from "./graph-types";
import { parseAttributes } from "./graph";
import { evidenceProposals } from "./proposals-evidence";

/**
 * Agent proposals — deterministic, explainable suggestions derived from the graph.
 *
 * This is the first rung of the agent layer described in docs/BRIEF.md §2.2: today the
 * rules are hand-written (duplicate names, inconsistent kinds, unlabelled relations …);
 * later an LLM-backed classifier plugs into the same Proposal shape and the same
 * accept / dismiss workflow. Every proposal has a stable `key` so decisions are remembered.
 */

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const singular = (v: string) => (v.endsWith("s") && v.length > 3 ? v.slice(0, -1) : v);
/** Attribute keys compare case-insensitively with `_`, `-` and spaces treated alike. */
const normKey = (k: string) => norm(k).replace(/[_-]+/g, " ");

/**
 * Attribute proposals:
 * 6. keys that differ only by case / separators ("Lifecycle" vs "lifecycle", "business_owner" vs "Business owner") → rename key;
 * 7. values of one key that differ only by case / whitespace ("Active" vs "active") → rename value;
 * 8. entities missing an attribute that (almost) every other entity of their kind carries → set it.
 */
export function attributeProposals(entities: s.Entity[], decided: Set<string>): Proposal[] {
  const out: Proposal[] = [];
  const attrsOf = new Map<string, Record<string, string>>();
  for (const e of entities) attrsOf.set(e.id, parseAttributes(e.attributes));

  // 6. key variants
  const keyCount = new Map<string, number>();
  for (const a of attrsOf.values()) for (const k of Object.keys(a)) keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
  const keyGroups = new Map<string, string[]>();
  for (const k of keyCount.keys()) keyGroups.set(normKey(k), [...(keyGroups.get(normKey(k)) ?? []), k]);
  for (const [, variants] of keyGroups) {
    if (variants.length < 2) continue;
    const target = [...variants].sort((a, b) => (keyCount.get(b) ?? 0) - (keyCount.get(a) ?? 0) || a.localeCompare(b))[0]!;
    for (const v of variants) {
      if (v === target) continue;
      const key = `attrkey:${v}=>${target}`;
      if (decided.has(key)) continue;
      out.push({
        key,
        type: "attributeKey",
        confidence: "high",
        title: `Attribute “${v}” looks like “${target}”`,
        detail: `${keyCount.get(v)} entit${keyCount.get(v) === 1 ? "y" : "ies"} use “${v}”, ${keyCount.get(target)} use “${target}”. Rename the key so the attribute schema has one column.`,
        entityIds: entities.filter((e) => v in (attrsOf.get(e.id) ?? {})).map((e) => e.id),
        action: { kind: "renameAttributeKey", from: v, to: target },
      });
    }
  }

  // 7. value variants per key
  const valueCount = new Map<string, Map<string, number>>();
  for (const a of attrsOf.values()) for (const [k, v] of Object.entries(a)) {
    if (!v.trim()) continue;
    const m = valueCount.get(k) ?? new Map<string, number>();
    m.set(v, (m.get(v) ?? 0) + 1);
    valueCount.set(k, m);
  }
  for (const [k, values] of valueCount) {
    const groups = new Map<string, string[]>();
    for (const v of values.keys()) groups.set(norm(v), [...(groups.get(norm(v)) ?? []), v]);
    for (const [, variants] of groups) {
      if (variants.length < 2) continue;
      const target = [...variants].sort((a, b) => (values.get(b) ?? 0) - (values.get(a) ?? 0) || a.localeCompare(b))[0]!;
      for (const v of variants) {
        if (v === target) continue;
        const key = `attrvalue:${k}:${v}=>${target}`;
        if (decided.has(key)) continue;
        out.push({
          key,
          type: "attributeValue",
          confidence: "high",
          title: `${k}: “${v}” looks like “${target}”`,
          detail: `${values.get(v)} entit${values.get(v) === 1 ? "y says" : "ies say"} “${v}”, ${values.get(target)} ${values.get(target) === 1 ? "says" : "say"} “${target}”. One spelling keeps lenses and queries honest.`,
          entityIds: entities.filter((e) => attrsOf.get(e.id)?.[k] === v).map((e) => e.id),
          action: { kind: "renameAttributeValue", key: k, from: v, to: target },
        });
      }
    }
  }

  // 8. missing attributes: a key carried by ≥ 80 % of a kind (≥ 3 entities) is expected on the rest
  const byKind = new Map<string, s.Entity[]>();
  for (const e of entities) if (e.kind.trim()) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
  for (const [kind, list] of byKind) {
    if (list.length < 3) continue;
    const keys = new Map<string, number>();
    for (const e of list) for (const k of Object.keys(attrsOf.get(e.id) ?? {})) keys.set(k, (keys.get(k) ?? 0) + 1);
    for (const [k, n] of keys) {
      if (n / list.length < 0.8 || n === list.length) continue;
      // dominant value (if one value covers ≥ 80 % of carriers) becomes the suggestion
      const vals = new Map<string, number>();
      for (const e of list) { const v = attrsOf.get(e.id)?.[k]; if (v) vals.set(v, (vals.get(v) ?? 0) + 1); }
      const top = [...vals.entries()].sort((a, b) => b[1] - a[1])[0];
      const suggestion = top && top[1] / n >= 0.8 ? top[0] : "";
      for (const e of list) {
        if (k in (attrsOf.get(e.id) ?? {})) continue;
        const key = `attrmissing:${e.id}:${k}`;
        if (decided.has(key)) continue;
        out.push({
          key,
          type: "attributeMissing",
          confidence: suggestion ? "medium" : "low",
          title: `“${e.name}” has no “${k}”`,
          detail: `${n} of ${list.length} ${kind} entities carry “${k}”${suggestion ? `, almost all “${suggestion}”` : ` (${[...vals.keys()].slice(0, 4).join(", ")}${vals.size > 4 ? ", …" : ""})`}. Fill it in so the ${kind} schema is complete.`,
          entityIds: [e.id],
          action: { kind: "setAttribute", entityId: e.id, key: k, to: suggestion },
        });
      }
    }
  }
  return out;
}

/** Move attribute `from` to `to` on every entity of the workspace (existing `to` values win). */
export async function renameAttributeKey(db: Db, workspaceId: string, from: string, to: string) {
  const rows = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const ts = new Date().toISOString();
  for (const e of rows) {
    const a = parseAttributes(e.attributes);
    if (!(from in a)) continue;
    const { [from]: moved, ...rest } = a;
    const next = to in rest ? rest : { ...rest, [to]: moved };
    await db.update(s.entities).set({ attributes: JSON.stringify(next), updatedAt: ts }).where(eq(s.entities.id, e.id));
  }
}

/** Replace value `from` of attribute `key` with `to` on every entity that carries it. */
export async function renameAttributeValue(db: Db, workspaceId: string, key: string, from: string, to: string) {
  const rows = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const ts = new Date().toISOString();
  for (const e of rows) {
    const a = parseAttributes(e.attributes);
    if (a[key] !== from) continue;
    await db.update(s.entities).set({ attributes: JSON.stringify({ ...a, [key]: to }), updatedAt: ts }).where(eq(s.entities.id, e.id));
  }
}

/** Set one attribute on one entity. */
export async function setEntityAttribute(db: Db, entityId: string, key: string, value: string) {
  const [e] = await db.select().from(s.entities).where(eq(s.entities.id, entityId));
  if (!e) return;
  await db.update(s.entities).set({ attributes: JSON.stringify({ ...parseAttributes(e.attributes), [key]: value }), updatedAt: new Date().toISOString() }).where(eq(s.entities.id, entityId));
}

export async function computeProposals(db: Db, workspaceId: string): Promise<Proposal[]> {
  const [entities, relations, decisions, usage] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
    db.select().from(s.agentDecisions).where(eq(s.agentDecisions.workspaceId, workspaceId)),
    db
      .select({ entityId: s.boardEntities.entityId, boardId: s.boardEntities.boardId, boardName: s.boards.name })
      .from(s.boardEntities)
      .innerJoin(s.boards, eq(s.boardEntities.boardId, s.boards.id))
      .where(eq(s.boards.workspaceId, workspaceId)),
  ]);
  const decided = new Set(decisions.map((d) => d.key));
  const boardsOf = new Map<string, Array<{ id: string; name: string }>>();
  for (const u of usage) {
    const list = boardsOf.get(u.entityId) ?? [];
    if (!list.some((b) => b.id === u.boardId)) list.push({ id: u.boardId, name: u.boardName });
    boardsOf.set(u.entityId, list);
  }
  const relCount = new Map<string, number>();
  for (const r of relations) {
    relCount.set(r.fromEntityId, (relCount.get(r.fromEntityId) ?? 0) + 1);
    relCount.set(r.toEntityId, (relCount.get(r.toEntityId) ?? 0) + 1);
  }
  const out: Proposal[] = [];

  // 1. duplicate names → merge
  const byName = new Map<string, s.Entity[]>();
  for (const e of entities) {
    if (!e.name.trim()) continue;
    byName.set(norm(e.name), [...(byName.get(norm(e.name)) ?? []), e]);
  }
  for (const [, list] of byName) {
    if (list.length < 2) continue;
    const sameKind = new Set(list.map((e) => norm(e.kind))).size === 1;
    // survivor: most relations, then most boards, then oldest
    const sorted = [...list].sort((a, b) => (relCount.get(b.id) ?? 0) - (relCount.get(a.id) ?? 0) || (boardsOf.get(b.id)?.length ?? 0) - (boardsOf.get(a.id)?.length ?? 0) || a.createdAt.localeCompare(b.createdAt));
    const survivor = sorted[0]!;
    const others = sorted.slice(1);
    const key = `merge:${[...list.map((e) => e.id)].sort().join(",")}`;
    if (decided.has(key)) continue;
    const boardNames = [...new Set(list.flatMap((e) => (boardsOf.get(e.id) ?? []).map((b) => b.name)))];
    out.push({
      key,
      type: "merge",
      confidence: sameKind ? "high" : "medium",
      title: `“${survivor.name}” exists ${list.length} times`,
      detail: sameKind
        ? `${list.length} ${survivor.kind || "untyped"} entities share this name${boardNames.length ? ` across ${boardNames.join(", ")}` : ""}. Merge them into one so relations and boards point at the same thing.`
        : `Same name, different kinds (${[...new Set(list.map((e) => e.kind || "untyped"))].join(" / ")}). Probably one system described twice — merging keeps “${survivor.kind || survivor.name}”.`,
      entityIds: list.map((e) => e.id),
      action: { kind: "merge", survivorId: survivor.id, otherIds: others.map((e) => e.id) },
      evidence: list.map((e) => `${e.kind || "untyped"} · ${e.name}${boardsOf.get(e.id)?.length ? ` · on ${boardsOf.get(e.id)!.map((b) => b.name).join(", ")}` : " · not on a board"} · ${relCount.get(e.id) ?? 0} relations`),
    });
  }

  // 2. kind vocabulary: kinds that differ only by case / whitespace / plural
  const kinds = new Map<string, number>();
  for (const e of entities) if (e.kind.trim()) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
  const canon = new Map<string, string[]>();
  for (const k of kinds.keys()) canon.set(singular(norm(k)), [...(canon.get(singular(norm(k))) ?? []), k]);
  for (const [, variants] of canon) {
    if (variants.length < 2) continue;
    const target = [...variants].sort((a, b) => (kinds.get(b) ?? 0) - (kinds.get(a) ?? 0))[0]!;
    for (const v of variants) {
      if (v === target) continue;
      const key = `kind:${v}=>${target}`;
      if (decided.has(key)) continue;
      out.push({
        key,
        type: "kind",
        confidence: "high",
        title: `Kind “${v}” looks like “${target}”`,
        detail: `${kinds.get(v)} entit${kinds.get(v) === 1 ? "y" : "ies"} use “${v}”, ${kinds.get(target)} use “${target}”. Rename to keep one vocabulary.`,
        entityIds: entities.filter((e) => e.kind === v).map((e) => e.id),
        action: { kind: "renameKind", from: v, to: target },
      });
    }
  }

  // 3. untyped entities
  for (const e of entities) {
    if (e.kind.trim() || !e.name.trim()) continue;
    const key = `untyped:${e.id}`;
    if (decided.has(key)) continue;
    const guess = guessKind(e.name, entities);
    out.push({
      key,
      type: "untyped",
      confidence: guess ? "medium" : "low",
      title: `“${e.name}” has no kind`,
      detail: guess ? `Similar names are typed “${guess}”. Set the kind so it joins the meta-model.` : "Give it a kind so it joins the meta-model.",
      entityIds: [e.id],
      action: { kind: "setKind", entityId: e.id, to: guess ?? "" },
    });
  }

  // 4. unlabelled relations
  const nameOf = new Map(entities.map((e) => [e.id, e.name]));
  for (const r of relations) {
    if (r.kind.trim()) continue;
    const key = `relation:${r.id}`;
    if (decided.has(key)) continue;
    const suggestion = suggestRelationKind(r, relations, entities);
    out.push({
      key,
      type: "relation",
      confidence: suggestion ? "medium" : "low",
      title: `Unlabelled relation ${nameOf.get(r.fromEntityId) ?? "?"} → ${nameOf.get(r.toEntityId) ?? "?"}`,
      detail: suggestion ? `Other relations between these kinds are labelled “${suggestion}”.` : "Label it so the relation type becomes part of the meta-model.",
      entityIds: [r.fromEntityId, r.toEntityId],
      action: { kind: "setRelationKind", relationId: r.id, to: suggestion ?? "" },
    });
  }

  // 5. orphans: no relations, on no board
  for (const e of entities) {
    if ((relCount.get(e.id) ?? 0) > 0 || (boardsOf.get(e.id)?.length ?? 0) > 0) continue;
    const key = `orphan:${e.id}`;
    if (decided.has(key)) continue;
    out.push({
      key,
      type: "orphan",
      confidence: "low",
      title: `“${e.name || "(unnamed)"}” is not used anywhere`,
      detail: `No relations and not on any board (source: ${e.source}). Delete it, or place it from a board's Graph inventory.`,
      entityIds: [e.id],
      action: { kind: "deleteEntity", entityId: e.id },
    });
  }

  // 6–8. attributes: the emergent attribute schema (BRIEF §5.8) needs the same hygiene as kinds
  out.push(...attributeProposals(entities, decided));

  // Rules that read the graph's own evidence rather than its shape: who acted on what, and what
  // people said about it. See proposals-evidence.ts.
  const parsed = new Map(entities.map((e) => [e.id, parseAttributes(e.attributes)]));
  out.push(...evidenceProposals({ entities, relations, decided, attributesOf: (id) => parsed.get(id) ?? {} }));

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.title.localeCompare(b.title));
}

function guessKind(name: string, entities: s.Entity[]): string | null {
  const tokens = norm(name).split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const scores = new Map<string, number>();
  for (const e of entities) {
    if (!e.kind.trim()) continue;
    const other = norm(e.name);
    const hits = tokens.filter((t) => other.includes(t)).length;
    if (hits) scores.set(e.kind, (scores.get(e.kind) ?? 0) + hits);
  }
  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

function suggestRelationKind(r: s.Relation, relations: s.Relation[], entities: s.Entity[]): string | null {
  const kindOf = new Map(entities.map((e) => [e.id, e.kind]));
  const fromKind = kindOf.get(r.fromEntityId);
  const toKind = kindOf.get(r.toEntityId);
  const counts = new Map<string, number>();
  for (const o of relations) {
    if (!o.kind.trim() || o.id === r.id) continue;
    if (kindOf.get(o.fromEntityId) === fromKind && kindOf.get(o.toEntityId) === toKind) counts.set(o.kind, (counts.get(o.kind) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

/** Same-name entities for one entity (used by the board inspector). */
export async function duplicatesOf(db: Db, entityId: string) {
  const e = await db.query.entities.findFirst({ where: eq(s.entities.id, entityId) });
  if (!e || !e.name.trim()) return [];
  const rows = await db
    .select()
    .from(s.entities)
    .where(and(eq(s.entities.workspaceId, e.workspaceId), sql`lower(trim(${s.entities.name})) = ${norm(e.name)}`));
  return rows.filter((r) => r.id !== entityId);
}

/**
 * Merge `otherIds` into `survivorId`: relations are repointed (and de-duplicated), cards on
 * every board are relinked in their documents, board index rebuilt, others deleted.
 */
export async function mergeEntities(db: Db, workspaceId: string, survivorId: string, otherIds: string[]) {
  const others = otherIds.filter((id) => id !== survivorId);
  if (others.length === 0) return { boardsUpdated: 0, relationsMoved: 0 };
  const survivor = await db.query.entities.findFirst({ where: eq(s.entities.id, survivorId) });
  if (!survivor || survivor.workspaceId !== workspaceId) throw new Error("Survivor entity not found");
  const ts = new Date().toISOString();

  // inherit a description if the survivor has none
  if (!survivor.description.trim()) {
    const donor = await db.select().from(s.entities).where(inArray(s.entities.id, others));
    const withDesc = donor.find((d) => d.description.trim());
    if (withDesc) await db.update(s.entities).set({ description: withDesc.description, updatedAt: ts }).where(eq(s.entities.id, survivorId));
  }

  // relations
  const rels = await db.select().from(s.relations_).where(sql`${s.relations_.fromEntityId} in ${others} or ${s.relations_.toEntityId} in ${others}`);
  const existing = await db.select().from(s.relations_).where(sql`${s.relations_.fromEntityId} = ${survivorId} or ${s.relations_.toEntityId} = ${survivorId}`);
  const seen = new Set(existing.map((r) => `${r.fromEntityId}|${norm(r.kind)}|${r.toEntityId}`));
  let relationsMoved = 0;
  for (const r of rels) {
    const from = others.includes(r.fromEntityId) ? survivorId : r.fromEntityId;
    const to = others.includes(r.toEntityId) ? survivorId : r.toEntityId;
    const key = `${from}|${norm(r.kind)}|${to}`;
    if (from === to || seen.has(key)) {
      await db.delete(s.relations_).where(eq(s.relations_.id, r.id));
      continue;
    }
    seen.add(key);
    await db.update(s.relations_).set({ fromEntityId: from, toEntityId: to, updatedAt: ts }).where(eq(s.relations_.id, r.id));
    relationsMoved++;
  }

  // boards: relink cards in documents
  const usage = await db.select({ boardId: s.boardEntities.boardId }).from(s.boardEntities).where(inArray(s.boardEntities.entityId, others));
  const boardIds = [...new Set(usage.map((u) => u.boardId))];
  let boardsUpdated = 0;
  for (const boardId of boardIds) {
    const board = await db.query.boards.findFirst({ where: eq(s.boards.id, boardId) });
    if (!board) continue;
    const doc = parseDocument(board.document);
    let changed = false;
    for (const el of Object.values(doc.elements)) {
      if (el.type === "card" && typeof el.meta?.entityId === "string" && others.includes(el.meta.entityId)) {
        el.meta = { ...el.meta, entityId: survivorId };
        el.kind = survivor.kind;
        el.title = survivor.name;
        changed = true;
      }
    }
    if (changed) {
      await db.update(s.boards).set({ document: serializeDocument(doc), updatedAt: ts, revision: sql`${s.boards.revision} + 1` }).where(eq(s.boards.id, boardId));
      boardsUpdated++;
    }
    // the index is rebuilt on the next save anyway; keep it consistent now
    await db.delete(s.boardEntities).where(and(eq(s.boardEntities.boardId, boardId), inArray(s.boardEntities.entityId, others)));
    await db.insert(s.boardEntities).values(Object.values(doc.elements).filter((el) => el.type === "card" && el.meta?.entityId === survivorId).map((el) => ({ boardId, entityId: survivorId, elementId: el.id }))).onConflictDoNothing().catch(() => undefined);
  }
  await db.delete(s.entities).where(inArray(s.entities.id, others));
  return { boardsUpdated, relationsMoved };
}

export async function recordDecision(db: Db, workspaceId: string, key: string, decision: "accepted" | "dismissed") {
  await db.insert(s.agentDecisions).values({ workspaceId, key, decision }).onConflictDoUpdate({ target: [s.agentDecisions.workspaceId, s.agentDecisions.key], set: { decision, createdAt: new Date().toISOString() } });
}
