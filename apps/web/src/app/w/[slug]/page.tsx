import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { BoardGrid } from "@/components/workspace/BoardGrid";
import { NewRoomDialog } from "@/components/workspace/NewRoomDialog";
import { PageHeader } from "@/components/workspace/PageHeader";
import { RoomCard } from "@/components/workspace/RoomCard";
import { Button, EmptyState, SectionTitle } from "@/components/ui";
import { getBoardsForWorkspace, getRoomBoardCounts, getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function WorkspaceHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const [{ teams, rooms }, recent, counts] = await Promise.all([
    getWorkspaceShell(workspace.id, user.id),
    getBoardsForWorkspace(workspace.id, user.id, { limit: 8 }),
    getRoomBoardCounts(workspace.id),
  ]);
  const base = `/w/${slug}`;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        subtitle={`${rooms.length} rooms · ${teams.length} teams in ${workspace.name}`}
        actions={<NewRoomDialog workspaceId={workspace.id} teams={teams} trigger={<Button variant="primary"><Plus size={15} /> New room</Button>} />}
      />

      <section className="mb-10">
        <SectionTitle action={<Link href={`${base}/recent`} className="text-[13px] text-accent-700 hover:underline">See all</Link>}>Recently edited</SectionTitle>
        {recent.length ? <BoardGrid boards={recent} /> : <EmptyState title="No boards yet" hint="Open a room and create your first board." />}
      </section>

      <section>
        <SectionTitle action={<Link href={`${base}/rooms`} className="text-[13px] text-accent-700 hover:underline">All rooms</Link>}>Rooms</SectionTitle>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {rooms.map((r) => (
            <RoomCard key={r.id} room={r} team={r.teamId ? teamById.get(r.teamId) : null} boardCount={counts.get(r.id) ?? 0} href={`${base}/rooms/${r.id}`} />
          ))}
        </div>
      </section>
    </>
  );
}
