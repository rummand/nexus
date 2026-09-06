import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Boxes, Clock3, Database, GitBranch, Home, Inbox, Plus, Star, Users, Waypoints } from "lucide-react";
import type { Board, Space, Team, User, Workspace } from "@/db/schema";
import { NexusMark } from "./NexusMark";
import { SidebarLink } from "./SidebarLink";
import { SidebarSearch } from "./SidebarSearch";
import { SpaceListItem } from "./SpaceListItem";
import { NewSpaceDialog } from "./NewSpaceDialog";
import { NewTeamDialog } from "./NewTeamDialog";

export function Sidebar({ workspace, user, teams, spaces, favorites }: { workspace: Workspace; user: User; teams: Team[]; spaces: Space[]; favorites: Board[] }) {
  const base = `/w/${workspace.slug}`;
  return (
    <aside className="studio-home-sidebar">
      <div className="studio-home-brand">
        <Link href={base} className="brand-mark" aria-label="Nexus home"><NexusMark /></Link>
        <div>
          <strong>Nexus</strong>
          <span>{workspace.name} · architecture workspace</span>
        </div>
      </div>

      <Suspense fallback={null}>
        <SidebarSearch slug={workspace.slug} />
      </Suspense>

      {/*
        Explicit keys on static children: past a certain number of siblings the React compiler
        builds this list as an array, and React then warns that its items have no key.
      */}
      <nav className="studio-home-nav" aria-label="Studio navigation">
        <SidebarLink key="home" href={base} exact icon={<Home size={20} />}>Home</SidebarLink>
        <SidebarLink key="recent" href={`${base}/recent`} icon={<Clock3 size={20} />}>Recent</SidebarLink>
        <SidebarLink key="favorites" href={`${base}/favorites`} icon={<Star size={20} />} trailing={favorites.length}>Starred</SidebarLink>
        <SidebarLink key="teams" href={`${base}/teams`} icon={<Users size={20} />} trailing={teams.length}>Teams</SidebarLink>
        <SidebarLink key="graph" href={`${base}/graph`} icon={<Database size={20} />}>Knowledge graph</SidebarLink>
        <SidebarLink key="explore" href={`${base}/explore`} icon={<Waypoints size={20} />}>Graph explorer</SidebarLink>
        <SidebarLink key="meta" href={`${base}/meta`} icon={<Boxes size={20} />}>Meta-model</SidebarLink>
        <SidebarLink key="intake" href={`${base}/intake`} icon={<Inbox size={20} />}>Intake</SidebarLink>
        <SidebarLink key="roadmap" href={`${base}/roadmap`} icon={<GitBranch size={20} />}>Roadmap</SidebarLink>
        <SidebarLink key="knowledge" href={`${base}/knowledge`} icon={<BookOpen size={20} />}>EA knowledge</SidebarLink>
      </nav>

      <div className="studio-spaces-header">
        <span>Spaces</span>
        <NewSpaceDialog workspaceId={workspace.id} teams={teams} trigger={<button type="button" aria-label="Create space"><Plus size={18} /></button>} />
      </div>
      <div className="studio-space-list">
        {spaces.map((sp) => (
          <SpaceListItem key={sp.id} space={sp} slug={workspace.slug} workspaceId={workspace.id} />
        ))}
      </div>

      <div className="studio-spaces-header">
        <span>Teams</span>
        <NewTeamDialog workspaceId={workspace.id} trigger={<button type="button" aria-label="Create team"><Plus size={18} /></button>} />
      </div>
      <div className="studio-space-list">
        {teams.map((t) => (
          <div key={t.id}>
            <SidebarLink href={`${base}/teams/${t.id}`} icon={<em><span className="team-dot" style={{ background: t.color }} /></em>}>{t.name}</SidebarLink>
          </div>
        ))}
      </div>

      <footer>
        <span className="avatar">{initials(user.name)}</span>
        <div>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
      </footer>
    </aside>
  );
}

export function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
