import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Plus } from "lucide-react";
import { NewSpaceDialog } from "@/components/workspace/NewSpaceDialog";
import { getSpaceBoardCounts, getWorkspaceBySlug, getWorkspaceShell } from "@/lib/data";
import { currentUser } from "@/lib/session";

export default async function SpacesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [workspace, user] = await Promise.all([getWorkspaceBySlug(slug), currentUser()]);
  if (!workspace) notFound();
  const [{ teams, spaces }, counts] = await Promise.all([getWorkspaceShell(workspace.id, user.id), getSpaceBoardCounts(workspace.id)]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return (
    <section className="studio-home-main">
      <header className="studio-home-topbar">
        <div>
          <span>Groups of boards around a topic or initiative</span>
          <h1>Spaces</h1>
        </div>
        <div className="studio-home-actions">
          <NewSpaceDialog workspaceId={workspace.id} teams={teams} trigger={<button className="primary-home-button" type="button"><Plus size={18} /> New space</button>} />
        </div>
      </header>
      <div className="home-card-grid">
        {spaces.map((s) => {
          const team = s.teamId ? teamById.get(s.teamId) : null;
          return (
            <Link key={s.id} href={`/w/${slug}/spaces/${s.id}`} className="home-card">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 22 }}>{s.emoji}</span>
                <h3 className="!mb-0">{s.name}</h3>
                {s.visibility === "private" && <Lock size={13} style={{ color: "#8a95a8" }} />}
              </div>
              <p className="mt-2">{s.description || "No description"}</p>
              <p className="mt-3" style={{ fontSize: 12 }}>{counts.get(s.id) ?? 0} boards{team ? ` · ${team.name}` : " · whole workspace"}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
