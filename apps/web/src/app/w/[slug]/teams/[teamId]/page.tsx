import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { InlineTitle } from "@/components/workspace/InlineTitle";
import { NewRoomDialog } from "@/components/workspace/NewRoomDialog";
import { PageHeader } from "@/components/workspace/PageHeader";
import { RoomCard } from "@/components/workspace/RoomCard";
import { TeamMembers } from "@/components/workspace/TeamMembers";
import { Button, EmptyState, SectionTitle } from "@/components/ui";
import { renameTeam } from "@/lib/actions";
import { getRoomBoardCounts, getTeam, getWorkspaceBySlug, getWorkspaceMembers, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function TeamPage({ params }: { params: Promise<{ slug: string; teamId: string }> }) {
  const { slug, teamId } = await params;
  const [workspace, user, team] = await Promise.all([getWorkspaceBySlug(slug), currentUser(), getTeam(teamId)]);
  if (!workspace || !team || team.workspaceId !== workspace.id) notFound();
  const [members, counts, { teams }] = await Promise.all([getWorkspaceMembers(workspace.id), getRoomBoardCounts(workspace.id), getWorkspaceShell(workspace.id, user.id)]);

  return (
    <>
      <PageHeader
        icon={<span className="h-5 w-5 rounded-md" style={{ background: team.color }} />}
        title={<InlineTitle value={team.name} onCommit={renameTeam.bind(null, team.id)} className="text-2xl font-semibold tracking-tight" />}
        subtitle={team.description || "No description"}
        actions={<NewRoomDialog workspaceId={workspace.id} teams={teams} defaultTeamId={team.id} trigger={<Button variant="primary"><Plus size={15} /> New room</Button>} />}
      />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <section>
          <SectionTitle>Rooms</SectionTitle>
          {team.rooms.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {team.rooms.map((r) => <RoomCard key={r.id} room={r} boardCount={counts.get(r.id) ?? 0} href={`/w/${slug}/rooms/${r.id}`} />)}
            </div>
          ) : (
            <EmptyState title="No rooms yet" hint="Create a room for this team to group its boards." />
          )}
        </section>
        <aside>
          <SectionTitle>Members</SectionTitle>
          <TeamMembers team={team} teamMemberIds={team.members.map((m) => m.userId)} workspaceMembers={members.map((m) => m.user)} />
        </aside>
      </div>
    </>
  );
}
