import type { Divergence } from "@/lib/change/ref";

/**
 * A source branch, and what it is proposing (#139, §5.92).
 *
 * `main` stops being *what the last import wrote* and becomes **the reconciled model — what we
 * chose to believe after seeing what each source claims.** Each connected system gets one
 * long-lived branch that is re-synced rather than replaced, so re-reading LeanIX next month adds
 * commits to the branch that is already open instead of leaving a graveyard of one-shot imports
 * nobody merged.
 *
 * The payoff is what happens when two sources disagree: that is a **merge conflict with both
 * claims visible**, rather than last-write-wins at three in the morning. And when reality moves,
 * the branch diverges on its own and says so — *reality proposes 34 changes to the model* — which
 * is a far better artefact than a health score, because it is specific, reviewable, and it either
 * gets merged or it gets an argument. A score that has been amber for six months is neither.
 */

/** The name a source's standing branch carries, which is a sentence rather than a label. */
export function standingBranchName(sourceName: string): string {
  return `What ${sourceName} says`.slice(0, 120);
}

/** How a source branch describes itself where a plan would describe its target date. */
export function sourceBranchMeans(sourceName: string): string {
  return `a standing claim from ${sourceName}, reconciled deliberately`;
}

/**
 * What the branch is proposing, in one sentence.
 *
 * Deliberately in the source's own voice — "ServiceNow proposes 34 changes" — rather than the
 * passive "34 changes are pending". The first names somebody answerable for the claim, which is
 * the whole reason for putting a source behind a branch at all.
 */
export function driftWords(sourceName: string, divergence: Divergence): string {
  if (!divergence.total) return `${sourceName} agrees with the model.`;
  const parts: string[] = [];
  if (divergence.introduces) parts.push(`${divergence.introduces} object${divergence.introduces === 1 ? "" : "s"} we do not have`);
  if (divergence.changes) parts.push(`${divergence.changes} it says we have wrong`);
  if (divergence.retires) parts.push(`${divergence.retires} it no longer sees`);
  if (divergence.connects) parts.push(`${divergence.connects} connection${divergence.connects === 1 ? "" : "s"}`);
  return `${sourceName} proposes ${divergence.total} change${divergence.total === 1 ? "" : "s"} to the model: ${parts.join(", ")}.`;
}

/**
 * How long a branch has been waiting, and when that stops being fine.
 *
 * The long-lived-branch rot problem in its most likely form (#133 §7): a source branch nobody
 * ever merges, quietly accumulating a year of claims until the diff is unreviewable and the only
 * honest option is to throw it away. Saying so at three weeks is cheap; discovering it at nine
 * months is not.
 */
export const STALE_DAYS = 21;

export function stalenessOf(lastMergedAt: string, now: Date): { days: number; stale: boolean } {
  const since = lastMergedAt ? new Date(lastMergedAt).getTime() : 0;
  if (!since || Number.isNaN(since)) return { days: 0, stale: false };
  const days = Math.max(0, Math.floor((now.getTime() - since) / 86_400_000));
  return { days, stale: days >= STALE_DAYS };
}

/** The nudge, when one is due. Empty when the branch is fresh, so nothing nags for no reason. */
export function stalenessWords(sourceName: string, lastMergedAt: string, divergence: Divergence, now: Date): string {
  const { days, stale } = stalenessOf(lastMergedAt, now);
  if (!stale || !divergence.total) return "";
  return `Nobody has reconciled ${sourceName} for ${days} days, and it is now ${divergence.total} change${divergence.total === 1 ? "" : "s"} away from the model. A branch this far behind gets harder to review every week.`;
}
