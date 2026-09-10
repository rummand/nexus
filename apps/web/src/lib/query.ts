import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "./graph";
import type { ParsedQuery, QueryResponse, QueryResultEntity } from "./graph-types";
import { evidenceFor } from "./query-evidence";
import { matchEntities, type QueryWorld } from "./query-match";

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

/*
 * Curly quotes count. People arrive at this box by copying a phrase out of a document, an email
 * or a chat client that helpfully replaced their quotes — and a query language that then reads
 * `related:“Data Lake”` as the entity `“Data` fails in the most confusing way available: it
 * finds nothing, and blames the estate for it.
 */
const OPEN = '["\u201c\u2018]';
const CLOSE = '["\u201d\u2019]';

function tokenize(q: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`(\\S+?:${OPEN}[^"\u201c\u201d\u2018\u2019]*${CLOSE}|${OPEN}[^"\u201c\u201d\u2018\u2019]*${CLOSE}|\\S+)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push(m[0]);
  return out;
}

const unquote = (v: string) => v.replace(/^["\u201c\u2018]|["\u201d\u2019]$/g, "");

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

  /*
   * Everything is loaded, always. The old runner skipped the relations read unless the query
   * mentioned one — a sound optimisation for answering the question, and fatal for explaining an
   * empty answer, which needs to know what the estate holds that the question did not ask about.
   * At the explorer's node cap this is one extra read of a table already indexed by workspace.
   */
  const [entities, relations, placed] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
    db
      .select({ entityId: s.boardEntities.entityId, boardId: s.boards.id, name: s.boards.name })
      .from(s.boardEntities)
      .innerJoin(s.boards, eq(s.boardEntities.boardId, s.boards.id))
      .where(eq(s.boards.workspaceId, workspaceId)),
  ]);

  const byId = new Map(entities.map((e) => [e.id, e]));
  const boardNames = new Map<string, string[]>();
  const boardsOf = new Map<string, Array<{ id: string; name: string }>>();
  for (const p of placed) {
    const names = boardNames.get(p.entityId) ?? [];
    if (!names.includes(p.name)) names.push(p.name);
    boardNames.set(p.entityId, names);
    const list = boardsOf.get(p.entityId) ?? [];
    if (!list.some((b) => b.id === p.boardId)) list.push({ id: p.boardId, name: p.name });
    boardsOf.set(p.entityId, list);
  }

  const world: QueryWorld = {
    entities: entities.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      description: e.description,
      attributes: parseAttributes(e.attributes),
    })),
    relations: relations.map((r) => ({ id: r.id, from: r.fromEntityId, to: r.toEntityId, kind: r.kind })),
    boards: boardNames,
  };

  const matched = matchEntities(world, q).sort((a, b) => {
    const ea = byId.get(a.id)!, eb = byId.get(b.id)!;
    return ea.kind.localeCompare(eb.kind) || ea.name.localeCompare(eb.name);
  });

  const out: QueryResultEntity[] = matched.slice(0, limit).map((m) => {
    const e = byId.get(m.id)!;
    return {
      id: e.id,
      kind: e.kind,
      name: e.name,
      description: e.description,
      attributes: parseAttributes(e.attributes),
      boards: boardsOf.get(e.id) ?? [],
      why: [...new Set(m.why)].join(" · "),
    };
  });

  return {
    query: q,
    explanation: describeQuery(q),
    entities: out,
    total: matched.length,
    evidence: evidenceFor(world, q, matched.length),
  };
}
