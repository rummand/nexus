import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { fleetOf } from "@/lib/agent/fleet";
import { agentUnavailable, modelConfigured } from "@/lib/agent/propose";
import { lastRun } from "@/lib/agent/store";
import { AgentFleet } from "@/components/agents/AgentFleet";

/**
 * The fleet.
 *
 * Agents in Nexus are scattered on purpose — one beside a frame, one on a board, one asked ad hoc
 * from a selection. Scattering is only humane if there is one page that can answer how many there
 * are, what they are watching, and whether anybody is listening to them.
 */
export default async function AgentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const [fleet, graphRun] = await Promise.all([fleetOf(db, workspace.id), lastRun(db, workspace.id)]);

  return (
    <AgentFleet
      slug={slug}
      fleet={fleet}
      model={{ ready: modelConfigured(), hint: agentUnavailable() }}
      graphAgent={{ lastAskedAt: graphRun?.at ?? null, grounded: graphRun?.grounded ?? [] }}
    />
  );
}
