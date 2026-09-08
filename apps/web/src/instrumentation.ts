/**
 * Server start-up.
 *
 * The one hook Next gives us that runs once when a server instance comes up, which is exactly what
 * an agent schedule needs (§5.42): the clock has to start without waiting for somebody to visit,
 * or "it ran while you were away" is only true if somebody was here.
 *
 * Deliberately tiny and deliberately guarded. `register` blocks the server becoming ready, so it
 * must not touch the database, and it must not throw — a scheduler that fails to start is a fleet
 * that stays manual, which is worse than yesterday but is not an outage.
 */
export async function register() {
  // The edge runtime has no timers worth the name and no database; only the Node server ticks.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Not during a build, and not in the test runner, which brings its own clock.
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXUS_NO_SCHEDULER === "1") return;

  try {
    const { startScheduler } = await import("@/lib/agent/scheduler");
    startScheduler();
  } catch {
    /* A fleet that stays manual is a smaller problem than a server that will not start. */
  }
}
