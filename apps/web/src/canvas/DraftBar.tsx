"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, GitPullRequestArrow } from "lucide-react";
import { deliverChangeSet } from "@/lib/change/actions";
import { useCanvas, useCanvasStore } from "./store";

/**
 * What this board has drawn that is not in the model yet (#149, §5.101).
 *
 * §5.100 stopped a drawn object from landing in the estate unseen, and marked the card. That was
 * the safety; this is the part that makes it usable. Without it the canvas could tell you an
 * object was held back and then send you to the roadmap to do anything about it — and a governance
 * step that costs a page change is one people learn to route around.
 *
 * The same shape as the staged-import bar (§5.36), for the same reason: a person working on a
 * board should be able to finish without going anywhere else.
 *
 * Counted from the elements rather than fetched, so the number moves as you draw: the save stamps
 * what it held back onto the cards it held back, and this reads that. One derivation, whether the
 * marks came from opening the board or from the save that just returned.
 */
export function DraftBar({ slug }: { slug: string }) {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const drafts = useCanvas((s) => s.drafts);
  const saveState = useCanvas((s) => s.saveState);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);

  /*
   * Which elements on *this* board are the outstanding proposals. The branch may hold objects
   * drawn on another board too; the bar counts what is in front of you, because "show me" has to
   * be able to keep its promise.
   */
  const here = useMemo(() => {
    if (!drafts) return { ids: [], setId: "", setName: "" };
    const wanted = new Set(drafts.entityIds);
    const ids = Object.values(elements)
      .filter((el) => el.type === "card" && typeof el.meta?.entityId === "string" && wanted.has(el.meta.entityId))
      .map((el) => el.id);
    return { ids, setId: drafts.setId, setName: drafts.setName };
  }, [elements, drafts]);

  /*
   * `done` keeps the bar alive after the marks are gone. Clearing them is what makes the cards
   * stop looking proposed, which also empties `drafts` — so without this the sentence saying the
   * objects were added would disappear in the same frame as the thing it is reporting on.
   */
  if (!done && (!here.ids.length || !here.setId)) return null;

  const count = here.ids.length;

  /** Put them on screen. The bar says there are four; the board should be able to show which. */
  const show = () => {
    store.getState().select(here.ids);
    store.getState().zoomToSelection();
  };

  const add = (anyway = false) => {
    setError(null);
    setRefused(null);
    start(async () => {
      /*
       * The same action the roadmap calls, deliberately. Dependencies, a stale projection, the
       * merge gate and MODELOWNERS all apply here exactly as they do there — a second, friendlier
       * path to "agreed" would be a second definition of it.
       */
      const answer = await deliverChangeSet(here.setId, anyway ? { anyway: true } : undefined);
      if ("error" in answer) {
        if (answer.refusal) setRefused(answer.error);
        else setError(answer.error);
        return;
      }
      setDone(`${count} object${count === 1 ? "" : "s"} added to the model.`);
      /*
       * The cards are in the estate now, so they must stop looking as though they are not. Cleared
       * here rather than waiting for a reload — leaving a delivered object dashed and badged is
       * the same lie in the other direction.
       */
      store.getState().setDrafts(null);
    });
  };

  return (
    <div className="draft-bar" data-draft-bar onPointerDown={(e) => e.stopPropagation()}>
      <b><GitPullRequestArrow size={14} /> Not in the model yet</b>
      <span className="draft-bar-count" data-draft-count>
        {count} object{count === 1 ? "" : "s"} drawn here
      </span>
      <span className="draft-bar-hint">
        {here.setName ? `Waiting on ${here.setName}.` : "Waiting on a change set."} Nothing new enters
        the model without somebody seeing it.
      </span>

      {done ? (
        <span className="draft-bar-done"><Check size={13} /> {done} <Link href={`/w/${slug}/graph`}>See the model</Link></span>
      ) : (
        <>
          {error && <span className="draft-bar-error"><AlertTriangle size={12} /> {error}</span>}
          {/*
            A refusal from the merge gate is not an error to dismiss — it is a finding somebody has
            to answer for. So it keeps its own line and its own button, and the button says what it
            actually does rather than "OK".
          */}
          {refused && (
            <span className="draft-bar-refused" data-draft-refused>
              <AlertTriangle size={12} /> {refused}
              <button type="button" className="ghost-button" disabled={pending} onClick={() => add(true)} data-draft-anyway>
                Add anyway
              </button>
            </span>
          )}
          <button type="button" className="ghost-button" onClick={show} data-draft-show>Show me</button>
          <Link className="ghost-button" href={`/w/${slug}/roadmap`}>Review</Link>
          <button
            type="button"
            className="primary-home-button"
            disabled={pending || saveState !== "saved"}
            onClick={() => add(false)}
            data-draft-add
            title={saveState === "saved" ? "" : "Waiting for the board to save, so what you add is what you drew."}
          >
            {pending ? "Adding…" : saveState === "saved" ? `Add ${count} to the model` : "Saving…"}
          </button>
        </>
      )}
    </div>
  );
}
