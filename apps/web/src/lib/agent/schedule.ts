/**
 * When an agent runs without being asked.
 *
 * The design note put this off deliberately — *"a schedule is a trigger, and a trigger needs a
 * runtime; both come later"* — and everything it was waiting for now exists: definitions with a
 * scope and an owner, budgets counted before the model is called, a run log, refusals that are
 * written down. What was missing was the clock.
 *
 * **Intervals, not times of day.** "Every night at 02:00" needs a timezone, and this product does
 * not know one: a workspace is an organisation, not a place, and an EA team at an energy operator
 * is not all in Denmark. So a daily agent is one that runs when it has not run for a day. It
 * drifts, which is the honest cost, and it never runs twice because somebody's clocks went back.
 *
 * Nothing here reads the database or the clock — `now` and `lastRunAt` are arguments. That is what
 * lets the awkward cases (a brand-new agent, a paused one, a clock that went backwards) be tested
 * rather than reasoned about.
 */

export const TRIGGERS = ["manual", "hourly", "daily", "weekly"] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const isTrigger = (v: string): v is Trigger => (TRIGGERS as readonly string[]).includes(v);

/** How long between runs, in milliseconds. `manual` has no period: it never becomes due. */
const PERIOD: Record<Trigger, number> = {
  manual: 0,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export const TRIGGER_LABEL: Record<Trigger, string> = {
  manual: "Only when asked",
  hourly: "About once an hour",
  daily: "About once a day",
  weekly: "About once a week",
};

/**
 * What the schedule costs against the budget, so a person choosing one can see the arithmetic.
 *
 * An hourly agent wants 24 runs a day and the default budget allows 12, which is the sort of thing
 * that is obvious in a table and invisible in a form.
 */
export function runsPerDayFor(trigger: Trigger): number {
  return trigger === "manual" ? 0 : Math.max(1, Math.round(86_400_000 / PERIOD[trigger]));
}

export interface Schedulable {
  id: string;
  workspaceId: string;
  name: string;
  trigger: Trigger;
  /** Only an active agent runs unattended. A draft's dry run is something a person asks for. */
  status: string;
  /** ISO of the last run of any outcome, or null if it has never run. */
  lastRunAt: string | null;
}

/**
 * Is this agent due?
 *
 * A never-run scheduled agent is due immediately. That is deliberate: somebody who sets an agent
 * to "daily" wants to see what it does, and making them wait a day to find out whether they wrote
 * a good purpose is a bad first experience — and the budget still bounds what it can cost.
 */
export function isDue(agent: Schedulable, now: number): boolean {
  if (agent.trigger === "manual" || agent.status !== "active") return false;
  if (!agent.lastRunAt) return true;
  const last = Date.parse(agent.lastRunAt);
  // An unparseable or future timestamp is treated as "just ran": a corrupt row must not become a
  // reason to call a model in a loop.
  if (!Number.isFinite(last) || last > now) return false;
  return now - last >= PERIOD[agent.trigger];
}

/** When this agent next becomes due, or null when nothing will make it due. */
export function nextDue(agent: Schedulable, now: number): string | null {
  if (agent.trigger === "manual" || agent.status !== "active") return null;
  if (!agent.lastRunAt) return new Date(now).toISOString();
  const last = Date.parse(agent.lastRunAt);
  if (!Number.isFinite(last)) return new Date(now).toISOString();
  return new Date(Math.max(now, last + PERIOD[agent.trigger])).toISOString();
}

/**
 * The agents to run on this tick, in the order they should go.
 *
 * Oldest first, so a fleet that has been asleep — the server was down, nobody visited — catches up
 * fairly rather than letting whichever agent sorts first take the whole budget. `limit` bounds one
 * tick: unattended work that can start twenty model calls at once is a way to discover a bill.
 */
export function dueAgents<T extends Schedulable>(agents: T[], now: number, limit = 3): T[] {
  return agents
    .filter((a) => isDue(a, now))
    .sort((a, b) => (a.lastRunAt ?? "") .localeCompare(b.lastRunAt ?? ""))
    .slice(0, limit);
}
