import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { migrateDocument, parseDocument } from "@/canvas/document";
import { documentToSvg } from "@/canvas/export";
import { parseAttributes } from "@/lib/graph";
import { runQuery } from "@/lib/query";
import { parseMarkdown, references, summarise, type Block, type EmbedKind } from "./markdown";

/**
 * Reading the wiki (§5.60).
 *
 * The interesting half is `resolveEmbeds`. A page's markdown holds *references* to the model —
 * `:::board brd_landscape` — and this turns them into what they currently mean. It runs on the
 * server for the same reason the conformance report does (§5.56): the answer needs the whole
 * graph, and shipping the estate to the browser to render a paragraph would be sending everything
 * to say one thing.
 *
 * Every embed resolves to something, including "this is gone". A page that silently drops a board
 * somebody deleted is worse than one that says the board is missing, because only the second gets
 * fixed.
 */

export interface WikiNode {
  id: string;
  slug: string;
  title: string;
  icon: string;
  position: number;
  children: WikiNode[];
}

/** The tree down the side of the wiki, ordered as the pages were arranged. */
export function buildTree(rows: s.WikiPageRow[]): WikiNode[] {
  const byId = new Map<string, WikiNode>();
  for (const r of rows) byId.set(r.id, { id: r.id, slug: r.slug, title: r.title, icon: r.icon, position: r.position, children: [] });
  const roots: WikiNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    // A page whose parent is gone is shown at the root rather than hidden: an orphan you can see
    // is a page somebody can re-file, and one you cannot is a page nobody knows they have lost.
    const parent = r.parentId ? byId.get(r.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sort = (list: WikiNode[]) => {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    for (const n of list) sort(n.children);
  };
  sort(roots);
  return roots;
}

export async function wikiTree(db: Db, workspaceId: string): Promise<WikiNode[]> {
  const rows = await db.select().from(s.wikiPages).where(eq(s.wikiPages.workspaceId, workspaceId));
  return buildTree(rows);
}

export async function pageBySlug(db: Db, workspaceId: string, slug: string): Promise<s.WikiPageRow | null> {
  const [row] = await db.select().from(s.wikiPages)
    .where(and(eq(s.wikiPages.workspaceId, workspaceId), eq(s.wikiPages.slug, slug)));
  return row ?? null;
}

/** The ancestors of a page, root first — the breadcrumb. */
export function trail(rows: s.WikiPageRow[], id: string): s.WikiPageRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: s.WikiPageRow[] = [];
  const seen = new Set<string>();
  let at = byId.get(id);
  while (at && !seen.has(at.id)) {
    seen.add(at.id); // a cycle would otherwise hang the page; it cannot happen, so say so once
    out.unshift(at);
    at = at.parentId ? byId.get(at.parentId) : undefined;
  }
  return out;
}

export type ResolvedEmbed =
  | { kind: "board"; ok: true; boardId: string; name: string; svg: string; objects: number }
  | { kind: "object"; ok: true; id: string; objectKind: string; name: string; description: string; attributes: Record<string, string> }
  | { kind: "query"; ok: true; query: string; explanation: string; total: number; entities: Array<{ id: string; kind: string; name: string; why: string }> }
  | { kind: EmbedKind; ok: false; target: string; why: string };

export type EmbedMap = Map<string, ResolvedEmbed>;

export const embedKey = (kind: EmbedKind, target: string) => `${kind}:${target}`;

/** What every embed on this page currently means. */
export async function resolveEmbeds(db: Db, workspaceId: string, blocks: Block[]): Promise<EmbedMap> {
  const out: EmbedMap = new Map();
  const wanted = references(blocks).embeds;
  for (const { kind, target } of wanted) {
    const key = embedKey(kind, target);
    if (out.has(key)) continue;
    out.set(key, await resolveOne(db, workspaceId, kind, target));
  }
  return out;
}

async function resolveOne(db: Db, workspaceId: string, kind: EmbedKind, target: string): Promise<ResolvedEmbed> {
  if (!target) return { kind, ok: false, target, why: "This embed does not say what it is pointing at." };

  if (kind === "board") {
    const [board] = await db.select().from(s.boards)
      .where(and(eq(s.boards.workspaceId, workspaceId), eq(s.boards.id, target)));
    if (!board) return { kind, ok: false, target, why: "That board is not in this workspace any more." };
    const doc = migrateDocument(parseDocument(board.document));
    return {
      kind: "board", ok: true, boardId: board.id, name: board.name,
      // Drawn from the document as it is now: this is the whole point of an embed over a picture.
      svg: documentToSvg(doc, { title: board.name }),
      objects: Object.keys(doc.elements).length,
    };
  }

  if (kind === "object") {
    const [e] = await db.select().from(s.entities)
      .where(and(eq(s.entities.workspaceId, workspaceId), eq(s.entities.id, target)));
    if (!e) return { kind, ok: false, target, why: "That object is no longer in the graph." };
    return {
      kind: "object", ok: true, id: e.id, objectKind: e.kind, name: e.name,
      description: e.description, attributes: parseAttributes(e.attributes),
    };
  }

  const result = await runQuery(db, workspaceId, target, 25);
  return {
    kind: "query", ok: true, query: target, explanation: result.explanation, total: result.total,
    entities: result.entities.map((x) => ({ id: x.id, kind: x.kind, name: x.name, why: x.why })),
  };
}

/** One line about a page, for a list of pages. */
export function pageSummary(row: s.WikiPageRow): string {
  return summarise(parseMarkdown(row.body));
}

/**
 * A slug that is readable, stable and free.
 *
 * Titles collide — two teams will both write "Principles" — so the caller passes what is taken and
 * gets back the next free one rather than a write that fails on a unique index.
 */
export function slugFor(title: string, taken: Set<string>): string {
  const base = title.trim().toLowerCase()
    .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 60) || "page";
  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now().toString(36)}`;
}
