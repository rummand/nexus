"use client";

import { useEffect } from "react";
import type { GraphSnapshot, Proposal } from "@/lib/graph-types";
import { useCanvas, useCanvasStore } from "../store";

/** Keep the store's agent proposals and vocabulary fresh: load on mount and after every successful save. */
export function useProposals() {
  const store = useCanvasStore();
  const workspaceId = useCanvas((s) => s.workspaceId);
  const saveState = useCanvas((s) => s.saveState);
  useEffect(() => {
    if (saveState !== "saved") return;
    let cancelled = false;
    fetch(`/api/workspaces/${workspaceId}/proposals`)
      .then((r) => (r.ok ? (r.json() as Promise<{ proposals: Proposal[] }>) : null))
      .then((data) => { if (!cancelled && data && Array.isArray(data.proposals)) store.getState().setProposals(data.proposals); })
      .catch(() => undefined);
    fetch(`/api/workspaces/${workspaceId}/graph`)
      .then((r) => (r.ok ? (r.json() as Promise<GraphSnapshot>) : null))
      .then((snap) => { if (!cancelled && snap) store.getState().setGraphKinds(snap.kinds.map((k) => k.kind).filter(Boolean)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspaceId, saveState, store]);
}
