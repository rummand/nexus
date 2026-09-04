import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { InlineTitle } from "@/components/workspace/InlineTitle";
import { NewSpaceDialog } from "@/components/workspace/NewSpaceDialog";
import { TeamMembers } from "@/components/workspace/TeamMembers";
import { renameTeam } from "@/lib/actions";
import { getSpaceBoardCounts, getTeam, getWorkspaceBySlug, getWorkspaceMembers, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function TeamPage({ params }: { params: Promise<{ slug: string; teamId: string }> }) {
  const { slug, teamId } = await params;
  const [workspace, user, team] = await Promise.all([getWorkspaceBySlug(slug), currentUser(), getTeam(teamId)]);
  if (!workspace || !team || team.workspaceId !== workspace.id) notFound();
  const [members, counts, { teams }] = await Promise.all([getWorkspaceMembers(workspace.id), getSpaceBoardCounts(workspace.id), getWorkspaceShell(workspace.id, user.id)]);

  return (
    <section className="studio-home-main">
      <header className="studio-home-topbar">
        <div>
          <span>{team.description || "Team"}</span>
          <h1 className="flex items-center gap-3"><span className="team-dot" style={{ background: team.color, height: 18, width: 18, borderRadius: 6 }} /><InlineTitle value={team.name} onCommit={renameTeam.bind(null, team.id)} /></h1>
        </div>
        <div className="studio-home-actions">
          <NewSpaceDialog workspaceId={workspace.id} teams={teams} defaultTeamId={team.id} trigger={<button className="primary-home-button" type="button"><Plus size={18} /> New space</button>} />
        </div>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="studio-board-browser">
          <div className="studio-board-browser-title">
            <div>
              <h2>Spaces</h2>
              <p>{team.spaces.length} space{team.spaces.length === 1 ? "" : "s"} owned by this team.</p>
            </div>
          </div>
          {team.spaces.length ? (
            <div className="home-card-grid">
              {team.spaces.map((s) => (
                <Link key={s.id} href={`/w/${slug}/spaces/${s.id}`} className="home-card">
                  <div className="flex items-center gap-2"><span style={{ fontSize: 22 }}>{s.emoji}</span><h3 className="!mb-0">{s.name}</h3></div>
                  <p className="mt-2">{s.description || "No description"}</p>
                  <p className="mt-3" style={{ fontSize: 12 }}>{counts.get(s.id) ?? 0} boards</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="studio-empty-boards"><Sparkles size={26} /><strong>No spaces yet</strong><span>Create a space for this team to group its boards.</span></div>
          )}
        </section>
        <aside className="studio-board-browser">
          <div className="studio-board-browser-title"><div><h2>Members</h2><p>{team.members.length} people</p></div></div>
          <TeamMembers team={team} teamMemberIds={team.members.map((m) => m.userId)} workspaceMembers={members.map((m) => m.user)} />
        </aside>
      </div>
    </section>
  );
}
