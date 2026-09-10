import type { ParsedQuery } from "./graph-types";

/**
 * The matcher, as a pure function over a loaded world (§5.69).
 *
 * It used to be inline in `runQuery`, interleaved with the database reads, which made one thing
 * impossible: **asking the query a second question.** When nothing matches, the useful reply is
 * not "no results" but "which clause is responsible" — and answering that means running the same
 * match again with one clause removed. That is trivial against a pure function over data already
 * in memory, and impossible against a function that also does the loading.
 */

export interface WorldEntity {
  id: string;
  kind: string;
  name: string;
  description: string;
  attributes: Record<string, string>;
}

export interface WorldRelation {
  id: string;
  from: string;
  to: string;
  kind: string;
}

export interface QueryWorld {
  entities: WorldEntity[];
  relations: WorldRelation[];
  /** entity id → the names of the boards it appears on. */
  boards: Map<string, string[]>;
}

export interface Match {
  id: string;
  why: string[];
}

export const norm = (v: string) => v.trim().toLowerCase();

/** Entities whose name is, or contains, the given text. Anchors for a `related:` clause. */
export function resolveSeed(world: QueryWorld, name: string): WorldEntity[] {
  const n = norm(name);
  const exact = world.entities.filter((e) => norm(e.name) === n);
  return exact.length ? exact : world.entities.filter((e) => norm(e.name).includes(n));
}

function attributeKey(attrs: Record<string, string>, key: string): string | undefined {
  return Object.keys(attrs).find((k) => norm(k) === key || norm(k).startsWith(key));
}

export function matchEntities(world: QueryWorld, q: ParsedQuery): Match[] {
  const relKinds = q.relationKinds.map(norm);

  let boardIds: Set<string> | null = null;
  const boardWhy = new Map<string, string>();
  if (q.boards.length) {
    boardIds = new Set();
    for (const [entityId, names] of world.boards) {
      const hit = names.find((name) => q.boards.some((b) => norm(name).includes(norm(b))));
      if (hit) {
        boardIds.add(entityId);
        boardWhy.set(entityId, `on ${hit}`);
      }
    }
  }

  let relatedIds: Set<string> | null = null;
  const relatedWhy = new Map<string, string>();
  for (const clause of q.related) {
    const ids = new Set<string>();
    for (const anchor of resolveSeed(world, clause.name)) {
      for (const r of world.relations) {
        if (relKinds.length && !relKinds.some((k) => norm(r.kind).includes(k))) continue;
        if ((clause.direction === "both" || clause.direction === "out") && r.from === anchor.id) {
          ids.add(r.to);
          relatedWhy.set(r.to, `${anchor.name} → ${r.kind || "related"}`);
        }
        if ((clause.direction === "both" || clause.direction === "in") && r.to === anchor.id) {
          ids.add(r.from);
          relatedWhy.set(r.from, `${r.kind || "related"} → ${anchor.name}`);
        }
      }
    }
    if (relatedIds === null) relatedIds = ids;
    else {
      const prev: Set<string> = relatedIds;
      relatedIds = new Set(Array.from(prev).filter((id) => ids.has(id)));
    }
  }

  /*
   * `rel:` on its own used to be silently ignored — the clause was only consulted inside a
   * `related:` loop, so a query naming a relationship type and nothing else returned the entire
   * workspace while looking like it had filtered. Read alone it means the obvious thing: things
   * this relationship touches.
   */
  if (relKinds.length && q.related.length === 0) {
    const touched = new Set<string>();
    for (const r of world.relations) {
      if (!relKinds.some((k) => norm(r.kind).includes(k))) continue;
      touched.add(r.from);
      touched.add(r.to);
    }
    if (relatedIds === null) relatedIds = touched;
    else {
      const prev: Set<string> = relatedIds;
      relatedIds = new Set(Array.from(prev).filter((id) => touched.has(id)));
    }
    for (const id of touched) if (!relatedWhy.has(id)) relatedWhy.set(id, q.relationKinds.join(" / "));
  }

  const out: Match[] = [];
  for (const e of world.entities) {
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

    let ok = true;
    for (const a of q.attributes) {
      const key = attributeKey(e.attributes, a.key);
      if (!key || !norm(e.attributes[key] ?? "").includes(norm(a.value))) { ok = false; break; }
      why.push(`${key} · ${e.attributes[key]}`);
    }
    if (!ok) continue;

    for (const k of q.has) {
      const hit = attributeKey(e.attributes, k);
      if (!hit || !e.attributes[hit]) { ok = false; break; }
      why.push(`has ${hit}`);
    }
    if (!ok) continue;

    for (const k of q.missing) {
      const hit = attributeKey(e.attributes, k);
      if (hit && e.attributes[hit]) { ok = false; break; }
      why.push(`no ${k}`);
    }
    if (!ok) continue;

    if (q.text.length) {
      const hay = norm(`${e.kind} ${e.name} ${e.description} ${Object.values(e.attributes).join(" ")}`);
      if (!q.text.every((t) => hay.includes(norm(t)))) continue;
      if (!why.length) why.push(norm(e.name).includes(norm(q.text.join(" "))) ? "name" : "text match");
    }

    out.push({ id: e.id, why });
  }

  return out;
}

/* -------------------------------------------------------------------------------------------- */
/* Taking the query apart                                                                          */
/* -------------------------------------------------------------------------------------------- */

/** One removable condition, and the query with it removed. */
export interface Clause {
  /** How the clause was written, so the reader recognises it. */
  label: string;
  without: ParsedQuery;
}

/**
 * Every clause of a query, each paired with the query that would remain without it.
 *
 * This is what lets an empty result name the condition responsible rather than shrug. Order is
 * the order the clauses would be blamed in — the narrowest kinds of condition first — so that
 * when several are equally guilty the reader is pointed at the one most likely to be a mistake.
 */
export function clauses(q: ParsedQuery): Clause[] {
  const out: Clause[] = [];
  const drop = (label: string, patch: Partial<ParsedQuery>) =>
    out.push({ label, without: { ...q, ...patch } });

  for (const r of q.related) {
    const verb = r.direction === "out" ? "from" : r.direction === "in" ? "to" : "related";
    drop(`${verb}:${r.name}`, { related: q.related.filter((x) => x !== r) });
  }
  for (const k of q.relationKinds) drop(`via ${k}`, { relationKinds: q.relationKinds.filter((x) => x !== k) });
  for (const k of q.kinds) drop(`kind:${k}`, { kinds: q.kinds.filter((x) => x !== k) });
  for (const a of q.attributes) drop(`${a.key}:${a.value}`, { attributes: q.attributes.filter((x) => x !== a) });
  for (const k of q.has) drop(`has:${k}`, { has: q.has.filter((x) => x !== k) });
  for (const k of q.missing) drop(`missing:${k}`, { missing: q.missing.filter((x) => x !== k) });
  for (const b of q.boards) drop(`on:${b}`, { boards: q.boards.filter((x) => x !== b) });
  if (q.text.length) drop(`“${q.text.join(" ")}”`, { text: [] });
  return out;
}
