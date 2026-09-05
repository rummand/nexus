"use client";

import { useEffect, useRef } from "react";
import { serializeDocument } from "../document";
import { useCanvasStore } from "../store";

const DEBOUNCE_MS = 800;

/**
 * Debounced PUT of the board document whenever the local revision changes.
 *
 * Every save carries the server revision this client last saw. If somebody else saved in the
 * meantime the server answers 409 and we stop: retrying would only overwrite their work with
 * ours a few seconds later. That is a terminal state for this tab — the topbar says so and the
 * only honest fix is a reload, because we have no merge.
 */
export function useAutosave() {
  const store = useCanvasStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const lastSavedRevision = useRef(0);
  const stopped = useRef(false);

  useEffect(() => {
    const save = async (keepalive = false) => {
      if (stopped.current) return;
      const s = store.getState();
      const revision = s.revision;
      if (revision === lastSavedRevision.current) return;
      s.setSaveState("saving");
      try {
        const res = await fetch(`/api/boards/${s.boardId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ document: JSON.parse(serializeDocument(s.toDocument())), revision: s.boardRevision }),
          keepalive,
        });
        if (res.status === 409) {
          stopped.current = true;
          if (timer.current) clearTimeout(timer.current);
          store.getState().setSaveState("conflict");
          return;
        }
        if (!res.ok) throw new Error(`save failed: ${res.status}`);
        const body = (await res.json().catch(() => null)) as { revision?: number } | null;
        lastSavedRevision.current = revision;
        const now = store.getState();
        if (typeof body?.revision === "number") now.setBoardRevision(body.revision);
        now.setSaveState(now.revision === revision ? "saved" : "dirty");
        if (now.revision !== revision) schedule();
      } catch {
        store.getState().setSaveState("error");
        // retry later
        timer.current = setTimeout(() => void save(), 5000);
      }
    };
    const schedule = () => {
      if (stopped.current) return;
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
