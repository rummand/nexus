import { and, desc, eq, gt, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";

/**
 * What happened while you were away (§5.42).
 *
 * Agents that run on a schedule are only half of the idea; the other half is that a person coming
 * back finds out. Without this the fleet works all night and the evidence is a number on a page
 * nobody opens — which is not an agent doing something for you, it is an agent doing something
 * near you.
 *
 * **Since you last looked, not since you last signed in.** Signing in on a phone at the weekend
 * is not reading a digest, and a product that says "nothing new" because of that has lied. So the
 * window is `users.lastDigestAt`, moved only when the digest is actually dismissed.
 *
 * **It is honest about the boring case.** Most mornings nothing happened, and the digest says so
 * in one line rather than manufacturing three bullet points out of an empty night. The moment it
 * starts padding is the moment people stop reading it.
 */

export interface DigestRun {
  id: string;
  agentName: string;
  trigger: string;
  outcome: string;
  proposed: number;
  note: string;
  at: string;
}

export interface DigestProposal {
  id: string;
  title: string;
  type: string;
  confidence: string;
  agentName: string;
}

export interface Digest {
  /** The window this covers. Null when the person has never dismissed one. */
  since: string | null;
  /** Unattended runs in the window — the ones nobody asked for. */
  runs: DigestRun[];
  /** Proposals that appeared *in the window*, newest first. Capped: a digest is a glance. */
  proposals: DigestProposal[];
  /**
   * How many of those are new since the window opened.
   *
   * This, and not the total, is what makes the digest speak: three proposals that were already
   * waiting when you dismissed it yesterday are not news, and a panel headed "while you were away"
   * that reappears for them has lied about what it is.
   */
  fresh: number;
  /** Everything open, for the button. A count of work, not a count of news. */
  waiting: number;
  /** Decided by anybody since the window opened, so a team can see itself working. */
  accepted: number;
  dismissed: number;
  /** Agents that refused to run, and why. The fact somebody most needs and least expects. */
  refusals: Array<{ agentName: string; note: string }>;
  /** True when there is nothing worth a person's attention. */
  quiet: boolean;
}

/** Nothing to report, in the shape the page expects. */
const EMPTY = (since: string | null): Digest => ({
  since,
  runs: [],
  proposals: [],
  fresh: 0,
  waiting: 0,
  accepted: 0,
  dismissed: 0,
  refusals: [],
  quiet: true,
});

const LIST_LIMIT = 6;

export async function digestFor(db: Db, workspaceId: string, user: { id: string; lastDigestAt: string | null }): Promise<Digest> {
  /*
   * A person who has never dismissed one gets the last day rather than the whole history: their
   * first digest should be a digest, not an archive.
   */
  const since = user.lastDigestAt ?? new Date(Date.now() - 86_400_000).toISOString();

  const runs = await db
    .select()
    .from(s.agentRuns)
    .where(and(eq(s.agentRuns.workspaceId, workspaceId), gt(s.agentRuns.createdAt, since)))
    .orderBy(desc(s.agentRuns.createdAt))
    .limit(50);

  // Only unattended runs: being told about the run you started yourself thirty seconds ago is
  // noise, and it is the sort of noise that makes people stop reading the useful lines.
  const unattended = runs.filter((r) => r.trigger !== "manual");

  const proposalRows = await db
    .select()
    .from(s.agentProposals)
    .where(eq(s.agentProposals.workspaceId, workspaceId))
    .orderBy(desc(s.agentProposals.createdAt));

  const decisions = await db
    .select()
    .from(s.agentDecisions)
    .where(and(eq(s.agentDecisions.workspaceId, workspaceId), gt(s.agentDecisions.createdAt, since)));

  // What appeared while they were away, as opposed to what is simply still open.
  const fresh = proposalRows.filter((p) => p.createdAt > since);

  const names = new Map<string, string>();
  const agentIds = [...new Set(proposalRows.map((p) => p.agentId).filter((id): id is string => Boolean(id)))];
  if (agentIds.length) {
    for (const row of await db.select().from(s.agentDefinitions).where(inArray(s.agentDefinitions.id, agentIds))) {
      names.set(row.id, row.name);
    }
  }

  const digest: Digest = {
    since: user.lastDigestAt,
    runs: unattended.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      trigger: r.trigger,
      outcome: r.outcome,
      proposed: r.proposed ?? 0,
      note: r.note ?? "",
      at: r.createdAt,
    })),
    proposals: fresh.slice(0, LIST_LIMIT).map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      confidence: p.confidence,
      agentName: p.agentId ? (names.get(p.agentId) ?? "An agent") : "The rules",
    })),
    fresh: fresh.length,
    waiting: proposalRows.length,
    accepted: decisions.filter((d) => d.decision === "accepted").length,
    dismissed: decisions.filter((d) => d.decision === "dismissed").length,
    refusals: unattended
      .filter((r) => r.outcome === "refused" && r.note)
      .map((r) => ({ agentName: r.agentName, note: r.note ?? "" }))
      .slice(0, 4),
    quiet: false,
  };

  digest.quiet = summarise(digest) === null;
  return digest.quiet ? { ...EMPTY(user.lastDigestAt), waiting: digest.waiting } : digest;
}

/**
 * The digest in one sentence, or null when there is nothing to say.
 *
 * Pure, and the single place that decides what counts as "something happened" — the page, the
 * badge and the tests all have to agree on that or the badge lies.
 */
export function summarise(d: Pick<Digest, "runs" | "fresh" | "accepted" | "refusals">): string | null {
  const parts: string[] = [];
  if (d.runs.length) parts.push(`${d.runs.length} agent run${d.runs.length === 1 ? "" : "s"} nobody asked for`);
  if (d.fresh) parts.push(`${d.fresh} new proposal${d.fresh === 1 ? "" : "s"}`);
  if (d.accepted) parts.push(`${d.accepted} accepted`);
  if (d.refusals.length) parts.push(`${d.refusals.length} refused to run`);
  if (!parts.length) return null;
  return parts.join(" · ");
}

/** Mark it read. The window for the next one starts now. */
export async function dismissDigest(db: Db, userId: string) {
  await db.update(s.users).set({ lastDigestAt: new Date().toISOString() }).where(eq(s.users.id, userId));
}
