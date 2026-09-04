"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { nanoid } from "nanoid";
import { ChevronDown, ChevronRight, Database, Plus, Search } from "lucide-react";
import { cardColorForKind, type CanvasElement } from "./document";
import { useDraggablePanel } from "./hooks/useDraggablePanel";
import { useCanvas, useCanvasStore } from "./store";
import type { EntitySummary, GraphSnapshot } from "@/lib/graph-types";
import { isEntityId } from "@/lib/graph-types";

/**
 * "Graph inventory" panel (LeanFlow "Factsheet hierarchy"): every entity in the workspace
 * graph grouped by kind; place one — or a whole kind — on this board as linked cards.
 */
export function InventoryPanel({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const store = useCanvasStore();
  const workspaceId = useCanvas((s) => s.workspaceId);
  const collapsed = useCanvas((s) => !s.panels.inventory);
  const saveState = useCanvas((s) => s.saveState);
  const elements = useCanvas((s) => s.elements);
  const onBoard = useMemo(() => {
    const ids = new Set<string>();
    for (const el of Object.values(elements)) if (el.type === "card" && isEntityId(el.meta?.entityId)) ids.add(el.meta.entityId);
    return ids;
  }, [elements]);
  const { pos, onPointerDown, panelRef } = useDraggablePanel(rootRef, { x: 74, y: 76 });
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Load on mount and after every successful save (the board may have added entities).
  useEffect(() => {
    if (saveState !== "saved") return;
    let cancelled = false;
    fetch(`/api/workspaces/${workspaceId}/graph`)
      .then((r) => (r.ok ? (r.json() as Promise<GraphSnapshot>) : null))
      .then((data) => !cancelled && data && setSnapshot(data))
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspaceId, saveState]);

  const groups = useMemo(() => {
    if (!snapshot) return [];
    const q = query.trim().toLowerCase();
    const map = new Map<string, EntitySummary[]>();
    for (const e of snapshot.entities) {
      if (q && !`${e.kind} ${e.name} ${e.description}`.toLowerCase().includes(q)) continue;
      map.set(e.kind, [...(map.get(e.kind) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [snapshot, query]);

  const place = (list: EntitySummary[]) => {
    const s = store.getState();
    const centre = { x: (s.viewport.w / 2 - s.camera.x) / s.camera.zoom, y: (s.viewport.h / 2 - s.camera.y) / s.camera.zoom };
    const perRow = Math.max(1, Math.ceil(Math.sqrt(list.length)));
    const w = 236, h = 124, gap = 24;
    const totalW = perRow * w + (perRow - 1) * gap;
    const rows = Math.ceil(list.length / perRow);
    const totalH = rows * h + (rows - 1) * gap;
    const els: CanvasElement[] = list.map((e, i) => ({
      id: nanoid(10),
      type: "card",
      x: centre.x - totalW / 2 + (i % perRow) * (w + gap),
      y: centre.y - totalH / 2 + Math.floor(i / perRow) * (h + gap),
      w, h,
      kind: e.kind,
      color: cardColorForKind(e.kind),
      title: e.name,
      description: e.description,
      z: 0,
      meta: { entityId: e.id },
    }));
    s.addElements(els, { select: true });
  };

  const total = snapshot?.entities.length ?? 0;
  return (
    <section
      ref={(el) => { panelRef.current = el; }}
      className={collapsed ? "floating-panel inventory-panel collapsed" : "floating-panel inventory-panel"}
      aria-label="Graph inventory"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? 76 }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="panel-title" onPointerDown={onPointerDown} title="Drag to move">
        <Database size={18} />
        Graph inventory
        <div className="panel-title-actions">
          <button type="button" onClick={() => store.getState().togglePanel("inventory")}>{collapsed ? "Expand" : "Collapse"}</button>
        </div>
      </div>
      {collapsed ? (
        <div className="inspector-summary">
          <strong>{total} entities</strong>
          <small>{onBoard.size} on this board</small>
        </div>
      ) : (
        <>
          <label className="inventory-search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the graph" onKeyDown={(e) => e.stopPropagation()} />
          </label>
          <p className="inventory-meta"><strong>{total}</strong> entities indexed · {onBoard.size} on this board · click <Plus size={11} /> to place</p>
          <div className="inventory-groups">
            {groups.map(([kind, list]) => {
              const isOpen = open[kind] ?? (groups.length <= 3 || !!query.trim());
              const placed = list.filter((e) => onBoard.has(e.id)).length;
              return (
                <div key={kind} className="inventory-group">
                  <div className="inventory-group-header">
                    <button type="button" className="inventory-toggle" onClick={() => setOpen((o) => ({ ...o, [kind]: !isOpen }))}>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <i style={{ background: cardColorForKind(kind) }} />
                      <span>{kind || "Untyped"}</span>
                      <small>{placed}/{list.length}</small>
                    </button>
                    <button type="button" className="inventory-place" title={`Place all ${kind} not yet on this board`} onClick={() => place(list.filter((e) => !onBoard.has(e.id)))} disabled={placed === list.length}><Plus size={14} /></button>
                  </div>
                  {isOpen && (
                    <ul>
                      {list.map((e) => (
                        <li key={e.id} className={onBoard.has(e.id) ? "on-board" : ""}>
                          <span title={e.description || e.name}>{e.name || "(unnamed)"}</span>
                          {onBoard.has(e.id) ? (
                            <button type="button" title="Focus on this board" onClick={() => { const s = store.getState(); const el = Object.values(s.elements).find((x) => x.type === "card" && x.meta?.entityId === e.id); if (el) s.focusElement(el.id); }}>●</button>
                          ) : (
                            <button type="button" title="Place on this board" onClick={() => place([e])}><Plus size={13} /></button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {snapshot && groups.length === 0 && <div className="suggestion-empty">{total === 0 ? "The graph is empty. Add cards to any board or import data on the Graph page." : "No entity matches."}</div>}
            {!snapshot && <div className="suggestion-empty">Loading graph…</div>}
          </div>
        </>
      )}
    </section>
  );
}
