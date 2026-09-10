"use client";

import type { ExplorerEdge, ExplorerNode } from "@/lib/explorer";
import { ringLabelAngle, type Placed } from "@/lib/explorer-views";

/**
 * One entity and its neighbourhood, drawn in concentric hop rings (§5.68).
 *
 * **SVG, not canvas.** The map view is canvas because a thousand nodes must be, but a focused
 * neighbourhood is bounded — sixty nodes at the very most — and below that ceiling the DOM wins
 * on every axis that matters here: real text that the browser kerns and the reader can select,
 * hover and click without hand-written hit-testing, `<title>` tooltips for free, styling from
 * the same stylesheet as the rest of the app, and a picture an end-to-end test can actually
 * assert against. The old explorer measured its own label widths and drew its own arrowheads;
 * none of that code needs to exist.
 *
 * There is no camera. The viewBox is computed from the layout, so the neighbourhood is always
 * framed, at any window size, with nothing to pan and nothing to lose off-screen. "Fit" was a
 * button because the old view could be lost; this one cannot be.
 */

const R_MIN = 10;
const R_MAX = 26;
/** Names longer than this are cut; the full name is in the tooltip and the panel. */
const LABEL_CHARS = 20;

export function FocusView({
  placed, byId, edges, subject, onPick, highlight, highlightKind, omitted, depth,
}: {
  placed: Placed[];
  byId: Map<string, ExplorerNode>;
  edges: ExplorerEdge[];
  subject: string;
  onPick: (id: string) => void;
  /** Nodes to call out — a blast radius or a traced route. */
  highlight?: Set<string>;
  highlightKind?: "impact" | "path";
  /** Neighbours that exist but did not fit on their ring. */
  omitted: number;
  depth: number;
}) {
  const at = new Map(placed.map((p) => [p.id, p]));
  const maxDegree = Math.max(1, ...placed.map((p) => byId.get(p.id)?.degree ?? 0));
  const radiusOf = (id: string) => {
    const d = byId.get(id)?.degree ?? 0;
    return R_MIN + (R_MAX - R_MIN) * Math.sqrt(d / maxDegree);
  };

  // Ring guides: one faint circle per hop, so "two steps away" is a thing you can see. The
  // caption goes in the ring's widest gap, because "the top" is occupied whenever the ring's
  // count divides four — which is exactly the common case.
  const rings = new Map<number, { r: number; angles: number[] }>();
  for (const p of placed) {
    if (p.ring === 0) continue;
    const entry = rings.get(p.ring);
    if (entry) entry.angles.push(p.angle);
    else rings.set(p.ring, { r: Math.hypot(p.x, p.y), angles: [p.angle] });
  }

  const outer = Math.max(120, ...[...rings.values()].map((v) => v.r));
  const pad = 74;
  const span = (outer + pad) * 2;
  const viewBox = `${-outer - pad} ${-outer - pad} ${span} ${span}`;

  const shown = edges.filter((e) => at.has(e.from) && at.has(e.to) && e.from !== e.to);

  return (
    <div className="focus-view" data-focus-view data-focus-subject={subject}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Neighbourhood">
        <defs>
          <marker id="focus-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
          <marker id="focus-arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1376d4" />
          </marker>
        </defs>

        {[...rings.entries()].sort((a, b) => a[0] - b[0]).map(([ring, { r, angles }]) => {
          const a = ringLabelAngle(angles);
          return (
            <g key={ring} className="focus-ring">
              <circle cx={0} cy={0} r={r} />
              <text x={Math.cos(a) * r} y={Math.sin(a) * r} dy={4}>{ring === 1 ? "1 hop" : `${ring} hops`}</text>
            </g>
          );
        })}

        {shown.map((e) => {
          const a = at.get(e.from)!, b = at.get(e.to)!;
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          // Stop short of both discs so the arrowhead lands on the edge of the target, not under it.
          const ax = a.x + (dx / len) * (radiusOf(e.from) + 3);
          const ay = a.y + (dy / len) * (radiusOf(e.from) + 3);
          const bx = b.x - (dx / len) * (radiusOf(e.to) + 9);
          const by = b.y - (dy / len) * (radiusOf(e.to) + 9);
          const lit = e.from === subject || e.to === subject;
          return (
            <g key={e.id} className={`focus-edge ${lit ? "lit" : ""}`}>
              <line x1={ax} y1={ay} x2={bx} y2={by} markerEnd={`url(#${lit ? "focus-arrow-lit" : "focus-arrow"})`} />
              <title>{`${byId.get(e.from)?.name ?? "?"} ${e.kind} ${byId.get(e.to)?.name ?? "?"}`}</title>
            </g>
          );
        })}

        {placed.map((p) => {
          const meta = byId.get(p.id);
          if (!meta) return null;
          const r = radiusOf(p.id);
          const isSubject = p.id === subject;
          const lit = highlight?.has(p.id) ?? false;
          const name = meta.name || "(unnamed)";
          return (
            <g
              key={p.id}
              className={`focus-node ${isSubject ? "subject" : ""} ${lit ? `lit ${highlightKind ?? ""}` : ""}`}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => onPick(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onPick(p.id); } }}
              data-focus-node={p.id}
              data-ring={p.ring}
            >
              <title>{`${name} — ${meta.kind || "Untyped"} · ${meta.degree} relation${meta.degree === 1 ? "" : "s"}`}</title>
              <circle r={r} fill={meta.color} />
              {/* The subject wears a halo at r+9, so its label has to clear that, not the disc. */}
              <text y={r + (isSubject ? 26 : 15)}>{name.length > LABEL_CHARS ? `${name.slice(0, LABEL_CHARS - 1)}…` : name}</text>
              {isSubject && <circle className="focus-halo" r={r + 9} />}
            </g>
          );
        })}
      </svg>

      <p className="focus-caption" data-focus-caption>
        {placed.length === 1
          ? "Nothing is connected to this yet."
          : `${placed.length - 1} within ${depth} hop${depth === 1 ? "" : "s"}`}
        {omitted > 0 && <b> · {omitted} more did not fit; the list on the left has all of them</b>}
      </p>
    </div>
  );
}
