import type { CanvasElement, ConnectorElement, ElementId } from "./document";

/**
 * Lenses are client-side optics over the board: they never change the document, only how it is
 * drawn. `impact` dims everything that is not reachable from the selection along connectors;
 * `attribute` colours cards by the value of one attribute and dims cards that lack it.
 */
export type Lens =
  | { type: "none" }
  | { type: "impact"; direction: "both" | "out" | "in"; depth: number }
  | { type: "attribute"; key: string }
  /** Colour connectors by relation type; `hidden` relation types fade out. */
  | { type: "relation"; hidden: string[] }
  /** A graph query: cards whose entity is in the result set stay, the rest fade. `entityIds` is the last result. */
  | { type: "query"; q: string; entityIds: string[] };

export const NO_LENS: Lens = { type: "none" };

export interface LensLegendEntry {
  value: string;
  color: string;
  count: number;
  ids: ElementId[];
  /** Relation lens: this relation type is currently faded out. */
  hidden?: boolean;
}

/** Label shown for connectors without a relation type. */
export const UNLABELLED = "(unlabelled)";

/** Relation types used by connectors on the board, most common first. */
export function relationKindsOnBoard(elements: Record<ElementId, CanvasElement>): Array<{ kind: string; count: number }> {
  const counts = new Map<string, number>();
  for (const el of Object.values(elements)) if (el.type === "connector") { const k = el.label.trim() || UNLABELLED; counts.set(k, (counts.get(k) ?? 0) + 1); }
  return [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

export interface LensResult {
  lens: Exclude<Lens, { type: "none" }>;
  /** Cards and connectors that stay fully visible; everything else of those types is dimmed. */
  visible: Set<ElementId>;
  /** Per-element accent colour (cards for the attribute lens, connectors for the relation lens). */
  colors: Record<ElementId, string>;
  /** Per-card hop distance from the selection (impact lens; 0 = selected). */
  hops: Record<ElementId, number>;
  legend: LensLegendEntry[];
  /** Human summary for the legend card. */
  summary: string;
}

/** Categorical palette for attribute values, in LeanFlow's accent family. */
export const LENS_PALETTE = ["#1376d4", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#0ea5e9", "#ec4899", "#84cc16", "#f97316", "#64748b"];

/** Attribute keys used by cards on the board, most common first. */
export function attributeKeysOnBoard(elements: Record<ElementId, CanvasElement>): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const el of Object.values(elements)) {
    if (el.type !== "card" || !el.attributes) continue;
    for (const k of Object.keys(el.attributes)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function endpoint(end: ConnectorElement["from"]): ElementId | null {
  return "elementId" in end ? end.elementId : null;
}

/**
 * Breadth-first reachability from `roots` along connectors. Returns hop distance per element
 * (roots = 0) and the connector ids that were traversed.
 */
export function reachable(elements: Record<ElementId, CanvasElement>, roots: ElementId[], direction: "both" | "out" | "in", depth: number): { hops: Record<ElementId, number>; connectors: Set<ElementId> } {
  const out = new Map<ElementId, Array<{ to: ElementId; via: ElementId }>>();
  const add = (a: ElementId, b: ElementId, via: ElementId) => {
    const list = out.get(a) ?? [];
    list.push({ to: b, via });
    out.set(a, list);
  };
  for (const el of Object.values(elements)) {
    if (el.type !== "connector") continue;
    const from = endpoint(el.from);
    const to = endpoint(el.to);
    if (!from || !to) continue;
    if (direction === "out" || direction === "both") add(from, to, el.id);
    if (direction === "in" || direction === "both") add(to, from, el.id);
  }
  const hops: Record<ElementId, number> = {};
  const connectors = new Set<ElementId>();
  let frontier = roots.filter((id) => elements[id] && elements[id]!.type !== "connector");
  for (const id of frontier) hops[id] = 0;
  for (let d = 1; d <= depth && frontier.length > 0; d++) {
    const next: ElementId[] = [];
    for (const id of frontier) {
      for (const edge of out.get(id) ?? []) {
        connectors.add(edge.via);
        if (edge.to in hops) continue;
        hops[edge.to] = d;
        next.push(edge.to);
      }
    }
    frontier = next;
  }
  return { hops, connectors };
}

export function computeLens(lens: Lens, elements: Record<ElementId, CanvasElement>, selection: ElementId[]): LensResult | null {
  if (lens.type === "none") return null;
  if (lens.type === "impact") {
    const roots = selection.filter((id) => elements[id]?.type === "card");
    if (roots.length === 0) {
      // Nothing selected: the lens is armed but shows everything.
      return { lens, visible: new Set(Object.keys(elements)), colors: {}, hops: {}, legend: [], summary: "Select a card to trace its impact" };
    }
    const { hops, connectors } = reachable(elements, roots, lens.direction, lens.depth);
    const visible = new Set<ElementId>([...Object.keys(hops), ...connectors]);
    const perHop = new Map<number, ElementId[]>();
    for (const [id, h] of Object.entries(hops)) perHop.set(h, [...(perHop.get(h) ?? []), id]);
    const legend: LensLegendEntry[] = [...perHop.entries()].sort((a, b) => a[0] - b[0]).map(([h, ids]) => ({ value: h === 0 ? "Selected" : `${h} hop${h === 1 ? "" : "s"}`, color: h === 0 ? "#1376d4" : LENS_PALETTE[Math.min(h, 4)]!, count: ids.length, ids }));
    const reached = Object.keys(hops).length - roots.length;
    const dir = lens.direction === "both" ? "connected to" : lens.direction === "out" ? "downstream of" : "upstream of";
    return { lens, visible, colors: {}, hops, legend, summary: `${reached} card${reached === 1 ? "" : "s"} ${dir} the selection within ${lens.depth} hop${lens.depth === 1 ? "" : "s"}` };
  }
  if (lens.type === "query") {
    const hits = new Set(lens.entityIds);
    const visible = new Set<ElementId>();
    const colors: Record<ElementId, string> = {};
    const matched: ElementId[] = [];
    let cards = 0;
    for (const el of Object.values(elements)) {
      if (el.type === "card") {
        cards++;
        if (typeof el.meta?.entityId === "string" && hits.has(el.meta.entityId)) { visible.add(el.id); colors[el.id] = "#1376d4"; matched.push(el.id); }
      } else if (el.type !== "connector") visible.add(el.id);
    }
    for (const el of Object.values(elements)) {
      if (el.type !== "connector") continue;
      const from = endpoint(el.from);
      const to = endpoint(el.to);
      if (from && to && visible.has(from) && visible.has(to)) visible.add(el.id);
    }
    const legend: LensLegendEntry[] = matched.length ? [{ value: "matches", color: "#1376d4", count: matched.length, ids: matched }] : [];
    const offBoard = lens.entityIds.length - matched.length;
    return { lens, visible, colors, hops: {}, legend, summary: `${matched.length} of ${cards} cards match “${lens.q}”${offBoard > 0 ? ` · ${offBoard} more in the graph, not on this board` : ""}` };
  }
  if (lens.type === "relation") {
    const kinds = relationKindsOnBoard(elements);
    const hidden = new Set(lens.hidden);
    const colorOf = new Map(kinds.map((k, i) => [k.kind, LENS_PALETTE[i % LENS_PALETTE.length]!]));
    const colors: Record<ElementId, string> = {};
    const visible = new Set<ElementId>();
    const idsByKind = new Map<string, ElementId[]>();
    for (const el of Object.values(elements)) {
      if (el.type !== "connector") { visible.add(el.id); continue; }
      const k = el.label.trim() || UNLABELLED;
      idsByKind.set(k, [...(idsByKind.get(k) ?? []), el.id]);
      if (hidden.has(k)) continue;
      visible.add(el.id);
      colors[el.id] = colorOf.get(k)!;
    }
    const legend: LensLegendEntry[] = kinds.map((k) => ({ value: k.kind, color: colorOf.get(k.kind)!, count: k.count, ids: idsByKind.get(k.kind) ?? [], hidden: hidden.has(k.kind) }));
    const shown = kinds.length - kinds.filter((k) => hidden.has(k.kind)).length;
    return { lens, visible, colors, hops: {}, legend, summary: kinds.length === 0 ? "No connectors on this board" : `${shown} of ${kinds.length} relation type${kinds.length === 1 ? "" : "s"} shown · click a type to toggle it` };
  }
  // attribute lens
  const byValue = new Map<string, ElementId[]>();
  for (const el of Object.values(elements)) {
    if (el.type !== "card") continue;
    const raw = el.attributes?.[lens.key];
    if (raw === undefined || raw === "") continue;
    const v = String(raw);
    byValue.set(v, [...(byValue.get(v) ?? []), el.id]);
  }
  const legend: LensLegendEntry[] = [...byValue.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([value, ids], i) => ({ value, color: LENS_PALETTE[i % LENS_PALETTE.length]!, count: ids.length, ids }));
  const colors: Record<ElementId, string> = {};
  const visible = new Set<ElementId>();
  for (const entry of legend) for (const id of entry.ids) { colors[id] = entry.color; visible.add(id); }
  // connectors between two visible cards stay visible
  for (const el of Object.values(elements)) {
    if (el.type !== "connector") continue;
    const from = endpoint(el.from);
    const to = endpoint(el.to);
    if (from && to && visible.has(from) && visible.has(to)) visible.add(el.id);
  }
  const cards = Object.values(elements).filter((e) => e.type === "card").length;
  return { lens, visible, colors, hops: {}, legend, summary: `${Object.keys(colors).length} of ${cards} cards have “${lens.key}” · ${legend.length} value${legend.length === 1 ? "" : "s"}` };
}
