"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { History, Search } from "lucide-react";
import { dayKey, describeActor, foldMoments, whenWords, type ActorKind, type GraphEvent } from "@/lib/history/events";
import { ActorChip, EventLine } from "./EventLine";

/**
 * What changed (§5.43).
 *
 * The estate's own newsfeed. Boards have had version history since §5.9 and agents have written to
 * the graph unattended since §5.42, which left one obvious hole: no page could answer "what has
 * happened to our model lately", and the moment a system of record cannot answer that it stops
 * being one.
 *
 * The filter that matters is by *hand*, not by date: "show me only what the agents did" is the
 * question somebody asks the morning after turning a fleet on, and the one a list sorted by time
 * alone cannot answer.
 */

const FILTERS: Array<{ id: "all" | ActorKind; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "person", label: "People" },
  { id: "agent", label: "Agents" },
  { id: "import", label: "Imports" },
  { id: "board", label: "Boards" },
];

const dayLabel = (key: string) => {
  const today = dayKey(new Date().toISOString());
  if (key === today) return "Today";
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === yesterday) return "Yesterday";
  const d = new Date(`${key}T12:00:00`);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
};

const ago = (iso: string) => whenWords(iso, Date.now());

export function WhatChanged({ slug, events, cap }: { slug: string; events: GraphEvent[]; cap: number }) {
  const [filter, setFilter] = useState<"all" | ActorKind>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const out = new Map<string, number>([["all", events.length]]);
    for (const e of events) out.set(e.actor.kind, (out.get(e.actor.kind) ?? 0) + 1);
    return out;
  }, [events]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "all" && e.actor.kind !== filter) return false;
      if (!needle) return true;
      return e.entityName.toLowerCase().includes(needle) || describeActor(e.actor).toLowerCase().includes(needle) || e.field.toLowerCase().includes(needle);
    });
  }, [events, filter, q]);

  const days = useMemo(() => {
    const out: Array<{ key: string; events: GraphEvent[] }> = [];
    for (const e of shown) {
      const key = dayKey(e.at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.events.push(e);
      else out.push({ key, events: [e] });
    }
    return out;
  }, [shown]);

  const people = new Set(events.filter((e) => e.actor.kind === "person").map((e) => e.actor.id ?? e.actor.name));

  return (
    <section className="studio-home-main" aria-label="What changed">
      <header className="studio-home-topbar">
        <div>
          <span>The graph remembers</span>
          <h1>What changed</h1>
          <p className="roadmap-lede">
            Every change to the knowledge graph, and whose it was. Boards have version history; this is the
            same idea for the model itself — so &ldquo;who changed that, and from what&rdquo; is a question with an
            answer rather than an argument.
          </p>
        </div>
      </header>

      <div className="hx-toolbar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? "hx-chip on" : "hx-chip"}
            onClick={() => setFilter(f.id)}
            data-history-filter={f.id}
            disabled={f.id !== "all" && !counts.get(f.id)}
          >
            {f.label}
            <small>{counts.get(f.id) ?? 0}</small>
          </button>
        ))}
        <label className="hx-search">
          <Search size={13} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by object, person or field" aria-label="Filter the history" data-history-search />
        </label>
      </div>

      <p className="hx-summary" data-history-summary>
        {events.length === 0
          ? "Nothing recorded yet. The graph starts remembering from the next change anybody makes."
          : `${shown.length} of the last ${events.length} change${events.length === 1 ? "" : "s"}${events.length >= cap ? ` (the most recent ${cap})` : ""} · ${people.size} ${people.size === 1 ? "person" : "people"}`}
      </p>

      {days.length === 0 && events.length > 0 && <p className="muted">Nothing matches that.</p>}

      {days.map((day) => (
        <section key={day.key} className="hx-day">
          <h2><History size={13} /> {dayLabel(day.key)} <small>{day.events.length}</small></h2>
          <ol className="hx-timeline">
            {foldMoments(day.events).map((moment, i) => (
              <li key={`${moment.at}-${i}`}>
                <header>
                  <ActorChip actor={moment.actor} />
                  <time dateTime={moment.at} title={new Date(moment.at).toLocaleString()}>{ago(moment.at)}</time>
                  {moment.context && <small>{moment.context}</small>}
                </header>
                <ul>
                  {moment.events.map((e) => <EventLine key={e.id} event={e} withEntity href={`/e/${e.entityId}`} />)}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="hx-footnote">
        A change is only here if it reached the graph. Cards moved on a board, comments and drafts are the
        board&apos;s history, not the model&apos;s — see <Link href={`/w/${slug}/docs/what-changed`}>the documentation</Link>.
      </p>
    </section>
  );
}
