"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ChevronDown, ChevronRight, Quote } from "lucide-react";
import type { HealthReport, Measure } from "@/lib/health";
import { healthLabel } from "@/lib/health";

/**
 * Estate health.
 *
 * One number, and the six things behind it. Every measure names what good looks like, how far off
 * this workspace is, and what would move it — because a warning that repeats without an action
 * teaches people to read past it.
 */

/** Where the fix lives, so a number is one click from the work. */
const DESTINATION: Record<Measure["id"], { href: (slug: string) => string; label: string }> = {
  provenance: { href: (slug) => `/w/${slug}/intake?view=catalog`, label: "Open Intake" },
  duplicates: { href: () => "#proposals", label: "See the proposals" },
  untyped: { href: (slug) => `/w/${slug}/meta`, label: "Open the meta-model" },
  orphans: { href: (slug) => `/w/${slug}/explore`, label: "Open the explorer" },
  ownership: { href: () => "#entities", label: "Open the entity table" },
  lifecycle: { href: () => "#entities", label: "Open the entity table" },
};

/** The practice behind a measure, from the knowledge base (§5.20). Empty when no corpus is built. */
export type Authority = Record<string, { statement: string; quote: string; title: string; url: string }>;

export function HealthPanel({ report, slug, proposed, onShowEntities, authority = {} }: {
  report: HealthReport;
  slug: string;
  /** How many of each measure the agent can already propose a fix for. */
  proposed: Partial<Record<Measure["id"], number>>;
  /** Filter the entity table to the offenders behind one measure. */
  onShowEntities: (ids: string[], name: string) => void;
  /** What the literature says each measure is for; shown under the goal. */
  authority?: Authority;
}) {
  const [open, setOpen] = useState(false);
  const worst = [...report.measures].sort((a, b) => a.score - b.score)[0];

  return (
    <section className="health-panel" data-health>
      <button type="button" className="health-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`health-score ${band(report.score)}`}>{report.score}</span>
        <span className="health-headline">
          <strong>Estate health · {healthLabel(report.score)}</strong>
          <em>
            {report.entities} entities, {report.relations} relations
            {worst && worst.offenders > 0 ? ` · weakest: ${worst.name.toLowerCase()}, ${worst.offenders} to fix` : " · nothing outstanding"}
          </em>
        </span>
        <Activity size={16} />
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <ul className="health-measures">
          {report.measures.map((m) => (
            <li key={m.id} className={band(m.score)} data-measure={m.id}>
              <div className="health-measure-head">
                <b>{m.name}</b>
                <span className="health-bar"><i style={{ width: `${m.score}%` }} /></span>
                <em>{m.score}</em>
              </div>
              <p className="health-goal">{m.goal}</p>
              <p className="health-detail">{m.detail}</p>
              {authority[m.id] && (
                <details className="health-authority">
                  <summary><Quote size={11} /> {authority[m.id]!.statement}</summary>
                  <blockquote>
                    {authority[m.id]!.quote}
                    <a href={authority[m.id]!.url} target="_blank" rel="noreferrer noopener">{authority[m.id]!.title}</a>
                  </blockquote>
                </details>
              )}
              {m.offenders > 0 && (
                <div className="health-actions">
                  <span>{m.fix}</span>
                  {(proposed[m.id] ?? 0) > 0 && (
                    <a className="ghost-button" href="#proposals">
                      {proposed[m.id]} already proposed from evidence
                    </a>
                  )}
                  {DESTINATION[m.id].href(slug).startsWith("#") ? (
                    <button type="button" className="ghost-button" onClick={() => onShowEntities(m.entityIds, m.name)}>
                      Show the {m.offenders}
                    </button>
                  ) : (
                    <Link className="ghost-button" href={DESTINATION[m.id].href(slug)}>{DESTINATION[m.id].label}</Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const band = (score: number) => (score >= 90 ? "good" : score >= 70 ? "fair" : score >= 50 ? "poor" : "bad");
