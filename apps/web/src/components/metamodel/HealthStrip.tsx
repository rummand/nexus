"use client";

import type { Health, Only } from "@/lib/metamodel-board";

/**
 * The two numbers, and the sentence that says which one is the problem (§5.66).
 *
 * Conformance used to be a badge on the fourth tab: forty-one breaches, invisible until somebody
 * happened to click. The two figures that describe the health of a meta-model belong at the top
 * of the page about the meta-model, and each of them is a filter, because a number you cannot act
 * on is decoration.
 *
 * Both are shown for a reason neither survives alone: a model describing four per cent of the
 * estate perfectly reports 100% conformance, and one describing all of it while everything breaks
 * reports 100% coverage. Two bars and one sentence is the smallest honest version.
 */
export function HealthStrip({ state, only, onOnly }: {
  state: Health;
  only: Only;
  onOnly: (next: Only) => void;
}) {
  const chip = (key: Only, n: number, label: string) => (
    <button
      type="button"
      className={`meta-chip ${only === key ? "on" : ""} ${n > 0 ? "live" : ""}`}
      disabled={n === 0 && key !== "all"}
      onClick={() => onOnly(only === key ? "all" : key)}
      data-meta-filter={key}
    >
      <b>{n}</b> {label}
    </button>
  );

  return (
    <section className="meta-health" data-meta-health>
      <div className="meta-health-bars">
        <Gauge label="Described" value={state.coverage} hint="Share of the estate whose type is declared at all." />
        <Gauge label="Conforming" value={state.conformance} hint="Of what is described, the share breaking no rule. Undefined until something is described." />
      </div>
      <p className="meta-verdict" data-meta-verdict>{state.verdict}</p>
      <div className="meta-chips">
        {chip("attention", state.needsAttention, "need you")}
        {chip("undeclared", state.undeclared, "undeclared")}
        {chip("breaches", state.breaches, state.breaches === 1 ? "breach" : "breaches")}
      </div>
    </section>
  );
}

/**
 * A bar rather than a ring or a number alone.
 *
 * A percentage as text is read; a bar is *seen*, and the thing being asked here — "are we near
 * the top or nowhere near it" — is a comparison, which is what a length is for.
 */
function Gauge({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  /*
   * Null is not zero and it is not a hundred. A model describing none of the estate has no
   * conforming instances and no breaking ones, so the ratio is undefined — and a full green bar
   * beside "0% described" was the page telling its most flattering possible lie.
   */
  if (value === null) {
    return (
      <div className="meta-gauge none" title={hint}>
        <span className="meta-gauge-label">{label}</span>
        <span className="meta-gauge-value">—</span>
        <span className="meta-gauge-track" />
      </div>
    );
  }
  const tone = value >= 90 ? "good" : value >= 60 ? "fair" : "poor";
  return (
    <div className={`meta-gauge ${tone}`} title={hint}>
      <span className="meta-gauge-label">{label}</span>
      <span className="meta-gauge-value">{value}%</span>
      <span className="meta-gauge-track"><i style={{ width: `${Math.max(2, value)}%` }} /></span>
    </div>
  );
}
