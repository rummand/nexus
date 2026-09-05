import { nanoid } from "nanoid";
import { CARD_H, CARD_W, cardForEntity } from "@/canvas/entityCard";
import { cardColorForKind, isBoxElement, type CanvasDocument, type CanvasElement, type CardElement } from "@/canvas/document";
import { parseQuery } from "../query";
import type { Instruction } from "./script";

/**
 * Executing a board script.
 *
 * Pure: (document, what the workspace contains, one instruction) → (document, what happened).
 * Purity is the point — a board built from text has to be reproducible, so the same script over
 * the same graph must give the same board, down to the coordinates.
 */

export interface ComposeEntity {
  id: string;
  kind: string;
  name: string;
  description: string;
  attributes: Record<string, string>;
  /** Names of boards this entity already appears on, for `on:` clauses. */
  boards: string[];
}

export interface ComposeRelation {
  id: string;
  from: string;
  to: string;
  kind: string;
}

export interface ComposeContext {
  entities: ComposeEntity[];
  relations: ComposeRelation[];
}

export interface StepResult {
  ok: boolean;
  message: string;
}

const GAP_X = 40;
const GAP_Y = 44;
/** How wide a single row or column may grow before it wraps. A 60-card row is not a layout. */
const WRAP = 8;
const ORIGIN = { x: 120, y: 200 };

const norm = (v: string) => v.trim().toLowerCase();

/** Cards that are views of a graph entity, in a stable order. */
function placedCards(doc: CanvasDocument): CardElement[] {
  return Object.values(doc.elements)
    .filter((el): el is CardElement => el.type === "card" && typeof el.meta?.entityId === "string")
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

const entityIdOf = (card: CardElement) => String(card.meta!.entityId);

/** Match entities against the query grammar, in memory. Mirrors src/lib/query.ts's runner. */
export function matchEntities(ctx: ComposeContext, raw: string): ComposeEntity[] {
  const q = parseQuery(raw);
  const relKinds = q.relationKinds.map(norm);

  let relatedIds: Set<string> | null = null;
  for (const clause of q.related) {
    const anchors = ctx.entities.filter((e) => norm(e.name) === norm(clause.name) || norm(e.name).includes(norm(clause.name)));
    const ids = new Set<string>();
    for (const anchor of anchors) {
      for (const r of ctx.relations) {
        if (relKinds.length && !relKinds.some((k) => norm(r.kind).includes(k))) continue;
        if ((clause.direction === "both" || clause.direction === "out") && r.from === anchor.id) ids.add(r.to);
        if ((clause.direction === "both" || clause.direction === "in") && r.to === anchor.id) ids.add(r.from);
      }
    }
    const previous = relatedIds as Set<string> | null;
    relatedIds = previous === null ? ids : new Set([...previous].filter((id: string) => ids.has(id)));
  }

  return ctx.entities.filter((e) => {
    if (relatedIds && !relatedIds.has(e.id)) return false;
    if (q.kinds.length && !q.kinds.some((k) => norm(e.kind) === norm(k) || norm(e.kind).includes(norm(k)))) return false;
    if (q.boards.length && !q.boards.some((b) => e.boards.some((name) => norm(name).includes(norm(b))))) return false;
    for (const { key, value } of q.attributes) {
      const found = Object.entries(e.attributes).find(([k]) => norm(k) === norm(key));
      if (!found || !norm(found[1]).includes(norm(value))) return false;
    }
    for (const key of q.has) if (!Object.entries(e.attributes).some(([k, v]) => norm(k) === key && v.trim())) return false;
    for (const key of q.missing) if (Object.entries(e.attributes).some(([k, v]) => norm(k) === key && v.trim())) return false;
    for (const t of q.text) {
      const hay = `${e.name} ${e.kind} ${e.description} ${Object.values(e.attributes).join(" ")}`.toLowerCase();
      if (!hay.includes(norm(t))) return false;
    }
    // A query with no clause at all matches nothing: "add" with nothing to add is a mistake,
    // not a request for the entire graph.
    return q.kinds.length + q.attributes.length + q.text.length + q.related.length + q.has.length + q.missing.length + q.boards.length > 0;
  });
}

/** Where the next card goes: a grid that continues below whatever is already placed. */
function nextSlot(count: number, offset: number): { x: number; y: number } {
  const i = count + offset;
  return { x: ORIGIN.x + (i % WRAP) * (CARD_W + GAP_X), y: ORIGIN.y + Math.floor(i / WRAP) * (CARD_H + GAP_Y) };
}

export function applyInstruction(doc: CanvasDocument, ctx: ComposeContext, ins: Instruction): { document: CanvasDocument; result: StepResult } {
  const elements: Record<string, CanvasElement> = { ...doc.elements };
  const document = { ...doc, elements };
  const ok = (message: string) => ({ document, result: { ok: true, message } });

  switch (ins.verb) {
    case "clear": {
      const n = Object.keys(elements).length;
      for (const id of Object.keys(elements)) delete elements[id];
      return ok(`cleared ${n} object${n === 1 ? "" : "s"}`);
    }

    case "add": {
      const already = new Set(placedCards(document).map(entityIdOf));
      const matched = matchEntities(ctx, ins.query).filter((e) => !already.has(e.id));
      if (matched.length === 0) return { document, result: { ok: false, message: `nothing matched ${ins.query}` } };
      const offset = placedCards(document).length;
      const taken = matched.slice(0, ins.limit);
      taken.forEach((entity, i) => {
        const at = nextSlot(i, offset);
        const card = cardForEntity(entity, at.x, at.y);
        elements[card.id] = card;
      });
      const capped = matched.length > taken.length ? `, ${matched.length - taken.length} more not placed` : "";
      return ok(`added ${taken.length} object${taken.length === 1 ? "" : "s"}${capped}`);
    }

    case "remove": {
      const doomed = new Set(matchEntities(ctx, ins.query).map((e) => e.id));
      const cards = placedCards(document).filter((c) => doomed.has(entityIdOf(c)));
      const ids = new Set(cards.map((c) => c.id));
      for (const id of ids) delete elements[id];
      // a connector with a missing end is a dangling line, not a relation
      for (const el of Object.values(elements)) {
        if (el.type !== "connector") continue;
        const from = "elementId" in el.from ? el.from.elementId : null;
        const to = "elementId" in el.to ? el.to.elementId : null;
        if ((from && ids.has(from)) || (to && ids.has(to))) delete elements[el.id];
      }
      return cards.length
        ? ok(`removed ${cards.length} object${cards.length === 1 ? "" : "s"}`)
        : { document, result: { ok: false, message: `nothing on the board matched ${ins.query}` } };
    }

    case "expand": {
      const present = new Set(placedCards(document).map(entityIdOf));
      if (present.size === 0) return { document, result: { ok: false, message: "nothing here to expand from" } };
      const wanted = new Set(present);
      let frontier = [...present];
      for (let hop = 0; hop < ins.hops; hop++) {
        const next: string[] = [];
        for (const r of ctx.relations) {
          if (ins.relationKinds.length && !ins.relationKinds.some((k) => norm(r.kind).includes(norm(k)))) continue;
          if ((ins.direction === "both" || ins.direction === "out") && frontier.includes(r.from) && !wanted.has(r.to)) { wanted.add(r.to); next.push(r.to); }
          if ((ins.direction === "both" || ins.direction === "in") && frontier.includes(r.to) && !wanted.has(r.from)) { wanted.add(r.from); next.push(r.from); }
        }
        frontier = next;
        if (frontier.length === 0) break;
      }
      const added = [...wanted].filter((id) => !present.has(id));
      const byId = new Map(ctx.entities.map((e) => [e.id, e]));
      const offset = placedCards(document).length;
      let i = 0;
      for (const id of added) {
        const entity = byId.get(id);
        if (!entity) continue;
        const at = nextSlot(i++, offset);
        const card = cardForEntity(entity, at.x, at.y);
        elements[card.id] = card;
      }
      return i > 0 ? ok(`pulled in ${i} neighbour${i === 1 ? "" : "s"}`) : { document, result: { ok: false, message: "no neighbours to pull in" } };
    }

    case "connect": {
      const cards = placedCards(document);
      const cardFor = new Map(cards.map((c) => [entityIdOf(c), c]));
      const existing = new Set(
        Object.values(elements)
          .filter((el) => el.type === "connector" && typeof el.meta?.relationId === "string")
          .map((el) => String(el.meta!.relationId)),
      );
      let drawn = 0;
      for (const r of ctx.relations) {
        if (ins.relationKinds.length && !ins.relationKinds.some((k) => norm(r.kind).includes(norm(k)))) continue;
        const from = cardFor.get(r.from);
        const to = cardFor.get(r.to);
        if (!from || !to || from.id === to.id || existing.has(r.id)) continue;
        const id = nanoid(10);
        elements[id] = {
          id,
          type: "connector",
          z: 0,
          from: { elementId: from.id },
          to: { elementId: to.id },
          label: r.kind,
          stroke: "#94a3b8",
          style: "solid",
          route: "curved",
          arrowEnd: true,
          arrowStart: false,
          meta: { relationId: r.id },
        };
        drawn++;
      }
      return drawn > 0 ? ok(`drew ${drawn} relation${drawn === 1 ? "" : "s"}`) : { document, result: { ok: false, message: "no relations between what is here" } };
    }

    case "group": {
      const cards = placedCards(document);
      if (cards.length === 0) return { document, result: { ok: false, message: "nothing here to group" } };
      // drop the frames a previous grouping made, so re-running is idempotent
      for (const el of Object.values(elements)) if (el.type === "frame" && el.meta?.composed) delete elements[el.id];

      const groups = new Map<string, CardElement[]>();
      for (const card of cards) {
        const value = ins.isAttribute ? (card.attributes?.[ins.by] ?? findAttribute(card, ins.by) ?? "—") : card.kind || "—";
        groups.set(value, [...(groups.get(value) ?? []), card]);
      }
      const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
      const perColumn = Math.max(1, Math.ceil(Math.sqrt(Math.max(...ordered.map(([, list]) => list.length)))));
      let x = ORIGIN.x;
      for (const [value, list] of ordered) {
        const rows = Math.ceil(list.length / perColumn);
        const width = perColumn * CARD_W + (perColumn - 1) * GAP_X;
        const height = rows * CARD_H + (rows - 1) * GAP_Y;
        list.forEach((card, i) => {
          elements[card.id] = {
            ...card,
            x: x + (i % perColumn) * (CARD_W + GAP_X),
            y: ORIGIN.y + 56 + Math.floor(i / perColumn) * (CARD_H + GAP_Y),
          };
        });
        const frameId = nanoid(10);
        elements[frameId] = {
          id: frameId,
          type: "frame",
          x: x - 26,
          y: ORIGIN.y,
          w: width + 52,
          h: height + 92,
          title: `${value} · ${list.length}`,
          color: "#1376d4",
          z: -1,
          meta: { composed: true },
        };
        x += width + 52 + GAP_X * 2;
      }
      return ok(`grouped into ${ordered.length} frame${ordered.length === 1 ? "" : "s"} by ${ins.by}`);
    }

    case "colour": {
      const cards = placedCards(document);
      if (cards.length === 0) return { document, result: { ok: false, message: "nothing here to colour" } };
      const palette = ["#1376d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0ea5e9", "#64748b"];
      const assigned = new Map<string, string>();
      for (const card of cards) {
        const value = ins.isAttribute ? (findAttribute(card, ins.by) ?? "—") : card.kind || "—";
        const colour = ins.isAttribute
          ? assigned.get(value) ?? palette[assigned.size % palette.length]!
          : cardColorForKind(card.kind);
        assigned.set(value, colour);
        elements[card.id] = { ...card, color: colour };
      }
      return ok(`coloured by ${ins.by} · ${assigned.size} value${assigned.size === 1 ? "" : "s"}`);
    }

    case "layout": {
      const cards = placedCards(document);
      if (cards.length === 0) return { document, result: { ok: false, message: "nothing here to lay out" } };
      for (const el of Object.values(elements)) if (el.type === "frame" && el.meta?.composed) delete elements[el.id];
      const positioned = layoutCards(cards, ctx, ins.style, ins.by);
      for (const [id, at] of positioned) {
        const card = elements[id];
        if (card && isBoxElement(card)) elements[id] = { ...card, x: at.x, y: at.y };
      }
      return ok(`laid out ${cards.length} object${cards.length === 1 ? "" : "s"} as ${ins.style}${ins.by ? ` by ${ins.by}` : ""}`);
    }

    case "title": {
      for (const el of Object.values(elements)) if (el.type === "text" && el.meta?.composedTitle) delete elements[el.id];
      const id = nanoid(10);
      elements[id] = {
        id, type: "text", variant: "section", title: ins.text, text: "",
        color: "#1376d4", x: ORIGIN.x, y: 80, w: 720, h: 84, z: 1, meta: { composedTitle: true },
      };
      return ok(`titled “${ins.text}”`);
    }

    case "note": {
      const notes = Object.values(elements).filter((el) => el.type === "sticky").length;
      const id = nanoid(10);
      elements[id] = {
        id, type: "sticky", title: "", text: ins.text, color: "#ff9800",
        x: ORIGIN.x - 300, y: ORIGIN.y + notes * 200, w: 240, h: 180, z: 2,
      };
      return ok("added a note");
    }

    case "unknown":
      return { document, result: { ok: false, message: ins.hint } };
  }
}

/** Attribute lookup that does not care about case or separators. */
function findAttribute(card: CardElement, key: string): string | null {
  const want = norm(key).replace(/[_-]+/g, " ");
  for (const [k, v] of Object.entries(card.attributes ?? {})) {
    if (norm(k).replace(/[_-]+/g, " ") === want) return v || null;
  }
  return null;
}

/** Positions for a set of cards under one arrangement. */
function layoutCards(cards: CardElement[], ctx: ComposeContext, style: string, by?: string): Array<[string, { x: number; y: number }]> {
  const out: Array<[string, { x: number; y: number }]> = [];
  const stepX = CARD_W + GAP_X;
  const stepY = CARD_H + GAP_Y;

  if (style === "circle") {
    const radius = Math.max(320, (cards.length * (CARD_W + GAP_X)) / (2 * Math.PI));
    cards.forEach((card, i) => {
      const angle = (i / cards.length) * Math.PI * 2 - Math.PI / 2;
      out.push([card.id, { x: ORIGIN.x + 400 + Math.cos(angle) * radius, y: ORIGIN.y + 300 + Math.sin(angle) * radius }]);
    });
    return out;
  }

  if (style === "columns" || style === "rows") {
    const groups = new Map<string, CardElement[]>();
    for (const card of cards) {
      const value = by && by !== "kind" ? (findAttribute(card, by) ?? "—") : card.kind || "—";
      groups.set(value, [...(groups.get(value) ?? []), card]);
    }
    const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    // A group with sixty members is not one column sixty tall; it wraps into sub-columns.
    let offset = 0;
    for (const [, list] of ordered) {
      const lanes = Math.ceil(list.length / WRAP);
      list.forEach((card, i) => {
        const lane = Math.floor(i / WRAP);
        const within = i % WRAP;
        out.push([card.id, style === "columns"
          ? { x: ORIGIN.x + (offset + lane) * stepX, y: ORIGIN.y + within * stepY }
          : { x: ORIGIN.x + within * stepX, y: ORIGIN.y + (offset + lane) * stepY }]);
      });
      offset += lanes;
    }
    return out;
  }

  if (style === "flow") {
    // Layer by dependency: things nothing on the board points at come first.
    const ids = new Set(cards.map((c) => String(c.meta!.entityId)));
    const incoming = new Map<string, number>();
    const edges = ctx.relations.filter((r) => ids.has(r.from) && ids.has(r.to));
    for (const id of ids) incoming.set(id, 0);
    for (const r of edges) incoming.set(r.to, (incoming.get(r.to) ?? 0) + 1);
    const level = new Map<string, number>();
    let frontier = [...ids].filter((id) => (incoming.get(id) ?? 0) === 0);
    if (frontier.length === 0) frontier = [...ids].slice(0, 1); // a cycle still has to start somewhere
    let depth = 0;
    const seen = new Set<string>();
    while (frontier.length > 0 && depth < 12) {
      const next: string[] = [];
      for (const id of frontier) {
        if (seen.has(id)) continue;
        seen.add(id);
        level.set(id, depth);
        for (const r of edges) if (r.from === id && !seen.has(r.to)) next.push(r.to);
      }
      frontier = [...new Set(next)];
      depth++;
    }
    for (const id of ids) if (!level.has(id)) level.set(id, depth);
    const byLevel = new Map<number, CardElement[]>();
    for (const card of cards) {
      const l = level.get(String(card.meta!.entityId)) ?? 0;
      byLevel.set(l, [...(byLevel.get(l) ?? []), card]);
    }
    // Levels wrap too: everything with no dependency lands on level 0, and there can be dozens.
    let top = ORIGIN.y;
    for (const [, list] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
      const rows = Math.ceil(list.length / WRAP);
      list.forEach((card, i) => {
        out.push([card.id, { x: ORIGIN.x + (i % WRAP) * stepX, y: top + Math.floor(i / WRAP) * stepY }]);
      });
      top += rows * stepY + 60;
    }
    return out;
  }

  cards.forEach((card, i) => {
    out.push([card.id, { x: ORIGIN.x + (i % WRAP) * stepX, y: ORIGIN.y + Math.floor(i / WRAP) * stepY }]);
  });
  return out;
}

/** Run a whole script over a document. The board is what the text says it is. */
export function runScript(doc: CanvasDocument, ctx: ComposeContext, instructions: Instruction[]): { document: CanvasDocument; results: StepResult[] } {
  let current = doc;
  const results: StepResult[] = [];
  for (const ins of instructions) {
    const { document, result } = applyInstruction(current, ctx, ins);
    current = document;
    results.push(result);
  }
  return { document: current, results };
}
