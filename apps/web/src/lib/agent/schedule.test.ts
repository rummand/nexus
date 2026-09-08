import { describe, expect, it } from "vitest";
import { dueAgents, isDue, nextDue, runsPerDayFor, type Schedulable } from "./schedule";
import { summarise } from "./digest";
import { checkDefinition } from "./definition";

/**
 * The clock, and the arithmetic it does.
 *
 * Unattended work is the one place a bug costs money rather than a redraw, so the cases that
 * matter here are the ones nobody would think to click: a corrupt timestamp, a clock that went
 * backwards, a paused agent, a fleet that was asleep for a week. Everything is a pure function of
 * `now` and `lastRunAt`, which is what makes them testable at all.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-09-08T09:00:00.000Z");

const agent = (over: Partial<Schedulable> = {}): Schedulable => ({
  id: "a1",
  workspaceId: "ws",
  name: "Model reviewer",
  trigger: "daily",
  status: "active",
  lastRunAt: new Date(NOW - DAY).toISOString(),
  ...over,
});

describe("is it due", () => {
  it("waits out the interval, then goes", () => {
    expect(isDue(agent({ lastRunAt: new Date(NOW - DAY + 60_000).toISOString() }), NOW)).toBe(false);
    expect(isDue(agent({ lastRunAt: new Date(NOW - DAY).toISOString() }), NOW)).toBe(true);
    expect(isDue(agent({ trigger: "hourly", lastRunAt: new Date(NOW - HOUR).toISOString() }), NOW)).toBe(true);
    expect(isDue(agent({ trigger: "weekly", lastRunAt: new Date(NOW - DAY).toISOString() }), NOW)).toBe(false);
  });

  it("runs a brand-new scheduled agent straight away", () => {
    // Somebody who sets an agent to "daily" wants to see what it does. Making them wait a day to
    // find out whether they wrote a good purpose is a bad first hour with the product.
    expect(isDue(agent({ lastRunAt: null }), NOW)).toBe(true);
  });

  it("never runs a manual agent, however long it has been", () => {
    expect(isDue(agent({ trigger: "manual", lastRunAt: null }), NOW)).toBe(false);
    expect(isDue(agent({ trigger: "manual", lastRunAt: new Date(NOW - 400 * DAY).toISOString() }), NOW)).toBe(false);
  });

  it("only runs an active agent", () => {
    for (const status of ["draft", "paused", "retired", "proposed"]) {
      expect(isDue(agent({ status, lastRunAt: null }), NOW)).toBe(false);
    }
  });

  it("treats a broken or future timestamp as just-ran rather than as overdue", () => {
    // A corrupt row must not become a reason to call a model every five minutes for ever.
    expect(isDue(agent({ lastRunAt: "not a date" }), NOW)).toBe(false);
    expect(isDue(agent({ lastRunAt: new Date(NOW + DAY).toISOString() }), NOW)).toBe(false);
  });
});

describe("when next", () => {
  it("is one interval after the last run, and now for one that has never run", () => {
    expect(nextDue(agent({ lastRunAt: new Date(NOW - HOUR).toISOString() }), NOW)).toBe(new Date(NOW - HOUR + DAY).toISOString());
    expect(nextDue(agent({ lastRunAt: null }), NOW)).toBe(new Date(NOW).toISOString());
  });

  it("is never, for anything that will not run by itself", () => {
    expect(nextDue(agent({ trigger: "manual" }), NOW)).toBeNull();
    expect(nextDue(agent({ status: "paused" }), NOW)).toBeNull();
  });

  it("never points at the past, however overdue", () => {
    const late = nextDue(agent({ lastRunAt: new Date(NOW - 30 * DAY).toISOString() }), NOW);
    expect(Date.parse(late!)).toBeGreaterThanOrEqual(NOW);
  });
});

describe("what to run on one tick", () => {
  it("takes the most overdue first, so a fleet that was asleep catches up fairly", () => {
    const fleet = [
      agent({ id: "recent", lastRunAt: new Date(NOW - DAY - HOUR).toISOString() }),
      agent({ id: "ancient", lastRunAt: new Date(NOW - 9 * DAY).toISOString() }),
      agent({ id: "middling", lastRunAt: new Date(NOW - 3 * DAY).toISOString() }),
    ];
    expect(dueAgents(fleet, NOW).map((a) => a.id)).toEqual(["ancient", "middling", "recent"]);
  });

  it("bounds one tick, because unattended work that fans out is how you find a bill", () => {
    const fleet = Array.from({ length: 20 }, (_, i) => agent({ id: `a${i}`, lastRunAt: null }));
    expect(dueAgents(fleet, NOW)).toHaveLength(3);
    expect(dueAgents(fleet, NOW, 1)).toHaveLength(1);
  });

  it("leaves out everything that is not due", () => {
    const fleet = [
      agent({ id: "manual", trigger: "manual", lastRunAt: null }),
      agent({ id: "paused", status: "paused", lastRunAt: null }),
      agent({ id: "fresh", lastRunAt: new Date(NOW - HOUR).toISOString() }),
    ];
    expect(dueAgents(fleet, NOW)).toEqual([]);
  });
});

describe("what a schedule costs", () => {
  it("says how many runs a day it wants, so the budget clash is visible in the form", () => {
    expect(runsPerDayFor("hourly")).toBe(24);
    expect(runsPerDayFor("daily")).toBe(1);
    expect(runsPerDayFor("weekly")).toBe(1); // rounded up: never zero, or the warning reads as free
    expect(runsPerDayFor("manual")).toBe(0);
  });
});

describe("saving a schedule", () => {
  const ctx = { teamIds: new Set(["t1"]), providerIds: new Set<string>() };
  const base = { name: "Night watch", purpose: "Look over the estate.", ownerTeamId: "t1", scope: "kind:Application", verbs: ["setKind"] };

  it("keeps the schedule somebody chose", () => {
    /*
     * The bug this exists to prevent, and the one the browser suite actually caught: the validator
     * hardcoded "manual", so the form offered a schedule, said it had saved, and threw it away.
     */
    const checked = checkDefinition({ ...base, trigger: "daily" }, ctx);
    expect(checked.ok && checked.value.trigger).toBe("daily");
  });

  it("falls back to manual for anything it does not recognise", () => {
    // It arrives from a form. An unreadable value must cost nothing, not confuse the scheduler.
    for (const trigger of ["", "hourly-ish", "0 2 * * *", undefined]) {
      const checked = checkDefinition({ ...base, trigger }, ctx);
      expect(checked.ok && checked.value.trigger).toBe(trigger === "hourly-ish" || trigger === "0 2 * * *" || trigger === "" || trigger === undefined ? "manual" : trigger);
    }
    expect(checkDefinition({ ...base, trigger: "weekly" }, ctx).ok).toBe(true);
  });
});

describe("the digest in one line", () => {
  const d = { runs: [], fresh: 0, accepted: 0, refusals: [] };

  it("says nothing when nothing happened", () => {
    // The whole discipline: a panel that speaks every morning is one nobody reads on the morning
    // it matters.
    expect(summarise(d)).toBeNull();
  });

  it("counts what there is, and nothing there is not", () => {
    expect(summarise({ ...d, fresh: 1 })).toBe("1 new proposal");
    expect(summarise({ ...d, fresh: 3, accepted: 2 })).toBe("3 new proposals · 2 accepted");
    expect(summarise({ ...d, runs: [{ id: "r", agentName: "A", trigger: "daily", outcome: "ok", proposed: 1, note: "", at: "" }] }))
      .toBe("1 agent run nobody asked for");
  });

  it("stays silent about proposals that were already waiting when it was dismissed", () => {
    // The bug this exists to prevent: dismissing the panel and having it come straight back,
    // because something open — and already seen — was still open.
    expect(summarise({ ...d, fresh: 0 })).toBeNull();
  });

  it("counts a refusal as something worth saying", () => {
    expect(summarise({ ...d, refusals: [{ agentName: "A", note: "over budget" }] })).toBe("1 refused to run");
  });
});
