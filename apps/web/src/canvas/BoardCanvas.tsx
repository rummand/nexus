"use client";

import { useEffect, useRef, useState } from "react";
import type { CanvasDocument } from "./document";
import { CanvasStoreContext, createCanvasStore, useStore, type ScrollMode } from "./store";
import { Canvas } from "./Canvas";
import { StudioTopbar, type StudioTopbarProps } from "./StudioTopbar";
import { loadOverlay } from "./overlay";
import { ImportBar } from "./ImportBar";
import { markBoardOpened } from "@/lib/actions";
import { CommentsProvider } from "./comments/CommentsContext";

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

  /*
   * A board opens in the world you are standing in (§5.82).
   *
   * Standing on a change set and being shown as-is anyway is the bug the checkout exists to fix:
   * the rail would say one thing and the picture another. So the overlay for the ref is applied
   * on arrival, once — after that the viewpoint panel owns the view, because somebody who
   * deliberately switched to as-is meant it and should not have it switched back.
   */
  const at = header.at;
  /*
   * Keyed on the ref alone, deliberately. It must not re-run when the view changes — somebody who
   * switched the viewpoint panel to as-is meant it, and having the board snap back to the plan
   * would be the chrome arguing with the person. An earlier cut guarded with a ref instead and
   * applied nothing at all: under StrictMode the first mount's cleanup cancelled the fetch and
   * the second mount saw the guard already set.
   */
  const atId = at.kind === "main" ? "" : at.id;
  useEffect(() => {
    if (!atId) return;
    let cancelled = false;
    void loadOverlay(`chg:${atId}`).then((built) => {
      if (!cancelled && built) store.getState().setChangeOverlay(built);
    });
    return () => { cancelled = true; };
  }, [atId, store]);

  const presenting = useStore(store, (s) => s.presenting);
  const importBatch = useStore(store, (s) => s.importBatch);
  return (
    <CanvasStoreContext.Provider value={store}>
      {/* Conversations are rows beside the document, so they wrap the shell rather than the canvas:
          the topbar's count and the pins on the board are the same data (§5.50). */}
      <CommentsProvider boardId={header.boardId} me={header.user.id}>
        <div className={`miro-studio${presenting ? " presenting" : ""}${!presenting && importBatch ? " staged-import" : ""}`}>
          {!presenting && <StudioTopbar {...header} />}
          {/* A staged import is work, not a drawing: say so, and let it be finished from here (§5.36). */}
          {!presenting && importBatch && <ImportBar batchId={importBatch} slug={header.workspace.slug} status={importStatus} />}
          <Canvas />
        </div>
      </CommentsProvider>
    </CanvasStoreContext.Provider>
  );
}
