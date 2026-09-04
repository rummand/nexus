import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { NewRoomDialog } from "@/components/workspace/NewRoomDialog";
import { PageHeader } from "@/components/workspace/PageHeader";
import { RoomCard } from "@/components/workspace/RoomCard";
import { Button } from "@/components/ui";
import { getRoomBoardCounts, getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function RoomsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const [{ teams, rooms }, counts] = await Promise.all([getWorkspaceShell(workspace.id, user.id), getRoomBoardCounts(workspace.id)]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return (
    <>
      <PageHeader title="Rooms" subtitle="Groups of boards around a topic or initiative" actions={<NewRoomDialog workspaceId={workspace.id} teams={teams} trigger={<Button variant="primary"><Plus size={15} /> New room</Button>} />} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {rooms.map((r) => (
          <RoomCard key={r.id} room={r} team={r.teamId ? teamById.get(r.teamId) : null} boardCount={counts.get(r.id) ?? 0} href={`/w/${slug}/rooms/${r.id}`} />
        ))}
      </div>
    </>
  );
}
