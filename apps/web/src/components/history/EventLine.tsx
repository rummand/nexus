import Link from "next/link";
import { Bot, DownloadCloud, LayoutGrid, Cpu, Sparkles, User } from "lucide-react";
import type { Actor, ActorKind, GraphEvent } from "@/lib/history/events";
import { describeActor, describeChange } from "@/lib/history/events";

/**
 * One line of the graph's memory (§5.43).
 *
 * Shared by the entity drawer and the workspace history, deliberately: the sentence a change makes
 * has to be the same sentence wherever it is read, or two screens quietly start telling different
 * stories about the same row.
 */

export const ACTOR_ICON: Record<ActorKind, React.ReactNode> = {
  person: <User size={12} />,
  agent: <Bot size={12} />,
  import: <DownloadCloud size={12} />,
  board: <LayoutGrid size={12} />,
  rules: <Sparkles size={12} />,
  system: <Cpu size={12} />,
};

export function ActorChip({ actor }: { actor: Actor }) {
  return (
    <span className={`hx-actor ${actor.kind}`} title={`${describeActor(actor)} · ${actor.kind}`}>
      {ACTOR_ICON[actor.kind]}
      <b>{describeActor(actor)}</b>
    </span>
  );
}

/** The change itself, without the actor: who did it is on the moment above. */
export function EventLine({ event, withEntity, href }: { event: GraphEvent; withEntity?: boolean; href?: string }) {
  return (
    <li className={`hx-line ${event.kind}`}>
      <i aria-hidden />
      <span>
        {withEntity && <b>{event.entityName || "An object"}</b>}
        {describeChange(event)}
      </span>
      {href && <Link className="hx-open" href={href} title={`Open ${event.entityName}`}>open</Link>}
    </li>
  );
}
