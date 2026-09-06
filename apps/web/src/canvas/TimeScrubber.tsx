"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Play, Square } from "lucide-react";
import { useCanvas, useCanvasStore, type ChangeOverlay } from "./store";

/**
 * Drag the board through time.
 *
 * The roadmap can tell you what changes between two states, and the board can be tinted by one
 * plan. This is the thing both were building towards: a timeline under the canvas that you scrub,
 * so a landscape visibly becomes its own future — systems fading as they retire, planned ones
 * arriving, the ones changing hands flashing as they pass.
 *
 * It matters more than it sounds. An architecture audience does not read a diff table; it watches
 * the picture move, and remembers which box went grey.
 *
 * Every stop is fetched once and kept, so scrubbing is instant and the animation is the browser's
 * rather than the network's.
 */

interface Stop {
  /** "" for as-is, otherwise the value the overlay API is keyed by. */
  value: string;
  label: string;
  date: string;
  kind: "as-is" | "plateau" | "change";
}

const STEP_MS = 1100;

export function TimeScrubber() {
  const store = useCanvasStore();
  const workspaceId = useCanvas((s) => s.workspaceId);
  const overlay = useCanvas((s) => s.changeOverlay);
  const [stops, setStops] = useState<Stop[]>([]);
  const [playing, setPlaying] = useState(false);
  /** Overlays already fetched, so moving back and forth costs nothing. */
  const cache = useRef(new Map<string, ChangeOverlay | null>());

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/plateaus?workspaceId=${encodeURIComponent(workspaceId)}`).then((r) => (r.ok ? r.json() : { plateaus: [] })),
      fetch(`/api/change-sets?workspaceId=${encodeURIComponent(workspaceId)}`).then((r) => (r.ok ? r.json() : { changeSets: [] })),
    ])
      .then(([p, c]: [{ plateaus: Array<{ id: string; name: string; targetDate: string }> }, { changeSets: Array<{ id: string; name: string; status: string; targetDate: string }> }]) => {
        if (cancelled) return;
        /*
         * Plateaus are the stops when a workspace has them: they are the states people named, and
         * a timeline of everything at once is a timeline nobody reads. Change sets stand in only
         * when nobody has named a state yet, so the control is useful before that work is done.
         */
        const plateaus: Stop[] = p.plateaus.map((x) => ({ value: `plt:${x.id}`, label: x.name, date: x.targetDate, kind: "plateau" }));
        const changes: Stop[] = c.changeSets
          .filter((x) => x.status !== "abandoned")
          .map((x) => ({ value: `chg:${x.id}`, label: x.name, date: x.targetDate, kind: "change" }));
        const chosen = plateaus.length ? plateaus : changes;
        if (!chosen.length) return;
        setStops([{ value: "", label: "Today", date: "", kind: "as-is" }, ...chosen.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))]);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspaceId]);

  const show = useCallback(async (stop: Stop) => {
    const state = store.getState();
    if (!stop.value) {
      state.setChangeOverlay(null);
      return;
    }
    const cached = cache.current.get(stop.value);
    if (cached !== undefined) {
      state.setChangeOverlay(cached);
      return;
    }
    const [kind, id] = stop.value.split(":");
    const res = await fetch(kind === "plt" ? `/api/plateaus/${id}/overlay` : `/api/change-sets/${id}/overlay`).catch(() => null);
    if (!res?.ok) {
      cache.current.set(stop.value, null);
      return;
    }
    const data = (await res.json()) as { name: string; targetDate: string; retired: string[]; changed: string[]; added: Array<{ id: string; name: string; kind: string; description: string }>; impact: string };
    const built: ChangeOverlay = {
      id: stop.value, name: data.name, targetDate: data.targetDate,
      retired: new Set(data.retired), changed: new Set(data.changed), added: data.added, impact: data.impact,
    };
    cache.current.set(stop.value, built);
    store.getState().setChangeOverlay(built);
  }, [store]);

  /**
   * Where the scrubber is, derived from the overlay rather than tracked beside it.
   *
   * An index of its own raced the fetch: clicking a stop set the index, the effect that returns
   * the scrubber to today saw an overlay that had not arrived yet, and put it straight back to
   * zero while the board went on to show the future. One source of truth removes the race
   * instead of timing around it — and it means turning the overlay off anywhere else moves the
   * scrubber too, for free.
   */
  const index = Math.max(0, stops.findIndex((s) => s.value === (overlay?.id ?? "")));

  const goTo = useCallback((next: number) => {
    const stop = stops[Math.max(0, Math.min(stops.length - 1, next))];
    if (stop) void show(stop);
  }, [stops, show]);

  const atEnd = index >= stops.length - 1;
  /*
   * Playing is "wants to play, and there is somewhere to go". Clearing the flag inside the effect
   * when the end arrives would be a setState in an effect body — a cascading render, and the lint
   * rule that says so is right: the end of the roadmap is derivable, not an event.
   */
  const isPlaying = playing && !atEnd;

  // Play through once and stop, rather than looping: a loop makes it an ornament, and this is
  // meant to be watched once and talked about.
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => goTo(index + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, index, goTo]);

  const current = stops[index];
  const counts = useMemo(() => {
    if (!overlay) return null;
    return { added: overlay.added.length, retired: overlay.retired.size, changed: overlay.changed.size };
  }, [overlay]);

  if (stops.length < 2) return null;

  return (
    <section className="time-scrubber" data-scrubber onPointerDown={(e) => e.stopPropagation()} aria-label="Move the board through time">
      <button
        type="button"
        className="time-scrubber-play"
        onClick={() => {
          if (isPlaying) { setPlaying(false); return; }
          if (atEnd) goTo(0);
          setPlaying(true);
        }}
        aria-label={isPlaying ? "Stop" : "Play through the roadmap"}
      >
        {isPlaying ? <Square size={13} /> : <Play size={13} />}
      </button>
      <button type="button" className="time-scrubber-step" onClick={() => { setPlaying(false); goTo(index - 1); }} disabled={index === 0} aria-label="Previous state"><ChevronLeft size={15} /></button>

      <ol className="time-scrubber-track">
        {stops.map((stop, i) => (
          <li key={stop.value || "as-is"} className={i === index ? "active" : i < index ? "past" : ""}>
            <button type="button" onClick={() => { setPlaying(false); goTo(i); }} title={stop.date ? `${stop.label} · ${stop.date}` : stop.label}>
              <i />
              <span>{stop.label}</span>
              {stop.date && <small>{stop.date}</small>}
            </button>
          </li>
        ))}
      </ol>

      <button type="button" className="time-scrubber-step" onClick={() => { setPlaying(false); goTo(index + 1); }} disabled={atEnd} aria-label="Next state"><ChevronRight size={15} /></button>

      <div className="time-scrubber-readout">
        <CalendarClock size={13} />
        {current?.kind === "as-is" || !counts ? (
          <span>The estate as it is</span>
        ) : (
          <span>
            {counts.added > 0 && <b className="added">+{counts.added}</b>}
            {counts.retired > 0 && <b className="retired">−{counts.retired}</b>}
            {counts.changed > 0 && <b className="changed">~{counts.changed}</b>}
            {current?.label}
          </span>
        )}
      </div>
    </section>
  );
}
