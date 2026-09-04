"use client";

import { memo, useMemo } from "react";
import type { CanvasElement, ConnectorElement, Point } from "./document";
import { isBoxElement } from "./document";
import { boxEdgePoint, connectorPath, type ConnectorPath } from "./geometry";
import { useCanvas } from "./store";

const ARROW = 12;

function arrowHead(tip: Point, dir: Point, size = ARROW): string {
  const angle = Math.atan2(dir.y, dir.x);
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  return `${tip.x},${tip.y} ${tip.x + size * Math.cos(a1)},${tip.y + size * Math.sin(a1)} ${tip.x + size * Math.cos(a2)},${tip.y + size * Math.sin(a2)}`;
}

function endpointId(end: ConnectorElement["from"]): string | null {
  return "elementId" in end ? end.elementId : null;
}

/**
 * SVG paths inside the world transform plus HTML pill labels (LeanFlow relation labels).
 *
 * The layer itself only knows the *list* of connector ids (a stable string key); each
 * connector subscribes to its own element and endpoints, so dragging one card re-renders the
 * handful of connectors touching it rather than all of them.
 */
export const ConnectorLayer = memo(function ConnectorLayer() {
  const idsKey = useCanvas((s) => {
    const connectors: Array<{ id: string; z: number }> = [];
    for (const el of Object.values(s.elements)) if (el.type === "connector") connectors.push({ id: el.id, z: el.z });
    connectors.sort((a, b) => a.z - b.z);
    return connectors.map((c) => c.id).join("\n");
  });
  const ids = useMemo(() => (idsKey ? idsKey.split("\n") : []), [idsKey]);
  const views = useMemo(() => ids.map((id) => <ConnectorView key={id} id={id} />), [ids]);
  const labels = useMemo(() => ids.map((id) => <ConnectorLabel key={id} id={id} />), [ids]);

  return (
    <>
      <svg className="absolute left-0 top-0" style={{ overflow: "visible", width: 1, height: 1, pointerEvents: "none", zIndex: 1_000_000 }}>
        {views}
        <PendingConnector />
      </svg>
      {labels}
    </>
  );
});

/** Dashed preview while the user drags a new connector out of a card. */
function PendingConnector() {
  const pending = useCanvas((s) => s.pendingConnector);
  const fromEl = useCanvas((s) => (s.pendingConnector ? s.elements[s.pendingConnector.from] : undefined));
  const hoverEl = useCanvas((s) => (s.pendingConnector && s.hoverId ? s.elements[s.hoverId] : undefined));
  if (!pending || !fromEl || !isBoxElement(fromEl)) return null;
  const target = hoverEl && isBoxElement(hoverEl) ? hoverEl : null;
  const toPoint = target ? boxEdgePoint(target, { x: fromEl.x + fromEl.w / 2, y: fromEl.y + fromEl.h / 2 }) : pending.to;
  const from = boxEdgePoint(fromEl, toPoint);
  return (
    <g>
      <line x1={from.x} y1={from.y} x2={toPoint.x} y2={toPoint.y} stroke="#1376d4" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
      <polygon points={arrowHead(toPoint, { x: toPoint.x - from.x, y: toPoint.y - from.y })} fill="#1376d4" />
    </g>
  );
}

/** Subscribe to a connector and its endpoint elements; the path is recomputed only when one of them changes identity. */
function useConnectorPath(id: string): { c: ConnectorElement | undefined; p: ConnectorPath | null } {
  const c = useCanvas((s) => s.elements[id]) as ConnectorElement | undefined;
  const fromId = c ? endpointId(c.from) : null;
  const toId = c ? endpointId(c.to) : null;
  const from = useCanvas((s) => (fromId ? s.elements[fromId] : undefined));
  const to = useCanvas((s) => (toId ? s.elements[toId] : undefined));
  const p = useMemo(() => {
    if (!c || c.type !== "connector") return null;
    const scope: Record<string, CanvasElement> = {};
    if (fromId && from) scope[fromId] = from;
    if (toId && to) scope[toId] = to;
    return connectorPath(c, scope);
  }, [c, from, to, fromId, toId]);
  return { c: c && c.type === "connector" ? c : undefined, p };
}

const HIT_WIDTH = 14;

const ConnectorView = memo(function ConnectorView({ id }: { id: string }) {
  const { c, p } = useConnectorPath(id);
  const selected = useCanvas((s) => s.selection.includes(id));
  const hovered = useCanvas((s) => s.hoverId === id);
  const dimmed = useCanvas((s) => s.lensResult !== null && !s.lensResult.visible.has(id));
  if (!c || !p) return null;
  const stroke = selected ? "#1376d4" : c.stroke;
  return (
    <g data-element-id={c.id} data-connectable="false" style={{ pointerEvents: "auto", cursor: "pointer", opacity: dimmed ? 0.12 : 1 }}>
      <path d={p.d} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} />
      {(selected || hovered) && <path d={p.d} fill="none" stroke="#1376d4" strokeOpacity={0.16} strokeWidth={8} />}
      <path d={p.d} fill="none" stroke={stroke} strokeWidth={2.5} strokeDasharray={c.style === "dashed" ? "8 6" : undefined} strokeLinecap="round" strokeLinejoin="round" />
      {c.arrowEnd && <polygon points={arrowHead(p.to, p.endDir)} fill={stroke} />}
      {c.arrowStart && <polygon points={arrowHead(p.from, { x: -p.startDir.x, y: -p.startDir.y })} fill={stroke} />}
    </g>
  );
});

const ConnectorLabel = memo(function ConnectorLabel({ id }: { id: string }) {
  const { c, p } = useConnectorPath(id);
  const selected = useCanvas((s) => s.selection.includes(id));
  const dimmed = useCanvas((s) => s.lensResult !== null && !s.lensResult.visible.has(id));
  if (!c || !p || !c.label) return null;
  return (
    <div data-element-id={id} data-connectable="false" className={selected ? "board-connector-label selected" : "board-connector-label"} style={{ left: p.mid.x, top: p.mid.y, zIndex: 1_000_001, opacity: dimmed ? 0.12 : 1 }} title={c.label}>
      {c.label}
    </div>
  );
});
