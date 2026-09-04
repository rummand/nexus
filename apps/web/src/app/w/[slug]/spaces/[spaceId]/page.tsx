import { notFound } from "next/navigation";
import { HomeMain } from "@/components/workspace/HomeMain";
import { SpaceSettings } from "@/components/workspace/SpaceSettings";
import { renameSpace } from "@/lib/actions";
import { getBoardsForWorkspace, getSpace, getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function SpacePage({ params }: { params: Promise<{ slug: string; spaceId: string }> }) {
  const { slug, spaceId } = await params;
  const [workspace, user, space] = await Promise.all([getWorkspaceBySlug(slug), currentUser(), getSpace(spaceId)]);
  if (!workspace || !space || space.workspaceId !== workspace.id) notFound();
  const [boards, { teams, spaces }] = await Promise.all([getBoardsForWorkspace(workspace.id, user.id, { spaceId }), getWorkspaceShell(workspace.id, user.id)]);
  const lastOpened = boards.filter((b) => b.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))[0] ?? null;
  const metaParts = [space.team ? space.team.name : "Whole workspace", space.visibility === "private" ? "Private" : "Open", space.description].filter(Boolean);
  return (
    <HomeMain
      workspaceId={workspace.id}
      heading={space.name}
      headingEmoji={space.emoji}
      onRenameHeading={renameSpace.bind(null, space.id)}
      meta={metaParts.join(" · ")}
      boards={boards}
      spaces={spaces}
      mode="space"
      spaceId={space.id}
      lastOpened={lastOpened}
      headerExtra={<SpaceSettings space={space} teams={teams} />}
    />
  );
}
