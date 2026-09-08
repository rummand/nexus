"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bot, Check, ShieldAlert, Sparkles, X } from "lucide-react";
import type { Digest } from "@/lib/agent/digest";
import { summarise } from "@/lib/agent/digest";

/**
 * While you were away (§5.42).
 *
 * The other half of a fleet that runs on a schedule. Agents working overnight is only interesting
 * if a person coming back finds out, and finding out has to take one glance — a panel you have to
 * open is a panel that answers "did anything happen" with "go and look", which is the question.
 *
 * Three rules it keeps:
 *
 * - **Silence when nothing happened.** No manufactured bullet points out of an empty night. The
 *   moment it pads is the moment it stops being read, and then the one morning it matters it is
 *   already invisible.
 * - **Refusals first.** An agent that stopped because it hit its budget is the fact somebody most
 *   needs and least expects, so it is not at the bottom under the good news.
 * - **Dismissing is the only thing that moves the window.** Reading is not dismissing; a glance on
 *   a phone should not cost you the digest you meant to read properly.
 */
export function WhileYouWereAway({ digest, slug }: { digest: Digest; slug: string }) {
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  const line = summarise(digest);
  if (!line || gone) return null;

  const dismiss = () => {
    setGone(true);
    start(async () => {
      await fetch("/api/digest", { method: "POST" }).catch(() => undefined);
    });
  };

  return (
    <section className="away-panel" aria-label="While you were away" data-digest>
      <header>
        <span className="away-mark" aria-hidden><Sparkles size={15} /></span>
        <div>
          <b>While you were away</b>
          <span>{line}</span>
        </div>
        <button type="button" onClick={dismiss} disabled={pending} title="Mark as read" aria-label="Mark as read" data-digest-dismiss>
          <X size={15} />
        </button>
      </header>

      {digest.refusals.length > 0 && (
        <ul className="away-refusals">
          {digest.refusals.map((r, i) => (
            <li key={i}>
              <ShieldAlert size={13} />
              <b>{r.agentName}</b> did not run — {r.note}
            </li>
          ))}
        </ul>
      )}

      {digest.runs.length > 0 && (
        <ul className="away-runs">
          {digest.runs.slice(0, 5).map((r) => (
            <li key={r.id}>
              <Bot size={13} />
              <b>{r.agentName}</b>
              <em>{r.trigger}</em>
              {r.outcome === "ok"
                ? <span>{r.proposed} proposal{r.proposed === 1 ? "" : "s"}</span>
                : <span className="away-bad">{r.outcome}</span>}
            </li>
          ))}
        </ul>
      )}

      {digest.proposals.length > 0 && (
        <ol className="away-proposals">
          {digest.proposals.map((p) => (
            <li key={p.id}>
              <i className={`away-dot ${p.confidence}`} aria-hidden />
              <span>{p.title}</span>
              <small>{p.agentName}</small>
            </li>
          ))}
        </ol>
      )}

      <footer>
        {digest.waiting > 0 && (
          <Link href={`/w/${slug}/graph`} className="ghost-button">
            Review {digest.waiting} proposal{digest.waiting === 1 ? "" : "s"}
          </Link>
        )}
        {(digest.accepted > 0 || digest.dismissed > 0) && (
          <span className="away-decided">
            <Check size={13} /> {digest.accepted} accepted, {digest.dismissed} dismissed since you last looked
          </span>
        )}
        <Link href={`/w/${slug}/agents`} className="away-fleet">The fleet →</Link>
      </footer>
    </section>
  );
}
