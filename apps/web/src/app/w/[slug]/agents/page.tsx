import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { fleetOf } from "@/lib/agent/fleet";
import { listDefinitions, recentRuns } from "@/lib/agent/definitions";
import { toRunSummary } from "@/lib/agent/fleet-types";
import { choose, configured, whyNoModel } from "@/lib/models/resolve";
import { eq } from "drizzle-orm";
import * as sc from "@/db/schema";
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
  const [fleet, graphRun, choice, providers, defined, runs] = await Promise.all([
    fleetOf(db, workspace.id),
    lastRun(db, workspace.id),
    choose(db, workspace.id, "board agent"),
    db.select().from(sc.modelProviders).where(eq(sc.modelProviders.workspaceId, workspace.id)),
    listDefinitions(db, workspace.id),
    recentRuns(db, workspace.id, 8),
  ]);

  return (
    <AgentFleet
      slug={slug}
      workspaceId={workspace.id}
      fleet={fleet}
      model={{ ready: Boolean(choice), hint: choice ? "" : whyNoModel(await configured(db, workspace.id), providers, "board agent") }}
      graphAgent={{ lastAskedAt: graphRun?.at ?? null, grounded: graphRun?.grounded ?? [] }}
      defined={defined}
      runs={runs.map(toRunSummary)}
    />
  );
}
