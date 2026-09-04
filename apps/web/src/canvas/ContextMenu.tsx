"use client";

import { useEffect } from "react";
import { BringToFront, Copy, Focus, Lock, Maximize2, Network, SendToBack, StickyNote, Box, Trash2, Unlock, MousePointerSquareDashed } from "lucide-react";
import { nanoid } from "nanoid";
import { cardColorForKind, NOTE_COLORS, type CanvasElement } from "./document";
import { useCanvas, useCanvasStore } from "./store";
import { useGraphActions } from "./hooks/useGraphActions";
import { ENTITY_ID_PREFIX } from "@/lib/graph-types";

/** Right-click menu: object actions or quick creation on empty canvas. */
export function ContextMenu() {
  const store = useCanvasStore();
  const menu = useCanvas((s) => s.contextMenu);
  const selection = useCanvas((s) => s.selection);
  const elements = useCanvas((s) => s.elements);
  const viewport = useCanvas((s) => s.viewport);
  const { expandSelection } = useGraphActions();

  useEffect(() => {
    if (!menu) return;
    const close = () => store.getState().setContextMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", close); };
  }, [menu, store]);

  if (!menu) return null;
  const close = () => store.getState().setContextMenu(null);
  const run = (fn: () => void) => () => { fn(); close(); };
  const items = selection.map((id) => elements[id]).filter((e): e is CanvasElement => !!e);
  const hasSelection = items.length > 0;
  const allLocked = hasSelection && items.every((i) => i.locked);
  const cards = items.filter((i) => i.type === "card");
  const left = Math.min(menu.x, Math.max(8, viewport.w - 230));
  const top = Math.min(menu.y, Math.max(8, viewport.h - 320));
  const s = store.getState();

  const createAt = (el: CanvasElement) => { s.addElements([el], { select: true }); s.startEditing(el.id); };

  return (
    <div className="context-menu fade-in" style={{ left, top }} role="menu" onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      {hasSelection ? (
        <>
          {cards.length > 0 && <button type="button" onClick={run(() => void expandSelection(1, "both"))}><Network size={14} /> Expand neighbours</button>}
          <button type="button" onClick={run(() => s.zoomToSelection())}><Focus size={14} /> Focus</button>
          <button type="button" onClick={run(() => s.duplicateSelection())}><Copy size={14} /> Duplicate <kbd>⌘D</kbd></button>
          <button type="button" onClick={run(() => s.bringToFront(selection))}><BringToFront size={14} /> Bring to front <kbd>⌘]</kbd></button>
          <button type="button" onClick={run(() => s.sendToBack(selection))}><SendToBack size={14} /> Send to back <kbd>⌘[</kbd></button>
          <button type="button" onClick={run(() => s.updateElements(Object.fromEntries(selection.map((id) => [id, { locked: !allLocked }])), { history: true }))}>{allLocked ? <Unlock size={14} /> : <Lock size={14} />} {allLocked ? "Unlock" : "Lock"}</button>
          <hr />
          <button type="button" className="danger" onClick={run(() => s.deleteElements(selection))}><Trash2 size={14} /> Delete <kbd>⌫</kbd></button>
        </>
      ) : (
        <>
          <button type="button" onClick={run(() => createAt({ id: nanoid(10), type: "card", x: menu.world.x - 118, y: menu.world.y - 62, w: 236, h: 124, kind: "Application", color: cardColorForKind("Application"), title: "", description: "", z: 0, meta: { entityId: `${ENTITY_ID_PREFIX}${nanoid(12)}` } }))}><Box size={14} /> Card here <kbd>C</kbd></button>
          <button type="button" onClick={run(() => createAt({ id: nanoid(10), type: "sticky", x: menu.world.x - 150, y: menu.world.y - 75, w: 300, h: 150, title: "", text: "", color: NOTE_COLORS[0], z: 0 }))}><StickyNote size={14} /> Note here <kbd>N</kbd></button>
          <hr />
          <button type="button" onClick={run(() => s.selectAll())}><MousePointerSquareDashed size={14} /> Select all <kbd>⌘A</kbd></button>
          <button type="button" onClick={run(() => s.zoomToFit())}><Maximize2 size={14} /> Fit board <kbd>⇧1</kbd></button>
        </>
      )}
    </div>
  );
}
