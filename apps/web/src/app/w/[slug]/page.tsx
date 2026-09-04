import { notFound } from "next/navigation";
import { HomeMain } from "@/components/workspace/HomeMain";
import { getBoardsForWorkspace, getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { getDb } from "@/db/client";
import { graphSnapshot } from "@/lib/graph";
import { computeProposals } from "@/lib/proposals";

export default async function WorkspaceHome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ slug }, { q }] = await Promise.all([params, searchParams]);
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const db = await getDb();
  const [{ teams, spaces }, boards, snapshot, proposals] = await Promise.all([getWorkspaceShell(workspace.id, user.id), getBoardsForWorkspace(workspace.id, user.id), graphSnapshot(db, workspace.id), computeProposals(db, workspace.id)]);
  const lastOpened = boards.filter((b) => b.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))[0] ?? null;
  return (
    <HomeMain
      workspaceId={workspace.id}
      heading={workspace.name}
      meta={`${spaces.length} spaces · ${teams.length} teams · boards save automatically`}
      boards={boards}
      spaces={spaces}
      mode="home"
      lastOpened={lastOpened}
      initialQuery={q ?? ""}
      graph={{ entities: snapshot.entities.length, kinds: snapshot.kinds.length, relations: snapshot.relationKinds.reduce((a, k) => a + k.count, 0), proposals: proposals.length, slug }}
    />
  );
}
