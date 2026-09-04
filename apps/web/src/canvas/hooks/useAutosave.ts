"use client";

import { useEffect, useRef } from "react";
import { serializeDocument } from "../document";
import { useCanvasStore } from "../store";

const DEBOUNCE_MS = 800;

/** Debounced PUT of the board document whenever the revision changes. */
export function useAutosave() {
  const store = useCanvasStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const lastSavedRevision = useRef(0);

  useEffect(() => {
    const save = async (keepalive = false) => {
      const s = store.getState();
      const revision = s.revision;
      if (revision === lastSavedRevision.current) return;
      s.setSaveState("saving");
      try {
        const res = await fetch(`/api/boards/${s.boardId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ document: JSON.parse(serializeDocument(s.toDocument())) }),
          keepalive,
        });
        if (!res.ok) throw new Error(`save failed: ${res.status}`);
        lastSavedRevision.current = revision;
        const now = store.getState();
        now.setSaveState(now.revision === revision ? "saved" : "dirty");
        if (now.revision !== revision) schedule();
      } catch {
        store.getState().setSaveState("error");
        // retry later
        timer.current = setTimeout(() => void save(), 5000);
      }
    };
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        inflight.current = save().finally(() => (inflight.current = null));
      }, DEBOUNCE_MS);
    };

    const unsub = store.subscribe((state, prev) => {
      if (state.revision !== prev.revision) schedule();
    });

    const onHide = () => {
      if (document.visibilityState === "hidden" && store.getState().revision !== lastSavedRevision.current) void save(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (store.getState().revision !== lastSavedRevision.current) {
        void save(true);
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
      if (store.getState().revision !== lastSavedRevision.current) void save(true);
    };
  }, [store]);
}
