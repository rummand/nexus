"use client";

import { ArrowRight, SearchX } from "lucide-react";
import type { Evidence } from "@/lib/query-evidence";

/**
 * What the model does not know (§5.69).
 *
 * Rendered wherever a query can come back empty. The banner replaces "No entity matches" —
 * a sentence that reports the query's outcome and says nothing about the estate — with the
 * finding underneath it: the name is not a thing here; this relationship type exists nowhere;
 * nobody has recorded anything in that direction.
 *
 * The pivots are the other half. An unanswerable question is only useful if the next question
 * is one click away, and each pivot carries the count it would return, so a pivot that also
 * leads nowhere is visible as one before it is clicked.
 */

const TONE: Record<Evidence["kind"], string> = {
  none: "",
  "unknown-seed": "miss",
  "unknown-relation": "miss",
  "unknown-kind": "miss",
  "no-evidence": "gap",
  "over-filtered": "narrow",
  "empty-workspace": "narrow",
};

export function EvidenceGap({ evidence, onPivot }: {
  evidence: Evidence;
  /** Run a pivot query. Omit to render the pivots as inert text. */
  onPivot?: (query: string) => void;
}) {
  if (evidence.kind === "none") return null;

  return (
    <div className={`evidence-gap ${TONE[evidence.kind]}`} data-evidence={evidence.kind}>
      <p className="evidence-head">
        <SearchX size={13} />
        <span data-evidence-headline>{evidence.headline}</span>
      </p>
      {evidence.detail && <p className="evidence-detail">{evidence.detail}</p>}
      {evidence.pivots.length > 0 && (
        <div className="evidence-pivots">
          <em>Try instead</em>
          {evidence.pivots.map((p) => (
            <button
              key={p.query}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPivot?.(p.query)}
              disabled={!onPivot}
              title={p.query}
              data-evidence-pivot={p.query}
            >
              <span>{p.label}</span>
              <b>{p.count}</b>
              <ArrowRight size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
