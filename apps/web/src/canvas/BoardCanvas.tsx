"use client";

import { useEffect, useRef, useState } from "react";
import type { CanvasDocument } from "./document";
import { CanvasStoreContext, createCanvasStore, useStore, type ScrollMode } from "./store";
import { Canvas } from "./Canvas";
import { StudioTopbar, type StudioTopbarProps } from "./StudioTopbar";
import { ImportBar } from "./ImportBar";
import { markBoardOpened } from "@/lib/actions";

const SCROLL_MODE_KEY = "nexus.scrollMode";

/** Client entry point for a board: owns the store and renders the studio shell. */
export function BoardCanvas({ document, header, boardRevision = 0, importStatus = null }: { document: CanvasDocument; header: StudioTopbarProps; boardRevision?: number; importStatus?: string | null }) {
  const [store] = useState(() => {
    let scrollMode: ScrollMode = "pan";
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(SCROLL_MODE_KEY) : null;
      if (stored === "pan" || stored === "zoom") scrollMode = stored;
    } catch {
      /* ignore */
    }
    return createCanvasStore({ boardId: header.boardId, workspaceId: header.workspaceId, document, scrollMode, boardRevision });
  });

  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (opened.current === header.boardId) return; // strict-mode double effect
    opened.current = header.boardId;
    void markBoardOpened(header.boardId);
  }, [header.boardId]);

  useEffect(() => {
    return store.subscribe((s, prev) => {
      if (s.scrollMode !== prev.scrollMode) {
        try {
          window.localStorage.setItem(SCROLL_MODE_KEY, s.scrollMode);
        } catch {
          /* ignore */
        }
      }
    });
  }, [store]);

  const presenting = useStore(store, (s) => s.presenting);
  const importBatch = useStore(store, (s) => s.importBatch);
  return (
    <CanvasStoreContext.Provider value={store}>
      <div className={`miro-studio${presenting ? " presenting" : ""}${!presenting && importBatch ? " staged-import" : ""}`}>
        {!presenting && <StudioTopbar {...header} />}
        {/* A staged import is work, not a drawing: say so, and let it be finished from here (§5.36). */}
        {!presenting && importBatch && <ImportBar batchId={importBatch} slug={header.workspace.slug} status={importStatus} />}
        <Canvas />
      </div>
    </CanvasStoreContext.Provider>
  );
}
