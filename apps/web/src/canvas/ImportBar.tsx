"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, DownloadCloud, PauseCircle, X } from "lucide-react";
import { approveBatch } from "@/lib/import/actions";
import { laneCounts } from "@/lib/import/reconcile";
import { useCanvas } from "./store";

/**
 * The bar on a staged import board.
 *
 * A board whose lanes are decisions should not look like an ordinary drawing, and the person
 * working on it should be able to finish without going anywhere else. So: what the lanes currently
 * say, counted live as cards are dragged, and the one button that writes it.
 *
 * The counts come from the elements rather than from the server, because a number that only caught
 * up after a save would make the lanes feel like a form. They use the same containment rule the
 * reconciler uses, so the bar promises exactly what a save will write.
 */
export function ImportBar({ batchId, slug, status }: { batchId: string; slug: string; status: string | null }) {
  /*
   * Select the elements, then count them here. A selector that returned a fresh object every call
   * would re-render on every store read — the counts are derived state, not state.
   */
  const elements = useCanvas((s) => s.elements);
  const counts = useMemo(() => laneCounts(elements), [elements]);
  const saveState = useCanvas((s) => s.saveState);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approve = () => {
    setError(null);
    setResult(null);
    start(async () => {
      const answer = await approveBatch(batchId);
      if ("error" in answer) setError(answer.error);
      else setResult(`${answer.created} created, ${answer.updated} changed, ${answer.connected} connected.`);
    });
  };

  /*
   * A batch is only open once. After it is approved the board is still worth having — it is what
   * the import looked like — but the lanes no longer decide anything, and offering Approve again
   * would be a button whose only outcome is an error.
   */
  if (status && status !== "staged") {
    return (
      <div className="import-bar done" data-import-bar data-import-status={status}>
        <b><DownloadCloud size={14} /> {status === "approved" ? "Imported" : status === "rolled back" ? "Rolled back" : "This import is gone"}</b>
        <span className="import-bar-hint">
          {status === "approved"
            ? "This board is what the import looked like. The lanes no longer decide anything; put it back from the batch page if you need to."
            : status === "rolled back"
              ? "What this import wrote has been undone, except where somebody had since built on it."
              : "The batch behind this board has been deleted, so nothing here can be approved."}
        </span>
        <Link className="ghost-button" href={`/w/${slug}/import/${batchId}`}>The batch</Link>
      </div>
    );
  }

  return (
    <div className="import-bar" data-import-bar data-import-status="staged">
      <b><DownloadCloud size={14} /> Staged import</b>
      <span className="import-bar-counts" data-import-counts>
        <em className="accept"><Check size={11} /> {counts.accept} accepted</em>
        <em className="hold"><PauseCircle size={11} /> {counts.hold} held</em>
        <em className="reject"><X size={11} /> {counts.reject} rejected</em>
        {counts.loose > 0 && <em className="loose">{counts.loose} outside any lane</em>}
      </span>
      <span className="import-bar-hint">
        Drag a card into another lane to change what happens to it. Nothing is in the model until you approve.
      </span>
      {result ? (
        <span className="import-bar-done"><Check size={13} /> {result} <Link href={`/w/${slug}/graph`}>See the model</Link></span>
      ) : (
        <>
          {error && <span className="import-bar-error"><AlertTriangle size={12} /> {error}</span>}
          <Link className="ghost-button" href={`/w/${slug}/import/${batchId}`}>The files</Link>
          <button
            type="button"
            className="primary-home-button"
            disabled={pending || counts.accept === 0 || saveState !== "saved"}
            onClick={approve}
            data-approve-import
            title={saveState === "saved" ? "" : "Waiting for the board to save, so what you see is what is written."}
          >
            {pending ? "Writing…" : saveState === "saved" ? `Approve ${counts.accept}` : "Saving…"}
          </button>
        </>
      )}
    </div>
  );
}
