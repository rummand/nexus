import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { getWorkspaceBySlug } from "@/lib/data";
import { getDefinition, runsFor } from "@/lib/agent/definitions";
import { toRunSummary } from "@/lib/agent/fleet-types";
import { AgentEditor } from "@/components/agents/AgentEditor";

/**
 * One agent: what it is, and everything it has ever done.
 *
 * The definition and the run log are on one page on purpose. "What is this thing allowed to do"
 * and "what has it actually been saying" are the same question asked twice, and answering them in
 * two places is how a fleet ends up with an agent nobody can account for.
 */
export default async function AgentPage({ params }: { params: Promise<{ slug: string; agentId: string }> }) {
  const { slug, agentId } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();

  // "new" is a page, not an agent: the same form with nothing in it.
  const agent = agentId === "new" ? null : await getDefinition(db, agentId);
  if (agentId !== "new" && (!agent || agent.workspaceId !== workspace.id)) notFound();

  const [teams, providers, runs] = await Promise.all([
    db.select().from(s.teams).where(eq(s.teams.workspaceId, workspace.id)),
    db.select().from(s.modelProviders).where(eq(s.modelProviders.workspaceId, workspace.id)),
    agent ? runsFor(db, agent.id, 12) : Promise.resolve([]),
  ]);

  return (
    <AgentEditor
      slug={slug}
      workspaceId={workspace.id}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
      providers={providers.map((p) => ({ id: p.id, name: p.name, enabled: p.enabled }))}
      agent={agent}
      runs={runs.map(toRunSummary)}
    />
  );
}
