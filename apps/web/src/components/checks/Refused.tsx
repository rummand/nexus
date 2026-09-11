"use client";

import { AlertTriangle } from "lucide-react";
import type { Refusal } from "@/lib/checks/gate";

/**
 * What the checks said, at the moment of merging (§5.88).
 *
 * Deliberately not a dialog. The refusal is about specific objects, and the thing a person does
 * next is open one of them — so it names them, links to them, and puts the whole run one click
 * away. The override sits at the bottom of what it overrides rather than beside the button that
 * was refused, so nobody presses it without having read the reason.
 */
export function Refused({ slug, refusal, pending, onAnyway }: { slug: string; refusal: Refusal; pending: boolean; onAnyway: () => void }) {
  return (
    <div className="roadmap-refused" data-delivery-refused>
      <p><AlertTriangle size={13} /> {refusal.words} This would make the model worse than it is.</p>
      <ul>
        {refusal.named.map((f) => (
          <li key={`${f.subjectId}:${f.detail}`}>
            <a href={`/w/${slug}/fs/${f.subjectId}`}>{f.subjectName || "(unnamed)"}</a> <span>{f.detail}</span>
          </li>
        ))}
        {refusal.more > 0 && <li className="muted">…and {refusal.more} more.</li>}
      </ul>
      <div className="roadmap-refused-actions">
        <a className="ghost-button" href={`/w/${slug}/checks`}>See every check</a>
        <button type="button" className="ghost-button" disabled={pending} onClick={onAnyway} data-deliver-anyway>
          Deliver anyway
        </button>
      </div>
    </div>
  );
}
