import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "./graph";
import type { ParsedQuery, QueryResponse, QueryResultEntity } from "./graph-types";

/**
 * Graph query language — small, forgiving, deterministic. Examples:
 *   kind:Application criticality:high
 *   owner:"Grid Operations" lifecycle:"end of life"
 *   related:Maximo            (1 hop, any direction)      from:"Data Lake" rel:"meter data"
 *   to:SAP                    (entities with a relation pointing at SAP)
 *   has:owner missing:lifecycle   (attribute present / absent — schema hygiene)
 *   on:"Application landscape"    (appears on a board whose name contains this)
 *   billing                   (free text over name / description / attribute values)
 * Natural-language questions will later be translated into this structure by the agent
 * layer, so the runner stays the single source of truth for what a question means.
 */

const norm = (v: string) => v.trim().toLowerCase();

function tokenize(q: string): string[] {
  const out: string[] = [];
  const re = /(\S+?:"[^"]*"|"[^"]*"|\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push(m[0]);
  return out;
}

const unquote = (v: string) => v.replace(/^"|"$/g, "");

export function parseQuery(raw: string): ParsedQuery {
  const q: ParsedQuery = { text: [], kinds: [], attributes: [], related: [], relationKinds: [], has: [], missing: [], boards: [], structured: false };
  const input = raw.trim().replace(/^\?\s*/, "");
  for (const tok of tokenize(input)) {
    const idx = tok.indexOf(":");
    if (idx > 0) {
      const key = norm(tok.slice(0, idx));
      const value = unquote(tok.slice(idx + 1)).trim();
      if (!value) continue;
      q.structured = true;
      if (key === "kind" || key === "is" || key === "type") q.kinds.push(value);
      else if (key === "related" || key === "near" || key === "with") q.related.push({ name: value, direction: "both" });
      else if (key === "from" || key === "out") q.related.push({ name: value, direction: "out" });
      else if (key === "to" || key === "in") q.related.push({ name: value, direction: "in" });
      else if (key === "rel" || key === "relation" || key === "via") q.relationKinds.push(value);
      else if (key === "has") q.has.push(norm(value));
      else if (key === "missing" || key === "without" || key === "no") q.missing.push(norm(value));
      else if (key === "on" || key === "board") q.boards.push(value);
      else q.attributes.push({ key, value });
    } else {
      const t = unquote(tok).trim();
      if (t) q.text.push(t);
    }
  }
  return q;
}

export function describeQuery(q: ParsedQuery): string {
  const parts: string[] = [];
  if (q.kinds.length) parts.push(`kind ${q.kinds.map((k) => `“${k}”`).join(" or ")}`);
  for (const a of q.attributes) parts.push(`${a.key} contains “${a.value}”`);
  for (const r of q.related) parts.push(r.direction === "both" ? `related to “${r.name}”` : r.direction === "out" ? `reached from “${r.name}”` : `pointing at “${r.name}”`);
  if (q.relationKinds.length) parts.push(`via ${q.relationKinds.map((k) => `“${k}”`).join(" / ")}`);
  for (const k of q.has) parts.push(`has “${k}”`);
  for (const k of q.missing) parts.push(`no “${k}”`);
  for (const b of q.boards) parts.push(`on board “${b}”`);
  if (q.text.length) parts.push(`text “${q.text.join(" ")}”`);
  return parts.length ? `Entities where ${parts.join(", ")}` : "All entities";
}

export async function runQuery(db: Db, workspaceId: string, raw: string, limit = 50): Promise<QueryResponse> {
  const q = parseQuery(raw);
  const entities = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const relations = q.related.length ? await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)) : [];
  const relKinds = q.relationKinds.map(norm);
  // on:<board> clauses resolve to the ids placed on matching boards
  let boardIds: Set<string> | null = null;
  const boardWhy = new Map<string, string>();
  if (q.boards.length) {
    const placed = await db.select({ entityId: s.boardEntities.entityId, name: s.boards.name }).from(s.boardEntities).innerJoin(s.boards, eq(s.boardEntities.boardId, s.boards.id)).where(eq(s.boards.workspaceId, workspaceId));
    boardIds = new Set();
    for (const p of placed) if (q.boards.some((b) => norm(p.name).includes(norm(b)))) { boardIds.add(p.entityId); boardWhy.set(p.entityId, `on ${p.name}`); }
  }

  // related-to clauses resolve to a set of allowed ids
  let relatedIds: Set<string> | null = null;
  const relatedWhy = new Map<string, string>();
  for (const clause of q.related) {
    const anchors = entities.filter((e) => norm(e.name) === norm(clause.name) || norm(e.name).includes(norm(clause.name)));
    const ids = new Set<string>();
    for (const anchor of anchors) {
      for (const r of relations) {
        if (relKinds.length && !relKinds.some((k) => norm(r.kind).includes(k))) continue;
        if ((clause.direction === "both" || clause.direction === "out") && r.fromEntityId === anchor.id) { ids.add(r.toEntityId); relatedWhy.set(r.toEntityId, `${anchor.name} → ${r.kind || "related"}`); }
        if ((clause.direction === "both" || clause.direction === "in") && r.toEntityId === anchor.id) { ids.add(r.fromEntityId); relatedWhy.set(r.fromEntityId, `${r.kind || "related"} → ${anchor.name}`); }
      }
    }
    if (relatedIds) {
      const prev: Set<string> = relatedIds;
      relatedIds = new Set(Array.from(prev).filter((id) => ids.has(id)));
    } else relatedIds = ids;
  }

  const matched: Array<{ e: s.Entity; why: string[] }> = [];
  for (const e of entities) {
    const why: string[] = [];
    if (relatedIds && !relatedIds.has(e.id)) continue;
    if (relatedIds) why.push(relatedWhy.get(e.id) ?? "related");
    if (boardIds && !boardIds.has(e.id)) continue;
    if (boardIds) why.push(boardWhy.get(e.id) ?? "on board");
    if (q.kinds.length) {
      const hit = q.kinds.find((k) => norm(e.kind) === norm(k) || norm(e.kind).startsWith(norm(k)));
      if (!hit) continue;
      why.push(e.kind);
    }
    const attrs = parseAttributes(e.attributes);
    let ok = true;
    for (const a of q.attributes) {
      const key = Object.keys(attrs).find((k) => norm(k) === a.key || norm(k).startsWith(a.key));
      if (!key || !norm(attrs[key] ?? "").includes(norm(a.value))) { ok = false; break; }
      why.push(`${key} · ${attrs[key]}`);
    }
    if (!ok) continue;
    const keyOf = (k: string) => Object.keys(attrs).find((x) => norm(x) === k || norm(x).startsWith(k));
    for (const k of q.has) { const hit = keyOf(k); if (!hit || !attrs[hit]) { ok = false; break; } why.push(`has ${hit}`); }
    if (!ok) continue;
    for (const k of q.missing) { const hit = keyOf(k); if (hit && attrs[hit]) { ok = false; break; } why.push(`no ${k}`); }
    if (!ok) continue;
    if (q.text.length) {
      const hay = norm(`${e.kind} ${e.name} ${e.description} ${Object.values(attrs).join(" ")}`);
      if (!q.text.every((t) => hay.includes(norm(t)))) continue;
      if (!why.length) why.push(norm(e.name).includes(norm(q.text.join(" "))) ? "name" : "text match");
    }
    matched.push({ e, why });
  }
  matched.sort((a, b) => a.e.kind.localeCompare(b.e.kind) || a.e.name.localeCompare(b.e.name));

  const ids = matched.slice(0, limit).map((m) => m.e.id);
  const usage = ids.length
    ? await db.select({ entityId: s.boardEntities.entityId, boardId: s.boards.id, name: s.boards.name }).from(s.boardEntities).innerJoin(s.boards, eq(s.boardEntities.boardId, s.boards.id)).where(inArray(s.boardEntities.entityId, ids))
    : [];
  const boardsOf = new Map<string, Array<{ id: string; name: string }>>();
  for (const u of usage) {
    const list = boardsOf.get(u.entityId) ?? [];
    if (!list.some((b) => b.id === u.boardId)) list.push({ id: u.boardId, name: u.name });
    boardsOf.set(u.entityId, list);
  }
  const out: QueryResultEntity[] = matched.slice(0, limit).map(({ e, why }) => ({
    id: e.id,
    kind: e.kind,
    name: e.name,
    description: e.description,
    attributes: parseAttributes(e.attributes),
    boards: boardsOf.get(e.id) ?? [],
    why: [...new Set(why)].join(" · "),
  }));
  return { query: q, explanation: describeQuery(q), entities: out, total: matched.length };
}
