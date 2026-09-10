"use client";

import { AlertTriangle, Spline } from "lucide-react";
import type { TypeCard } from "@/lib/metamodel-board";

/**
 * One type, as a card (§5.66).
 *
 * The old tree gave every type an identical row: a caret, a dash, a name, a dot and a count.
 * Eighteen of those is a list you read once and never scan again, because nothing about a row
 * tells you whether it is the important one.
 *
 * A card carries the four facts that separate types from each other, in the order they are asked:
 * what it is called, how much of the estate it accounts for, whether it was **declared or merely
 * grew from the data** — the distinction this whole product is about, so it gets the strongest
 * signal on the card, a dashed border — and the one thing it needs doing.
 *
 * The nudge is a single sentence and never a list. A card enumerating everything wrong with it is
 * a report, and nobody works from a report; a card naming the next action is a worklist.
 */
export function TypeCardTile({ card, selected, onSelect, quiet = false }: {
  card: TypeCard;
  selected: boolean;
  onSelect: () => void;
  /** The band above already said what every card here says, so this one does not repeat it. */
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "meta-card",
        card.declared ? "declared" : "emergent",
        selected ? "on" : "",
        card.nudge ? `nudge-${card.nudge.kind}` : "",
      ].filter(Boolean).join(" ")}
      onClick={onSelect}
      data-meta-card={card.name}
      data-declared={card.declared ? "yes" : "no"}
    >
      <span className="meta-card-head">
        {card.kind === "node"
          ? <i className="meta-card-swatch" style={{ background: card.color }} />
          : <Spline size={13} className="meta-card-rel" />}
        <b>{card.name}</b>
        {card.framework && <em className="meta-card-fw" title={`Declared by ${card.framework}`}>{card.framework}</em>}
      </span>

      <span className="meta-card-counts">
        <span><b>{card.instances.toLocaleString()}</b> {card.kind === "node" ? (card.instances === 1 ? "object" : "objects") : (card.instances === 1 ? "link" : "links")}</span>
        {card.declaredParts > 0 && (
          <span><b>{card.declaredParts}</b> {card.kind === "node" ? (card.declaredParts === 1 ? "field" : "fields") : (card.declaredParts === 1 ? "rule" : "rules")}</span>
        )}
      </span>

      {card.description && <span className="meta-card-desc">{card.description}</span>}

      {quiet ? null : card.nudge ? (
        <span className={`meta-card-nudge ${card.nudge.kind}`}>
          {card.nudge.kind === "breaches" && <AlertTriangle size={11} />}
          {card.nudge.text}
        </span>
      ) : (
        /* Silence would read as "not loaded". One quiet word says the card is finished. */
        <span className="meta-card-nudge ok">Declared, and the data obeys it</span>
      )}
    </button>
  );
}
