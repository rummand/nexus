import { NextResponse } from "next/server";
import { schedulerStatus, tick } from "@/lib/agent/scheduler";
import { currentUserOrNull } from "@/lib/session";

/**
 * Run the fleet's due agents now (§5.42).
 *
 * The in-process clock is the ordinary path; this exists for the two cases it does not cover. A
 * host that recycles idle containers has no long-running timer, so a platform cron calls this
 * instead — `NEXUS_TICK_KEY` in an `x-nexus-tick` header, because a cron has no cookie. And a
 * person waiting to see whether their new schedule works should not have to wait five minutes to
 * find out, so a signed-in user may ask too.
 *
 * It changes nothing a manual run would not: `runDefinition` applies every status check and every
 * budget exactly as it does when somebody presses the button.
 */
export async function POST(req: Request) {
  const key = process.env.NEXUS_TICK_KEY;
  const offered = req.headers.get("x-nexus-tick") ?? "";
  const byCron = Boolean(key) && offered === key;

  if (!byCron && !(await currentUserOrNull())) {
    return NextResponse.json({ error: "Sign in, or send the tick key." }, { status: 401 });
  }
  return NextResponse.json({ ...(await tick()), scheduler: schedulerStatus() });
}

/** What the clock last did. Useful when the question is "is it running at all". */
export async function GET() {
  if (!(await currentUserOrNull())) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  return NextResponse.json(schedulerStatus());
}
