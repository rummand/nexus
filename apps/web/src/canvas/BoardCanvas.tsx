"use client";

import { useEffect, useState } from "react";
import type { CanvasDocument } from "./document";
import { CanvasStoreContext, createCanvasStore, type ScrollMode } from "./store";
import { Canvas } from "./Canvas";
import { StudioTopbar, type StudioTopbarProps } from "./StudioTopbar";
import { markBoardOpened } from "@/lib/actions";

const SCROLL_MODE_KEY = "nexus.scrollMode";

/** Client entry point for a board: owns the store and renders the studio shell. */
export function BoardCanvas({ document, header }: { document: CanvasDocument; header: StudioTopbarProps }) {
  const [store] = useState(() => {
    let scrollMode: ScrollMode = "pan";
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(SCROLL_MODE_KEY) : null;
      if (stored === "pan" || stored === "zoom") scrollMode = stored;
    } catch {
      /* ignore */
    }
    return createCanvasStore({ boardId: header.boardId, document, scrollMode });
  });

  useEffect(() => {
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

  return (
    <CanvasStoreContext.Provider value={store}>
      <div className="miro-studio">
        <StudioTopbar {...header} />
        <Canvas />
      </div>
    </CanvasStoreContext.Provider>
  );
}
