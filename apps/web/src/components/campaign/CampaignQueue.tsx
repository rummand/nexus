"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, CircleSlash, RotateCcw, Undo2 } from "lucide-react";
import type { CampaignDetail } from "@/lib/campaign/read";
import { STATE_LABEL, burnWords, canClose, type ObjectState } from "@/lib/campaign/state";
import { closeCampaign, setObjectState } from "@/lib/campaign/actions";

/**
 * Getting through ninety applications on a Tuesday (§5.85).
 *
 * The campaign is not a third surface — it is a lens the object list wears. So this is a
 * worklist: one object at a time, the decision in front of you, and *next* the moment you have
 * made it. What it must not become is a table with a dropdown per row, which is a screen people
 * scroll rather than a queue people finish.
 *
 * The four ways out of an object are the four honest ones: it is right, it is deliberately being
 * left, somebody else has to answer, or you are not finished with it.
 */

const FILTERS: Array<{ id: "todo" | "all" | "done" | "asked"; label: string }> = [
  { id: "todo", label: "To do" },
  { id: "asked", label: "Waiting on someone" },
  { id: "done", label: "Done" },
  { id: "all", label: "Everything" },
];

/** A month out: long enough to be useful, short enough that somebody looks again. */
function defaultExpiry(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export function CampaignQueue({ slug, detail }: { slug: string; detail: CampaignDetail }) {
  const router = useRouter();
  const { campaign, objects, burn } = detail;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("todo");
  const [note, setNote] = useState("");
  const [expiry, setExpiry] = useState(defaultExpiry());
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const shown = useMemo(() => objects.filter((o) => {
    const s = o.standing.state;
    if (filter === "all") return true;
    if (filter === "done") return s === "validated" || s === "waived";
    if (filter === "asked") return s === "needs-decision";
    return s === "untouched" || s === "in-review";
  }), [objects, filter]);

  const [cursor, setCursor] = useState(0);
  const current = shown[Math.min(cursor, Math.max(0, shown.length - 1))];
  const close = canClose(burn);

  const move = (state: ObjectState, extra: { note?: string; expiresAt?: string | null } = {}) => {
    if (!current) return;
    setError("");
    start(async () => {
      const r = await setObjectState({ campaignId: campaign.id, entityId: current.item.id, state, ...extra });
      if ("error" in r) { setError(r.error); return; }
      setNote("");
      /* Stay where you are in the list: the object you just judged leaves it, and the next one
         takes its place. Advancing as well would skip one every time. */
      router.refresh();
    });
  };

  return (
    <div className="campaign" data-campaign={campaign.id}>
      <header className="campaign-head">
        <div>
          <span>Campaign</span>
          <h1>{campaign.name}</h1>
          {campaign.description && <p>{campaign.description}</p>}
        </div>
        <div className="campaign-burn" data-campaign-burn>
          <strong>{burnWords(burn)}</strong>
          <div className="campaign-bar"><i style={{ width: `${burn.percent}%` }} /></div>
          <em>
            {burn.percent}% done
            {burn.lapsed > 0 && <b> · {burn.lapsed} came back</b>}
          </em>
        </div>
      </header>

      <nav className="campaign-filters">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={filter === f.id ? "on" : ""} onClick={() => { setFilter(f.id); setCursor(0); }} data-campaign-filter={f.id}>
            {f.label}
          </button>
        ))}
        <span className="campaign-count">{shown.length} of {burn.total}</span>
        {campaign.status === "open" && (
          <button
            type="button"
            className="campaign-close"
            disabled={!close.ok || pending}
            title={close.why}
            onClick={() => start(async () => {
              const r = await closeCampaign(campaign.id);
              if ("error" in r) setError(r.error); else router.refresh();
            })}
            data-campaign-close
          >
            Close the campaign
          </button>
        )}
      </nav>

      {!current ? (
        <p className="campaign-empty" data-campaign-empty>
          {filter === "todo" ? "Nothing left in this queue. " : "Nothing here. "}
          {close.ok ? close.why : close.why}
        </p>
      ) : (
        <div className="campaign-body">
          <section className="campaign-card" data-campaign-current={current.item.id}>
            <div className="campaign-card-head">
              <Link href={`/w/${slug}/fs/${current.item.id}`} data-campaign-open>{current.item.name || "(unnamed)"}</Link>
              <span className="campaign-kind">{current.item.kind || "Untyped"}</span>
              <span className={`campaign-state ${current.standing.state}`} data-campaign-state={current.standing.state}>
                {STATE_LABEL[current.standing.state]}
              </span>
            </div>
            {current.item.description && <p className="campaign-said">{current.item.description}</p>}
            <dl className="campaign-facts">
              <div><dt>Sits in</dt><dd>{current.item.parent || "the top level"}</dd></div>
              <div><dt>Relations</dt><dd>{current.item.relationCount || "none"}</dd></div>
              <div><dt>On boards</dt><dd>{current.item.boardCount || "none"}</dd></div>
              <div><dt>Type</dt><dd>{current.item.declared ? "declared" : "not declared"}</dd></div>
            </dl>
            {current.standing.lapsed === "changed" && (
              <p className="campaign-lapsed">
                This was validated, and has been edited since — so it is back in the queue. That is
                the point: a validation is about the object as it was.
              </p>
            )}
            {current.standing.lapsed === "expired" && (
              <p className="campaign-lapsed">The waiver on this has expired. Somebody has to look again.</p>
            )}
            {current.standing.note && <p className="campaign-note">“{current.standing.note}”</p>}
          </section>

          <section className="campaign-decide">
            <label>
              <span>A reason, or a question</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it is being left, or what you need answered" data-campaign-note />
            </label>
            <label className="campaign-expiry">
              <span>A waiver lasts until</span>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} data-campaign-expiry />
            </label>
            <div className="campaign-buttons">
              <button type="button" className="ok" disabled={pending} onClick={() => move("validated")} data-campaign-validate>
                <Check size={14} /> It is right
              </button>
              <button type="button" disabled={pending} onClick={() => move("waived", { note, expiresAt: `${expiry}T00:00:00.000Z` })} data-campaign-waive>
                <CircleSlash size={14} /> Leave it, for now
              </button>
              <button type="button" disabled={pending} onClick={() => move("needs-decision", { note })} data-campaign-ask>
                <CircleHelp size={14} /> Somebody has to answer
              </button>
              <button type="button" disabled={pending} onClick={() => move("in-review")} data-campaign-hold>
                <RotateCcw size={14} /> I am still on it
              </button>
              {current.standing.state !== "untouched" && (
                <button type="button" className="quiet" disabled={pending} onClick={() => move("untouched")} data-campaign-clear>
                  <Undo2 size={13} /> Undo
                </button>
              )}
            </div>
            {error && <p className="campaign-error" data-campaign-error>{error}</p>}
          </section>

          <ol className="campaign-rest">
            {shown.slice(0, 40).map((o, i) => (
              <li key={o.item.id}>
                <button type="button" className={i === cursor ? "on" : ""} onClick={() => setCursor(i)} data-campaign-row={o.item.id}>
                  <b>{o.item.name || "(unnamed)"}</b>
                  <em>{STATE_LABEL[o.standing.state]}</em>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
