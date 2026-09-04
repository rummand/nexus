"use client";

import { useMemo, useState } from "react";
import { cardColorForKind } from "./document";
import { attributeKeysOnBoard, NO_LENS } from "./lens";
import { useCanvas, useCanvasStore } from "./store";
import { useGraphActions } from "./hooks/useGraphActions";
import { isEntityId } from "@/lib/graph-types";

/** Viewpoint tab (LeanFlow "Graph viewpoint"): expand, relations, layout, kind lens. */
export function ViewpointPanel() {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const selection = useCanvas((s) => s.selection);
  const hiddenKinds = useCanvas((s) => s.hiddenKinds);
  const saved = useCanvas((s) => s.viewpoints);
  const lens = useCanvas((s) => s.lens);
  const lensResult = useCanvas((s) => s.lensResult);
  const attributeKeys = useMemo(() => attributeKeysOnBoard(elements), [elements]);
  const [viewName, setViewName] = useState("");
  const { busy, showRelations, expandSelection, arrangeByKind, distributeSelection } = useGraphActions();
  const [depth, setDepthState] = useState(1);
  const [direction, setDirectionState] = useState<"both" | "out" | "in">("both");
  const setDepth = (d: number) => { setDepthState(d); if (lens.type === "impact") store.getState().setLens({ ...lens, depth: d }); };
  const setDirection = (d: "both" | "out" | "in") => { setDirectionState(d); if (lens.type === "impact") store.getState().setLens({ ...lens, direction: d }); };
  const [status, setStatus] = useState<string | null>(null);

  const stats = useMemo(() => {
    const cards = Object.values(elements).filter((e) => e.type === "card");
    const linked = cards.filter((c) => isEntityId(c.meta?.entityId)).length;
    const kinds = new Map<string, number>();
    for (const c of cards) if (c.type === "card") kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    const connectors = Object.values(elements).filter((e) => e.type === "connector").length;
    const relLinked = Object.values(elements).filter((e) => e.type === "connector" && typeof e.meta?.relationId === "string").length;
    return { cards: cards.length, linked, kinds: [...kinds.entries()].sort((a, b) => b[1] - a[1]), connectors, relLinked };
  }, [elements]);
  const selectedCards = selection.filter((id) => elements[id]?.type === "card").length;

  const run = async (label: string, fn: () => Promise<number> | number | void) => {
    try {
      const n = await fn();
      setStatus(typeof n === "number" ? `${label}: ${n}` : label);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <div className="viewpoint-body">
      <div className="viewpoint-summary">
        <strong>{stats.cards} cards · {stats.connectors} connectors</strong>
        <small>{stats.linked} linked to the graph · {stats.relLinked} connectors are relations</small>
      </div>

      <div className="viewpoint-group">
        <span>Expand selection</span>
        <div className="viewpoint-row">
          <em>Hop depth</em>
          {[1, 2, 3].map((d) => <button key={d} type="button" className={depth === d ? "active" : ""} onClick={() => setDepth(d)}>{d}</button>)}
        </div>
        <div className="viewpoint-row">
          <em>Direction</em>
          {(["both", "out", "in"] as const).map((d) => <button key={d} type="button" className={direction === d ? "active" : ""} onClick={() => setDirection(d)}>{d === "both" ? "Both" : d === "out" ? "Outbound" : "Inbound"}</button>)}
        </div>
        <button type="button" className="viewpoint-primary" disabled={busy || selectedCards === 0} onClick={() => run("Neighbours placed", () => expandSelection(depth, direction))}>
          {selectedCards === 0 ? "Select a card to expand" : `Expand ${selectedCards} card${selectedCards === 1 ? "" : "s"}`}
        </button>
      </div>

      <div className="viewpoint-group">
        <span>Relations</span>
        <div className="viewpoint-buttons">
          <button type="button" disabled={busy || stats.linked < 2} onClick={() => run("Connectors added", showRelations)}>Show all relations</button>
          <button type="button" disabled={stats.connectors === 0} onClick={() => { const s = store.getState(); s.deleteElements(Object.values(s.elements).filter((e) => e.type === "connector" && typeof e.meta?.relationId === "string").map((e) => e.id)); setStatus("Relation connectors hidden"); }}>Hide relations</button>
        </div>
      </div>

      <div className="viewpoint-group">
        <span>Cleanup</span>
        <div className="viewpoint-buttons">
          <button type="button" disabled={stats.cards === 0} onClick={() => run("Arranged by kind", arrangeByKind)}>Group by kind</button>
          <button type="button" disabled={selection.length < 2} onClick={() => run("Distributed", distributeSelection)}>Distribute</button>
          <button type="button" onClick={() => store.getState().zoomToFit()}>Fit board</button>
        </div>
      </div>

      <div className="viewpoint-group">
        <span>Lens {lens.type !== "none" && <button type="button" className="viewpoint-link" onClick={() => store.getState().setLens(NO_LENS)}>clear</button>}</span>
        <div className="viewpoint-row">
          <button type="button" className={lens.type === "none" ? "active" : ""} onClick={() => store.getState().setLens(NO_LENS)}>Off</button>
          <button type="button" className={lens.type === "impact" ? "active" : ""} onClick={() => store.getState().setLens({ type: "impact", direction, depth })} title="Dim everything not connected to the selected cards">Impact</button>
          <button type="button" className={lens.type === "attribute" ? "active" : ""} disabled={attributeKeys.length === 0} onClick={() => store.getState().setLens({ type: "attribute", key: attributeKeys[0]!.key })} title={attributeKeys.length === 0 ? "No card on this board has attributes yet" : "Colour cards by an attribute value"}>Attribute</button>
        </div>
        {lens.type === "impact" && (
          <small className="viewpoint-hint">Uses the hop depth and direction above. Select cards to trace what they touch; everything else fades.</small>
        )}
        {lens.type === "attribute" && (
          <div className="viewpoint-row">
            <em>Colour by</em>
            <select className="viewpoint-select" value={lens.key} onChange={(e) => store.getState().setLens({ type: "attribute", key: e.target.value })} aria-label="Attribute to colour by">
              {attributeKeys.map((k) => <option key={k.key} value={k.key}>{k.key} ({k.count})</option>)}
            </select>
          </div>
        )}
        {lensResult && (
          <div className="viewpoint-legend">
            <small>{lensResult.summary}</small>
            {lensResult.legend.map((entry) => (
              <button key={entry.value} type="button" onClick={() => store.getState().select(entry.ids)} title="Select these cards">
                <i style={{ background: entry.color }} />
                <b>{entry.value}</b>
                <small>{entry.count}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="viewpoint-group">
        <span>Kinds on this board {hiddenKinds.length > 0 && <button type="button" className="viewpoint-link" onClick={() => store.getState().clearHiddenKinds()}>show all</button>}</span>
        <div className="viewpoint-kinds">
          {stats.kinds.map(([kind, n]) => (
            <button key={kind} type="button" className={hiddenKinds.includes(kind) ? "dimmed" : ""} onClick={() => store.getState().toggleKind(kind)} title={hiddenKinds.includes(kind) ? "Show this kind" : "Dim this kind"}>
              <i style={{ background: cardColorForKind(kind) }} />
              <b>{kind || "Untyped"}</b>
              <small>{n}</small>
            </button>
          ))}
          {stats.kinds.length === 0 && <small className="viewpoint-empty">No cards yet. Place entities from the Inventory tab or press C.</small>}
        </div>
      </div>

      <div className="viewpoint-group">
        <span>Saved views</span>
        <div className="viewpoint-row" style={{ gap: 6 }}>
          <input className="viewpoint-input" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Name this view" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { store.getState().saveViewpoint(viewName); setViewName(""); setStatus("View saved"); } }} />
          <button type="button" onClick={() => { store.getState().saveViewpoint(viewName); setViewName(""); setStatus("View saved"); }}>Save</button>
        </div>
        <div className="viewpoint-saved">
          {saved.map((v) => (
            <div key={v.id} className="viewpoint-saved-item">
              <button type="button" className="viewpoint-saved-apply" onClick={() => { store.getState().applyViewpoint(v.id); setStatus(`Applied “${v.name}”`); }} title={`${v.hiddenKinds.length ? `dims ${v.hiddenKinds.join(", ")}` : "all kinds visible"}${v.camera ? ` · ${Math.round(v.camera.zoom * 100)}%` : ""}`}>
                <strong>{v.name}</strong>
                <small>{v.hiddenKinds.length ? `${v.hiddenKinds.length} kind${v.hiddenKinds.length === 1 ? "" : "s"} dimmed` : "all kinds"}{v.lens ? ` · ${v.lens.type === "impact" ? "impact lens" : v.lens.type === "attribute" ? `by ${v.lens.key}` : ""}` : ""}{v.camera ? ` · ${Math.round(v.camera.zoom * 100)}%` : ""}</small>
              </button>
              <button type="button" className="viewpoint-saved-delete" onClick={() => store.getState().deleteViewpoint(v.id)} aria-label={`Delete view ${v.name}`}>×</button>
            </div>
          ))}
          {saved.length === 0 && <small className="viewpoint-empty">Dim kinds and frame the board, then save the view to come back to it later.</small>}
        </div>
      </div>

      {status && <div className="viewpoint-status">{status}</div>}
    </div>
  );
}
