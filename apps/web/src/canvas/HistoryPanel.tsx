"use client";

import { useEffect, useState, type RefObject } from "react";
import { GitCompareArrows, History, RotateCcw } from "lucide-react";
import { diffDocuments, elementLabel, summarizeDiff, type DocumentDiff } from "./diff";
import { useDraggablePanel } from "./hooks/useDraggablePanel";
import { useCanvas, useCanvasStore } from "./store";
import type { CanvasDocument } from "./document";
import type { VersionSummary } from "@/lib/versions";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Version history: automatic checkpoints while editing, manual checkpoints, restore. */
export function HistoryPanel({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const store = useCanvasStore();
  const boardId = useCanvas((s) => s.boardId);
  const saveState = useCanvas((s) => s.saveState);
  const count = useCanvas((s) => Object.keys(s.elements).length);
  const { pos, onPointerDown, panelRef } = useDraggablePanel(rootRef, { right: 300, y: 76 });
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ version: VersionSummary; diff: DocumentDiff } | null>(null);

  const compareWith = async (v: VersionSummary) => {
    if (compare?.version.id === v.id) { setCompare(null); return; }
    setBusy(v.id);
    try {
      const res = await fetch(`/api/boards/${boardId}/versions/${v.id}`);
      if (!res.ok) throw new Error(`load failed: ${res.status}`);
      const data = (await res.json()) as { document: CanvasDocument };
      setCompare({ version: v, diff: diffDocuments(data.document, store.getState().toDocument()) });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setBusy(null);
    }
  };

  // (re)load after every successful save — saves are when auto checkpoints appear
  useEffect(() => {
    if (saveState !== "saved") return;
    let cancelled = false;
    fetch(`/api/boards/${boardId}/versions`)
      .then((res) => (res.ok ? (res.json() as Promise<{ versions: VersionSummary[] }>) : null))
      .then((data) => { if (!cancelled && data) setVersions(data.versions); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [boardId, saveState]);

  const checkpoint = async () => {
    setBusy("new");
    try {
      const res = await fetch(`/api/boards/${boardId}/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label, document: store.getState().toDocument() }) });
      if (res.ok) {
        setVersions(((await res.json()) as { versions: VersionSummary[] }).versions);
        setLabel("");
        setMessage("Checkpoint saved");
      }
    } finally {
      setBusy(null);
    }
  };

  const restore = async (v: VersionSummary) => {
    if (!confirm(`Restore the board to ${ago(v.createdAt)} (${v.objectCount} objects)? The current state is kept as a checkpoint.`)) return;
    setBusy(v.id);
    try {
      const res = await fetch(`/api/boards/${boardId}/versions/${v.id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error(`restore failed: ${res.status}`);
      const data = (await res.json()) as { document: CanvasDocument; versions: VersionSummary[] };
      const s = store.getState();
      s.clearSelection();
      s.replaceElements(data.document.elements, { history: true });
      setVersions(data.versions);
      setMessage(`Restored ${ago(v.createdAt)}`);
      s.zoomToFit();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      ref={(el) => { panelRef.current = el; }}
      className="floating-panel history-panel"
      aria-label="Version history"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? 76 }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="panel-title" onPointerDown={onPointerDown} title="Drag to move">
        <History size={18} />
        Version history
        <div className="panel-title-actions">
          <button type="button" onClick={() => store.getState().togglePanel("history", false)}>Hide</button>
        </div>
      </div>
      <div className="history-new">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label this checkpoint (optional)" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") void checkpoint(); }} />
        <button type="button" className="viewpoint-primary" disabled={busy === "new" || count === 0} onClick={() => void checkpoint()}>Save checkpoint</button>
      </div>
      <p className="history-hint">Checkpoints are taken automatically every 10 minutes while you edit; manual ones are kept forever. Restoring keeps the current state as a checkpoint.</p>
      {message && <div className="viewpoint-status">{message}</div>}
      {compare && (
        <div className="history-diff" data-history-diff>
          <div className="history-diff-head">
            <strong>Since {compare.version.label || ago(compare.version.createdAt)}</strong>
            <small>{summarizeDiff(compare.diff)}</small>
            <button type="button" onClick={() => setCompare(null)} aria-label="Close comparison">×</button>
          </div>
          <ul>
            {compare.diff.added.map((el) => <li key={`a${el.id}`} className="added"><button type="button" onClick={() => store.getState().focusElement(el.id)}><i>+</i><span>{elementLabel(el)}</span><em>{el.type}</em></button></li>)}
            {compare.diff.changed.map((c) => <li key={`c${c.after.id}`} className="changed"><button type="button" onClick={() => store.getState().focusElement(c.after.id)}><i>~</i><span>{elementLabel(c.after)}</span><em>{c.fields.join(", ")}</em></button></li>)}
            {compare.diff.removed.map((el) => <li key={`r${el.id}`} className="removed"><i>−</i><span>{elementLabel(el)}</span><em>{el.type}</em></li>)}
            {compare.diff.added.length + compare.diff.changed.length + compare.diff.removed.length === 0 && <li className="history-empty">The board is identical to this checkpoint.</li>}
          </ul>
        </div>
      )}
      <ul className="history-list">
        {versions === null && <li className="history-empty">Loading…</li>}
        {versions?.length === 0 && <li className="history-empty">No checkpoints yet — the first one appears after your next edit.</li>}
        {versions?.map((v) => (
          <li key={v.id} className={`history-item ${v.reason}`}>
            <div>
              <strong>{v.label || (v.reason === "auto" ? "Auto checkpoint" : v.reason === "restore" ? "Before restore" : "Checkpoint")}</strong>
              <small>{ago(v.createdAt)} · {v.objectCount} objects{v.createdBy ? ` · ${v.createdBy}` : ""}</small>
            </div>
            <button type="button" title="Compare with the board as it is now" className={compare?.version.id === v.id ? "active" : ""} disabled={busy === v.id} onClick={() => void compareWith(v)}><GitCompareArrows size={13} /></button>
            <button type="button" title="Restore this version" disabled={busy === v.id} onClick={() => void restore(v)}><RotateCcw size={13} /> Restore</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
