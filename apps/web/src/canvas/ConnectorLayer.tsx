"use client";

import type { ConnectorElement, Point } from "./document";
import { isBoxElement } from "./document";
import { boxEdgePoint, connectorGeometry } from "./geometry";
import { useCanvas } from "./store";

const ARROW = 12;

function arrowHead(tip: Point, from: Point, size = ARROW): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  return `${tip.x},${tip.y} ${tip.x + size * Math.cos(a1)},${tip.y + size * Math.sin(a1)} ${tip.x + size * Math.cos(a2)},${tip.y + size * Math.sin(a2)}`;
}

function shorten(p: Point, toward: Point, by: number): Point {
  const d = Math.hypot(toward.x - p.x, toward.y - p.y);
  if (d === 0) return p;
  const t = Math.max(0, (d - by) / d);
  return { x: toward.x + (p.x - toward.x) * t, y: toward.y + (p.y - toward.y) * t };
}

/** SVG lines inside the world transform plus HTML pill labels (LeanFlow relation labels). */
export function ConnectorLayer() {
  const elements = useCanvas((s) => s.elements);
  const selection = useCanvas((s) => s.selection);
  const hoverId = useCanvas((s) => s.hoverId);
  const pending = useCanvas((s) => s.pendingConnector);
  const zoom = useCanvas((s) => s.camera.zoom);

  const connectors = Object.values(elements).filter((e): e is ConnectorElement => e.type === "connector").sort((a, b) => a.z - b.z);

  let pendingPath: { from: Point; to: Point } | null = null;
  if (pending) {
    const fromEl = elements[pending.from];
    if (fromEl && isBoxElement(fromEl)) {
      const target = hoverId && elements[hoverId] && isBoxElement(elements[hoverId]!) ? elements[hoverId]! : null;
      const toPoint = target ? boxEdgePoint(target, { x: fromEl.x + fromEl.w / 2, y: fromEl.y + fromEl.h / 2 }) : pending.to;
      pendingPath = { from: boxEdgePoint(fromEl, toPoint), to: toPoint };
    }
  }

  const hitWidth = Math.max(12, 12 / zoom);
  const geometries = connectors.map((c) => ({ c, g: connectorGeometry(c, elements) }));

  return (
    <>
      <svg className="absolute left-0 top-0" style={{ overflow: "visible", width: 1, height: 1, pointerEvents: "none", zIndex: 1_000_000 }}>
        {geometries.map(({ c, g }) => {
          if (!g) return null;
          const selected = selection.includes(c.id);
          const hovered = hoverId === c.id;
          const stroke = selected ? "#1376d4" : c.stroke;
          const start = c.arrowStart ? shorten(g.from, g.to, ARROW * 0.8) : g.from;
          const end = c.arrowEnd ? shorten(g.to, g.from, ARROW * 0.8) : g.to;
          return (
            <g key={c.id} data-element-id={c.id} data-connectable="false" style={{ pointerEvents: "auto", cursor: "pointer" }}>
              <line x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} stroke="transparent" strokeWidth={hitWidth} />
              {(selected || hovered) && <line x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} stroke="#1376d4" strokeOpacity={0.16} strokeWidth={8} />}
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={stroke} strokeWidth={2.5} strokeDasharray={c.style === "dashed" ? "8 6" : undefined} strokeLinecap="round" />
              {c.arrowEnd && <polygon points={arrowHead(g.to, g.from)} fill={stroke} />}
              {c.arrowStart && <polygon points={arrowHead(g.from, g.to)} fill={stroke} />}
            </g>
          );
        })}
        {pendingPath && (
          <g>
            <line x1={pendingPath.from.x} y1={pendingPath.from.y} x2={pendingPath.to.x} y2={pendingPath.to.y} stroke="#1376d4" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
            <polygon points={arrowHead(pendingPath.to, pendingPath.from)} fill="#1376d4" />
          </g>
        )}
      </svg>
      {geometries.map(({ c, g }) =>
        g && c.label ? (
          <div key={`${c.id}-label`} data-element-id={c.id} data-connectable="false" className={selection.includes(c.id) ? "board-connector-label selected" : "board-connector-label"} style={{ left: g.mid.x, top: g.mid.y, zIndex: 1_000_001 }} title={c.label}>
            {c.label}
          </div>
        ) : null,
      )}
    </>
  );
}
