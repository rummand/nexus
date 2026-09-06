import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseDocument } from "@/canvas/document";

/**
 * Every agent in a workspace, and whether it is worth having.
 *
 * Agents are scattered on purpose — one beside the OT frame, one on the landscape board, one asked
 * ad hoc from a selection — and scattering is only humane if there is one place that can answer
 * "how many of these are there, what are they watching, and is anybody listening to them".
 *
 * The headline number here is deliberately not tokens, runs or remarks made. It is **kept**: how
 * often a person turned what an agent said into a note of their own. An agent nobody keeps is not
 * cheap and quiet, it is noise with a running cost, and the fleet should say so rather than let it
 * accumulate.
 */

export interface FleetAgent {
  id: string;
  name: string;
  purpose: string;
  scope: "board" | "frame" | "connected";
  boardId: string;
  boardName: string;
  spaceName: string;
  /** Remarks currently standing on the board, unanswered. */
  open: number;
  kept: number;
  dismissed: number;
  lastRunAt: string | null;
}

export interface Fleet {
  agents: FleetAgent[];
  /** Agents somebody has deleted, which still have a record. Their history is not erased by removal. */
  gone: Array<{ agentElementId: string; name: string; kept: number; dismissed: number }>;
  totals: { agents: number; open: number; kept: number; dismissed: number };
}

/** Kept out of a hundred, or null when nobody has answered this agent yet. */
export function acceptance(agent: { kept: number; dismissed: number }): number | null {
  const answered = agent.kept + agent.dismissed;
  return answered === 0 ? null : Math.round((agent.kept / answered) * 100);
}

/** What the number means, in words rather than a colour nobody can read out loud. */
export function verdict(rate: number | null, answered: number): string {
  if (rate === null) return "Nobody has answered it yet.";
  if (answered < 4) return "Too early to say.";
  if (rate >= 60) return "People keep most of what it says.";
  if (rate >= 25) return "Mixed — worth rewriting what you asked it for.";
  return "Almost everything it says is waved away. Change its purpose or delete it.";
}

export async function fleetOf(db: Db, workspaceId: string): Promise<Fleet> {
  const [boards, outcomes] = await Promise.all([
    db
      .select({ id: s.boards.id, name: s.boards.name, document: s.boards.document, spaceName: s.spaces.name })
      .from(s.boards)
      .innerJoin(s.spaces, eq(s.boards.spaceId, s.spaces.id))
      .where(eq(s.boards.workspaceId, workspaceId))
      .orderBy(desc(s.boards.updatedAt)),
    db.select().from(s.agentRemarkOutcomes).where(eq(s.agentRemarkOutcomes.workspaceId, workspaceId)),
  ]);

  const tally = new Map<string, { kept: number; dismissed: number; name: string }>();
  for (const row of outcomes) {
    const cur = tally.get(row.agentElementId) ?? { kept: 0, dismissed: 0, name: row.agentName };
    if (row.outcome === "kept") cur.kept++;
    else cur.dismissed++;
    if (row.agentName) cur.name = row.agentName;
    tally.set(row.agentElementId, cur);
  }

  const agents: FleetAgent[] = [];
  const seen = new Set<string>();
  for (const board of boards) {
    for (const el of Object.values(parseDocument(board.document).elements)) {
      if (el.type !== "agent") continue;
      seen.add(el.id);
      const counts = tally.get(el.id) ?? { kept: 0, dismissed: 0, name: "" };
      agents.push({
        id: el.id,
        name: el.name || "Unnamed agent",
        purpose: el.purpose,
        scope: el.scope,
        boardId: board.id,
        boardName: board.name,
        spaceName: board.spaceName,
        open: el.remarks?.length ?? 0,
        kept: counts.kept,
        dismissed: counts.dismissed,
        lastRunAt: el.lastRunAt ?? null,
      });
    }
  }

  const gone = [...tally.entries()]
    .filter(([id]) => !seen.has(id))
    .map(([agentElementId, c]) => ({ agentElementId, name: c.name || "A deleted agent", kept: c.kept, dismissed: c.dismissed }))
    .sort((a, b) => b.kept + b.dismissed - (a.kept + a.dismissed));

  agents.sort((a, b) => b.open - a.open || b.kept + b.dismissed - (a.kept + a.dismissed) || a.name.localeCompare(b.name));

  return {
    agents,
    gone,
    totals: {
      agents: agents.length,
      open: agents.reduce((n, a) => n + a.open, 0),
      kept: agents.reduce((n, a) => n + a.kept, 0) + gone.reduce((n, a) => n + a.kept, 0),
      dismissed: agents.reduce((n, a) => n + a.dismissed, 0) + gone.reduce((n, a) => n + a.dismissed, 0),
    },
  };
}
