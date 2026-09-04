"use client";

import type { ConnectorElement, Point } from "./document";
import { isBoxElement } from "./document";
import { boxEdgePoint, connectorPath } from "./geometry";
import { useCanvas } from "./store";

const ARROW = 12;

function arrowHead(tip: Point, dir: Point, size = ARROW): string {
  const angle = Math.atan2(dir.y, dir.x);
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  return `${tip.x},${tip.y} ${tip.x + size * Math.cos(a1)},${tip.y + size * Math.sin(a1)} ${tip.x + size * Math.cos(a2)},${tip.y + size * Math.sin(a2)}`;
}

/** SVG paths inside the world transform plus HTML pill labels (LeanFlow relation labels). */
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
  const paths = connectors.map((c) => ({ c, p: connectorPath(c, elements) }));

  return (
    <>
      <svg className="absolute left-0 top-0" style={{ overflow: "visible", width: 1, height: 1, pointerEvents: "none", zIndex: 1_000_000 }}>
        {paths.map(({ c, p }) => {
          if (!p) return null;
          const selected = selection.includes(c.id);
          const hovered = hoverId === c.id;
          const stroke = selected ? "#1376d4" : c.stroke;
          return (
            <g key={c.id} data-element-id={c.id} data-connectable="false" style={{ pointerEvents: "auto", cursor: "pointer" }}>
              <path d={p.d} fill="none" stroke="transparent" strokeWidth={hitWidth} />
              {(selected || hovered) && <path d={p.d} fill="none" stroke="#1376d4" strokeOpacity={0.16} strokeWidth={8} />}
              <path d={p.d} fill="none" stroke={stroke} strokeWidth={2.5} strokeDasharray={c.style === "dashed" ? "8 6" : undefined} strokeLinecap="round" strokeLinejoin="round" />
              {c.arrowEnd && <polygon points={arrowHead(p.to, p.endDir)} fill={stroke} />}
              {c.arrowStart && <polygon points={arrowHead(p.from, { x: -p.startDir.x, y: -p.startDir.y })} fill={stroke} />}
            </g>
          );
        })}
        {pendingPath && (
          <g>
            <line x1={pendingPath.from.x} y1={pendingPath.from.y} x2={pendingPath.to.x} y2={pendingPath.to.y} stroke="#1376d4" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
            <polygon points={arrowHead(pendingPath.to, { x: pendingPath.to.x - pendingPath.from.x, y: pendingPath.to.y - pendingPath.from.y })} fill="#1376d4" />
          </g>
        )}
      </svg>
      {paths.map(({ c, p }) =>
        p && c.label ? (
          <div key={`${c.id}-label`} data-element-id={c.id} data-connectable="false" className={selection.includes(c.id) ? "board-connector-label selected" : "board-connector-label"} style={{ left: p.mid.x, top: p.mid.y, zIndex: 1_000_001 }} title={c.label}>
            {c.label}
          </div>
        ) : null,
      )}
    </>
  );
}
