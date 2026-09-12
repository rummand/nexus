"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Flag, Plus, Trash2 } from "lucide-react";
import { forgetCheckpoint, markCheckpoint } from "@/lib/history/actions";
import { changedWords, type Changed } from "@/lib/history/diff";

/**
 * Named moments, and what happened between two of them (#112, §5.98).
 *
 * The axis this page adds is *what actually happened*, as against the roadmap's *what we intend*.
 * They look similar and answer opposite questions, so the words here are deliberately in the past
 * tense throughout: arrived, went, changed.
 */

export interface Mark { id: string; label: string; at: string; note: string }

export interface Comparison {
  words: string;
  counts: { added: number; removed: number; changed: number; untouched: number };
  added: Array<{ id: string; name: string; kind: string }>;
  removed: Array<{ id: string; name: string; kind: string }>;
  changed: Changed[];
  more: number;
  undone: number;
}

const day = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export function Checkpoints({ slug, workspaceId, marks, reaches, from, to, comparison }: {
  slug: string;
  workspaceId: string;
  marks: Mark[];
  /** The oldest event there is: how far back the estate can honestly be read. */
  reaches: string | null;
  from: string;
  to: string;
  comparison: Comparison | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const go = (next: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    const f = next.from ?? from;
    const t = next.to ?? to;
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    router.push(`/w/${slug}/checkpoints${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <section className="studio-home-main" aria-label="Checkpoints" data-checkpoints>
      <header className="studio-home-topbar">
        <div>
          <span>What actually happened</span>
          <h1>Checkpoints</h1>
          <p className="roadmap-lede">
            The roadmap says what we intend. This says what the estate has already done — name a
            moment, then compare any two of them. Nothing is copied: a checkpoint is a label on a
            date, and the estate at that date is read back out of the history.
          </p>
        </div>
      </header>

      <div className="checkpoint-mark">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name this moment — “before the LeanIX import”"
          aria-label="What this moment is called"
          data-checkpoint-label
        />
        <button
          type="button"
          className="primary-home-button"
          disabled={pending || !label.trim()}
          data-mark-checkpoint
          onClick={() => start(async () => {
            const r = await markCheckpoint({ workspaceId, label });
            setMessage("error" in r ? r.error : `“${label}” marked.`);
            if (!("error" in r)) { setLabel(""); router.refresh(); }
          })}
        >
          <Flag size={14} /> Mark now
        </button>
      </div>
      {message && <p className="roadmap-message">{message}</p>}

      {reaches ? (
        <p className="checkpoint-reach">
          <CalendarClock size={12} /> The history reaches back to {day(reaches)}. Before that the
          estate cannot be read — the log is where the answer comes from.
        </p>
      ) : (
        <p className="checkpoint-reach">
          <CalendarClock size={12} /> Nothing has been recorded yet, so there is no past to read.
          The history starts with the next change anybody makes.
        </p>
      )}

      <div className="checkpoint-pick">
        <label>
          <span>From</span>
          <select value={from} onChange={(e) => go({ from: e.target.value })} data-from>
            {marks.length === 0 && <option value="">no checkpoints yet</option>}
            {marks.map((m) => <option key={m.id} value={m.at}>{m.label} · {day(m.at)}</option>)}
          </select>
        </label>
        <label>
          <span>To</span>
          <select value={to} onChange={(e) => go({ to: e.target.value })} data-to>
            <option value="">now</option>
            {marks.map((m) => <option key={m.id} value={m.at}>{m.label} · {day(m.at)}</option>)}
          </select>
        </label>
      </div>

      {comparison && (
        <div className="checkpoint-diff" data-checkpoint-diff>
          <p className="checkpoint-summary">
            {comparison.counts.added + comparison.counts.removed + comparison.counts.changed === 0
              ? "Nothing changed between these two moments."
              : `${comparison.counts.added} arrived, ${comparison.counts.removed} went, ${comparison.counts.changed} changed. ${comparison.counts.untouched} untouched.`}
            {comparison.undone > 0 && <em> {comparison.undone} events were undone to work this out.</em>}
          </p>

          <Group title="Arrived" tone="added" rows={comparison.added.map((e) => ({ id: e.id, name: e.name, detail: e.kind }))} slug={slug} />
          <Group title="Went" tone="removed" rows={comparison.removed.map((e) => ({ id: e.id, name: e.name, detail: e.kind }))} slug={slug} />
          <Group title="Changed" tone="changed" rows={comparison.changed.map((c) => ({ id: c.id, name: c.name, detail: changedWords(c) }))} slug={slug} />
          {comparison.more > 0 && <p className="inventory-empty">…and {comparison.more} more, not shown.</p>}
        </div>
      )}

      {marks.length > 0 && (
        <div className="checkpoint-list">
          <h2>Named moments</h2>
          {marks.map((m) => (
            <div key={m.id} className="checkpoint-row" data-checkpoint={m.id}>
              <Flag size={13} />
              <span><b>{m.label}</b><em>{day(m.at)}{m.note ? ` · ${m.note}` : ""}</em></span>
              <button
                type="button"
                className="ghost-button"
                disabled={pending}
                title="Forget the label. The history it points at is untouched."
                onClick={() => start(async () => {
                  await forgetCheckpoint(workspaceId, m.id);
                  router.refresh();
                })}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {marks.length === 0 && (
        <p className="inventory-empty">
          <Plus size={13} /> No moments named yet. Mark one before anything large — an import, a
          migration, a reorganisation — and you will be able to say exactly what it did.
        </p>
      )}
    </section>
  );
}

function Group({ title, tone, rows, slug }: {
  title: string;
  tone: "added" | "removed" | "changed";
  rows: Array<{ id: string; name: string; detail: string }>;
  slug: string;
}) {
  if (!rows.length) return null;
  return (
    <section className={`checkpoint-group ${tone}`} data-group={tone}>
      <h3>{title} <em>{rows.length}</em></h3>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            {/* Something that has gone has no page to open; the others do. */}
            {tone === "removed" ? <b>{row.name || "(unnamed)"}</b> : <a href={`/w/${slug}/fs/${row.id}`}>{row.name || "(unnamed)"}</a>}
            <span>{row.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
