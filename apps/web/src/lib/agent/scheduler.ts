import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { dueAgents, isTrigger, type Schedulable } from "./schedule";
import { runDefinition } from "./run";

/**
 * The clock the fleet runs on (§5.42).
 *
 * A tick asks one question — which active agents have not run for their interval — and runs a few
 * of them. Everything that governs a run already governs this one: `runDefinition` refuses a
 * paused agent, refuses one over its budget, reads only its scope, and writes the refusal down.
 * An unattended run is not a privileged run. It is the same run with nobody watching, which is
 * exactly why it must not be a second code path.
 *
 * **Due is computed from the database, never from a timer.** A restart, a redeploy, a container
 * that slept — none of them lose or duplicate a run, because the only state is `lastRunAt` on the
 * agent's last run row. The in-process timer is a nudge, not a schedule.
 *
 * **One process.** Same honest limit as the live rooms (§5.40) and the SQLite volume (§5.19): two
 * replicas would be two tickers and an agent could run twice. The lock below makes that harmless
 * *within* a process; across processes the answer is the same as everywhere else — Postgres, and
 * an advisory lock — and it is written into the known gaps rather than pretended away.
 */

/** How often to look. Far more often than any schedule, so drift stays small and cheap. */
const TICK_MS = 5 * 60 * 1000;
/** At most this many unattended runs per tick, across all workspaces. */
const PER_TICK = 3;

interface Ticker {
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
  last: { at: string; ran: number; due: number } | null;
}

const ticker: Ticker = ((globalThis as { __nexusTicker?: Ticker }).__nexusTicker ??= { timer: null, running: false, last: null });

/** Every active agent with a schedule, with the time it last ran. */
async function schedulable(db: Db): Promise<Schedulable[]> {
  const defs = await db.select().from(s.agentDefinitions).where(eq(s.agentDefinitions.status, "active"));
  const scheduled = defs.filter((d) => isTrigger(d.trigger) && d.trigger !== "manual");
  if (!scheduled.length) return [];

  /*
   * One query for the whole fleet's last-run times rather than one per agent: a tick that costs
   * N queries before it decides to do nothing is a tick that gets switched off.
   */
  const runs = await db
    .select({ agentId: s.agentRuns.agentId, createdAt: s.agentRuns.createdAt })
    .from(s.agentRuns)
    .where(inArray(s.agentRuns.agentId, scheduled.map((d) => d.id)))
    .orderBy(desc(s.agentRuns.createdAt));

  const last = new Map<string, string>();
  for (const run of runs) if (run.agentId && !last.has(run.agentId)) last.set(run.agentId, run.createdAt);

  return scheduled.map((d) => ({
    id: d.id,
    workspaceId: d.workspaceId,
    name: d.name,
    trigger: d.trigger as Schedulable["trigger"],
    status: d.status,
    lastRunAt: last.get(d.id) ?? null,
  }));
}

type Db = Awaited<ReturnType<typeof getDb>>;

export interface TickResult {
  due: number;
  ran: Array<{ agent: string; outcome: string; proposed: number }>;
}

/**
 * One pass. Safe to call from anywhere and at any time — the lock means a slow tick and a fast
 * timer cannot overlap, and a caller that arrives mid-tick is told rather than queued.
 */
export async function tick(now = Date.now()): Promise<TickResult> {
  if (ticker.running) return { due: 0, ran: [] };
  ticker.running = true;
  try {
    const db = await getDb();
    const agents = await schedulable(db);
    const due = dueAgents(agents, now, PER_TICK);
    const ran: TickResult["ran"] = [];

    /*
     * Serially, on purpose. These are model calls made with nobody watching; three at once is
     * three times the bill in the same second and no faster in any way a person experiences.
     */
    for (const agent of due) {
      try {
        const outcome = await runDefinition(db, agent.workspaceId, agent.id, agent.trigger);
        ran.push(
          "error" in outcome
            ? { agent: agent.name, outcome: "failed", proposed: 0 }
            : { agent: agent.name, outcome: outcome.outcome, proposed: outcome.proposed },
        );
      } catch {
        // One agent that throws must not stop the rest of the fleet from being looked at.
        ran.push({ agent: agent.name, outcome: "failed", proposed: 0 });
      }
    }

    ticker.last = { at: new Date(now).toISOString(), ran: ran.length, due: agents.filter((a) => a.trigger !== "manual").length };
    return { due: due.length, ran };
  } finally {
    ticker.running = false;
  }
}

/**
 * Start the clock. Called once from `instrumentation.ts` when the server comes up.
 *
 * `unref` so the timer never holds the process open: a container being asked to stop should stop,
 * not wait five minutes for a tick it was not going to do anything with.
 */
export function startScheduler() {
  if (ticker.timer) return;
  ticker.timer = setInterval(() => void tick().catch(() => undefined), TICK_MS);
  ticker.timer.unref?.();
  // A first pass shortly after boot, so a redeploy is not a gap in the schedule — but not
  // *immediately*, because the first request is already competing with route compilation.
  const first = setTimeout(() => void tick().catch(() => undefined), 30_000);
  first.unref?.();
}

/** What the clock last did — for the fleet page, and for knowing it is alive at all. */
export const schedulerStatus = () => ({ running: ticker.timer !== null, last: ticker.last });
