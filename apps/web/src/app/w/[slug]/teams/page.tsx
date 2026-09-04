import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { NewTeamDialog } from "@/components/workspace/NewTeamDialog";
import { initials } from "@/components/workspace/Sidebar";
import { getTeamsWithMembers, getWorkspaceBySlug } from "@/lib/data";

export default async function TeamsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const teams = await getTeamsWithMembers(workspace.id);
  return (
    <section className="studio-home-main">
      <header className="studio-home-topbar">
        <div>
          <span>Groups of people who share spaces and boards</span>
          <h1>Teams</h1>
        </div>
        <div className="studio-home-actions">
          <NewTeamDialog workspaceId={workspace.id} trigger={<button className="primary-home-button" type="button"><Plus size={18} /> New team</button>} />
        </div>
      </header>
      <div className="home-card-grid">
        {teams.map((t) => (
          <Link key={t.id} href={`/w/${slug}/teams/${t.id}`} className="home-card">
            <div className="flex items-center gap-2">
              <span className="team-dot" style={{ background: t.color }} />
              <h3 className="!mb-0">{t.name}</h3>
            </div>
            <p className="mt-2">{t.description || "No description"}</p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {t.members.slice(0, 5).map((m) => <span key={m.userId} className="avatar" style={{ height: 24, width: 24, fontSize: 10, background: m.user.color + "22", borderColor: "#fff", color: m.user.color }}>{initials(m.user.name)}</span>)}
              </div>
              <p style={{ fontSize: 12 }}>{t.members.length} members · {t.spaces.length} spaces</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
