import { foldMoments, whenWords, type GraphEvent } from "@/lib/history/events";
import { ActorChip, EventLine } from "./EventLine";

/**
 * One entity's life, newest first (§5.43).
 *
 * Folded into moments — one actor, one place, one burst — because a board save that touched three
 * attributes is one thing a person did, and printing it as three rows with the same name and the
 * same minute hides the shape of it.
 *
 * The clock is read inside `ago` rather than in the JSX: calling `Date.now()` during render is
 * impure and the compiler is right to say so.
 */

const ago = (iso: string) => whenWords(iso, Date.now());

export function Timeline({ events, withEntity = false, empty = "Nothing has happened to this yet." }: { events: GraphEvent[]; withEntity?: boolean; empty?: string }) {
  if (!events.length) return <p className="muted">{empty}</p>;
  return (
    <ol className="hx-timeline" data-timeline>
      {foldMoments(events).map((moment, i) => (
        <li key={`${moment.at}-${i}`}>
          <header>
            <ActorChip actor={moment.actor} />
            <time dateTime={moment.at} title={new Date(moment.at).toLocaleString()}>{ago(moment.at)}</time>
            {moment.context && <small>{moment.context}</small>}
          </header>
          <ul>
            {moment.events.map((e) => <EventLine key={e.id} event={e} withEntity={withEntity} />)}
          </ul>
        </li>
      ))}
    </ol>
  );
}
