"use client";

import { useMemo, useRef, useState } from "react";
import { Maximize2, RotateCcw } from "lucide-react";
import type { MetaModel } from "@/lib/metamodel";
import { typeGraph, typeGraphSummary, type TypeEdge } from "@/lib/metamodel-graph";
import { initialLayout, layoutBounds, separateBoxes, tick, type ForceNode } from "@/lib/force";

/**
 * The meta-model drawn as a diagram of *types* — the abstraction, not the instances.
 *
 * SVG rather than canvas (unlike the explorer): a schema has tens of types, not hundreds, and
 * every edge carries a readable label, which SVG gives for free. Positions come from the same
 * seeded force layout as the explorer, so the shape is stable across reloads and re-renders when
 * the model changes.
 */

const BOX_W = 128;
const BOX_H = 46;
const SETTLE_TICKS = 320;
/** Ideal gap between connected types. Generous, because boxes and fanned arcs need the room. */
const IDEAL_DISTANCE = 330;
/** Gap between the arcs of relation types that join the same pair of types. */
const BUNDLE_SPREAD = 52;

const norm = (v: string) => v.trim().toLowerCase();

interface Slot {
  index: number;
  total: number;
  /** The edge runs against the bundle's canonical direction, so its offset must be mirrored. */
  flip: boolean;
}

/** What the tree has selected, so the diagram can highlight the same thing. */
export type DiagramSelection = { kind: "node" | "relation"; name: string } | null;

export function MetaModelDiagram({ model, selected, onSelect }: {
  model: MetaModel;
  selected: DiagramSelection;
  onSelect: (selection: { kind: "node" | "relation"; name: string }) => void;
}) {
  const graph = useMemo(() => typeGraph(model), [model]);
  const summary = useMemo(() => typeGraphSummary(graph), [graph]);

  /**
   * Several relation types can join the same pair of types. Drawn as plain lines they would land
   * on top of one another and the labels would pile up, so every edge gets a slot in its bundle
   * and is drawn as an arc offset from the centre line.
   */
  const slots = useMemo(() => {
    const groups = new Map<string, TypeEdge[]>();
    for (const e of graph.edges) {
      const key = e.selfLoop ? `self:${norm(e.from)}` : [norm(e.from), norm(e.to)].sort().join("|");
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    const out: Record<string, Slot> = {};
    for (const list of groups.values()) {
      // Offsets are measured from one fixed end of the pair, so an A→B and a B→A edge in the
      // same bundle land on different arcs instead of colliding.
      const first = [norm(list[0]!.from), norm(list[0]!.to)].sort()[0];
      list.forEach((e, index) => {
        out[e.id] = { index, total: list.length, flip: !e.selfLoop && norm(e.from) !== first };
      });
    }
    return out;
  }, [graph]);

  /**
   * Lay the types out whenever the *shape* changes — adding a type or a rule should re-arrange,
   * but renaming or editing a description should not throw the diagram around. The signature
   * captures exactly the structure.
   */
  const signature = useMemo(
    () => `${graph.nodes.map((n) => n.name).sort().join(",")}|${graph.edges.map((e) => e.id).sort().join(",")}`,
    [graph],
  );

  /** Bumped by "Relayout" to recompute from a different seed. */
  const [seed, setSeed] = useState(7);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  /**
   * Held apart from `graph` and keyed on the signature so that editing a description or colour
   * does not re-run the layout and throw the diagram around; only a structural change does.
   */
  const layoutInput = useMemo(() => {
    // One spring per *pair*, not per relation type: otherwise six relation types between the
    // same two types pull six times as hard and the pair with the most arcs to draw ends up
    // with the least room to draw them in.
    const pairs = new Map<string, { from: string; to: string }>();
    for (const e of graph.edges) {
      if (e.selfLoop) continue;
      pairs.set([norm(e.from), norm(e.to)].sort().join("|"), { from: e.from, to: e.to });
    }
    return { ids: graph.nodes.map((n) => n.name), edges: [...pairs.values()] };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on the structure only
  }, [signature]);

  const positions = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {};
    if (layoutInput.ids.length === 0) return out;
    const nodes: ForceNode[] = initialLayout(layoutInput.ids, seed);
    // types need more room than entity dots, so a longer ideal edge
    for (let i = 0; i < SETTLE_TICKS; i++) tick(nodes, layoutInput.edges, 1 - i / SETTLE_TICKS, { distance: IDEAL_DISTANCE, repulsion: 1.3 });
    // the simulation treats types as points; these are boxes with fanned-out arcs between them,
    // so push any pair that still overlaps apart
    separateBoxes(nodes, BOX_W + 96, BOX_H + 96);
    for (const n of nodes) out[n.id] = { x: n.x, y: n.y };
    return out;
  }, [layoutInput, seed]);

  const fit = useMemo(() => {
    const list = Object.entries(positions).map(([id, p]) => ({ id, x: p.x, y: p.y, vx: 0, vy: 0 }));
    if (list.length === 0) return { x: -400, y: -300, w: 800, h: 600 };
    const b = layoutBounds(list);
    const pad = 150;
    return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  }, [positions]);

  const viewBox = `${fit.x - view.x} ${fit.y - view.y} ${Math.max(1, fit.w / view.zoom)} ${Math.max(1, fit.h / view.zoom)}`;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => ({ ...v, zoom: Math.min(4, Math.max(0.25, v.zoom * Math.exp(-e.deltaY * 0.0012))) }));
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-type-box]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = panRef.current;
    if (!p || !wrapRef.current) return;
    const scale = fit.w / view.zoom / wrapRef.current.clientWidth;
    setView((v) => ({ ...v, x: p.vx + (e.clientX - p.x) * scale, y: p.vy + (e.clientY - p.y) * scale }));
  };

  /**
   * Selecting focuses a neighbourhood rather than a single shape: a node type lights its own
   * arcs, a relation type lights every pair it joins. Without this, selecting a relation type in
   * the tree — which names no box — dimmed the whole diagram.
   */
  const highlit = useMemo(() => {
    if (!selected) return null;
    const nodes = new Set<string>();
    const edges = new Set<string>();
    for (const e of graph.edges) {
      const hit = selected.kind === "relation"
        ? norm(e.relation) === norm(selected.name)
        : norm(e.from) === norm(selected.name) || norm(e.to) === norm(selected.name);
      if (!hit) continue;
      edges.add(e.id);
      nodes.add(norm(e.from));
      nodes.add(norm(e.to));
    }
    if (selected.kind === "node") nodes.add(norm(selected.name));
    return { nodes, edges };
  }, [graph, selected]);

  const at = (name: string) => positions[name] ?? { x: 0, y: 0 };

  return (
    <div className="meta-diagram" ref={wrapRef} data-meta-diagram>
      <div className="meta-diagram-bar">
        <span className="meta-diagram-legend">
          <i className="rule" /> declared rule
          <i className="observed" /> observed in data
          {summary.violations > 0 && <><i className="violation" /> breaks a rule</>}
        </span>
        <span className="meta-diagram-counts">{summary.nodes} types · {summary.edges} connections</span>
        <button type="button" className="ghost-button" onClick={() => setView({ x: 0, y: 0, zoom: 1 })} title="Fit the diagram"><Maximize2 size={14} /> Fit</button>
        <button type="button" className="ghost-button" onClick={() => setSeed((v) => v + 1)} title="Re-run the layout"><RotateCcw size={14} /> Relayout</button>
      </div>

      <svg
        className="meta-diagram-svg"
        viewBox={viewBox}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { panRef.current = null; }}
        onPointerLeave={() => { panRef.current = null; }}
        role="img"
        aria-label="Meta-model diagram"
      >
        <defs>
          {(["rule", "observed", "violation"] as const).map((kind) => (
            <marker key={kind} id={`arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className={`meta-arrow-head ${kind}`} />
            </marker>
          ))}
        </defs>

        {graph.edges.map((e) => (
          <EdgeShape
            key={e.id}
            edge={e}
            from={at(e.from)}
            to={at(e.to)}
            slot={slots[e.id] ?? { index: 0, total: 1, flip: false }}
            dimmed={!!highlit && !highlit.edges.has(e.id)}
            onSelect={() => onSelect({ kind: "relation", name: e.relation })}
          />
        ))}

        {graph.nodes.map((n) => {
          const p = at(n.name);
          const isSelected = selected?.kind === "node" && norm(selected.name) === norm(n.name);
          const dimmed = !!highlit && !highlit.nodes.has(norm(n.name));
          return (
            <g
              key={n.name}
              data-type-box
              className={`meta-type-box ${isSelected ? "selected" : ""} ${dimmed ? "dimmed" : ""} ${n.presence}`}
              transform={`translate(${p.x - BOX_W / 2} ${p.y - BOX_H / 2})`}
              onClick={() => onSelect({ kind: "node", name: n.name })}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") onSelect({ kind: "node", name: n.name }); }}
              aria-label={`${n.name}, ${n.instances} instances`}
            >
              <rect width={BOX_W} height={BOX_H} rx={9} />
              <rect width={5} height={BOX_H} rx={2.5} className="meta-type-swatch" style={{ fill: n.color }} />
              <text x={BOX_W / 2} y={19} className="meta-type-name">{n.name.length > 17 ? n.name.slice(0, 16) + "…" : n.name}</text>
              <text x={BOX_W / 2} y={34} className="meta-type-meta">{n.instances} · {n.fieldCount} field{n.fieldCount === 1 ? "" : "s"}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Where a ray leaving a box centre towards (tx, ty) crosses the box border, plus a small gap. */
function borderPoint(cx: number, cy: number, tx: number, ty: number, padding = 7) {
  const dx = tx - cx, dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const hw = BOX_W / 2 + padding, hh = BOX_H / 2 + padding;
  const t = Math.min(
    Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity,
  );
  return { x: cx + ux * t, y: cy + uy * t };
}

/** An arc between two type boxes, or a loop when a relation type joins a type to itself. */
function EdgeShape({ edge, from, to, slot, dimmed, onSelect }: {
  edge: TypeEdge;
  from: { x: number; y: number };
  to: { x: number; y: number };
  slot: Slot;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const cls = `meta-edge ${edge.origin} ${dimmed ? "dimmed" : ""}`;
  const label = `${edge.relation}${edge.count > 0 ? ` (${edge.count})` : ""}`;

  if (edge.selfLoop) {
    // Loops stack above the box, each one wider and taller than the last so their labels clear.
    const half = 30 + slot.index * 18;
    const rise = 66 + slot.index * 40;
    const x = from.x;
    const y = from.y - BOX_H / 2 - 2;
    const d = `M ${x - half} ${y} C ${x - half - 24} ${y - rise}, ${x + half + 24} ${y - rise}, ${x + half} ${y}`;
    return (
      <g className={cls} onClick={onSelect} data-type-edge>
        <path className="meta-edge-hit" d={d} />
        <path d={d} markerEnd={`url(#arrow-${edge.origin})`} />
        <text x={x} y={y - rise * 0.75 - 6} className="meta-edge-label">{label}</text>
      </g>
    );
  }

  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // normal to the centre line, taken in the bundle's canonical direction so both directions of
  // travel between the same pair get distinct arcs
  const nx = (-dy / len) * (slot.flip ? -1 : 1);
  const ny = (dx / len) * (slot.flip ? -1 : 1);
  const offset = (slot.index - (slot.total - 1) / 2) * BUNDLE_SPREAD;
  // A quadratic's peak sits halfway to its control point, so double the offset to place the arc.
  const cx = mx + nx * offset * 2, cy = my + ny * offset * 2;
  const p1 = borderPoint(from.x, from.y, cx, cy);
  const p2 = borderPoint(to.x, to.y, cx, cy);
  // Slide successive labels along their arcs as well as across them, so a bundle of six
  // relation types between the same pair does not stack six captions in one place.
  const t = slot.total > 1 ? 0.5 + ((slot.index % 3) - 1) * 0.15 : 0.5;
  const lx = (1 - t) * (1 - t) * p1.x + 2 * t * (1 - t) * cx + t * t * p2.x;
  const ly = (1 - t) * (1 - t) * p1.y + 2 * t * (1 - t) * cy + t * t * p2.y;
  const d = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
  return (
    <g className={cls} onClick={onSelect} data-type-edge>
      <path className="meta-edge-hit" d={d} />
      <path d={d} markerEnd={`url(#arrow-${edge.origin})`} />
      <text x={lx} y={ly - 5} className="meta-edge-label">{label}</text>
    </g>
  );
}
