import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Bot, Boxes, Clock3, Database, DownloadCloud, GitBranch, History, Home, Inbox, LifeBuoy, LogOut, Plus, Settings, Star, Table2, Users, Waypoints, NotebookText } from "lucide-react";
import type { Board, Space, Team, User, Workspace } from "@/db/schema";
import type { Checkout } from "@/lib/change/checkout";
import { NexusMark } from "./NexusMark";
import { RefIndicator, type RefChoice } from "./RefIndicator";
import { WorkspaceSwitcher, type WorkspaceChoice } from "./WorkspaceSwitcher";
import { SidebarLink } from "./SidebarLink";
import { HELP, LIBRARY, NAV } from "./nav";
import { SidebarSearch } from "./SidebarSearch";
import { SpaceListItem } from "./SpaceListItem";
import { NewSpaceDialog } from "./NewSpaceDialog";
import { NewTeamDialog } from "./NewTeamDialog";


/**
 * One icon per entry, beside the data rather than inside it: `nav.ts` stays a plain module that a
 * test can read without pulling React in.
 */
const NAV_ICON: Record<string, React.ReactNode> = {
  home: <Home size={17} />,
  recent: <Clock3 size={17} />,
  favorites: <Star size={17} />,
  teams: <Users size={17} />,
  repository: <Table2 size={17} />,
  graph: <Database size={17} />,
  explore: <Waypoints size={17} />,
  meta: <Boxes size={17} />,
  history: <History size={17} />,
  intake: <Inbox size={17} />,
  import: <DownloadCloud size={17} />,
  wiki: <NotebookText size={17} />,
  roadmap: <GitBranch size={17} />,
  agents: <Bot size={17} />,
  knowledge: <BookOpen size={17} />,
};

export function Sidebar({ workspace, user, teams, spaces, favorites, checkout, refs, workspaces = [] }: { workspace: Workspace; user: User; teams: Team[]; spaces: Space[]; favorites: Board[]; checkout: Checkout; refs: RefChoice[]; workspaces?: WorkspaceChoice[] }) {
  const base = `/w/${workspace.slug}`;
  return (
    <aside className="studio-home-sidebar">
      <div className="studio-home-brand">
        <Link href={base} className="brand-mark" aria-label="Nexus home"><NexusMark /></Link>
        <div>
          <strong>Nexus</strong>
          <WorkspaceSwitcher current={workspace} workspaces={workspaces.length ? workspaces : [{ id: workspace.id, slug: workspace.slug, name: workspace.name, role: "member" }]} />
        </div>
      </div>

      {/*
        Above the search and the navigation, because it is not a place you go: it is the state
        every place you go is read in (§5.82).
      */}
      <RefIndicator workspaceId={workspace.id} at={checkout.ref} divergence={checkout.divergence} choices={refs} />

      <Suspense fallback={null}>
        <SidebarSearch slug={workspace.slug} />
      </Suspense>

      {/*
        Explicit keys on static children: past a certain number of siblings the React compiler
        builds this list as an array, and React then warns that its items have no key.
      */}
      <nav className="studio-home-nav" aria-label="Studio navigation">
        {NAV.map((group) => (
          <div key={group.label ?? "workspace"} className="studio-nav-group">
            {group.label && <span className="studio-nav-label">{group.label}</span>}
            {group.items.map((item) => (
              <SidebarLink
                key={item.id}
                href={`${base}${item.path}`}
                exact={item.exact}
                icon={NAV_ICON[item.id]}
                trailing={item.id === "favorites" ? favorites.length : item.id === "teams" ? teams.length : undefined}
              >
                {item.label}
              </SidebarLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="studio-spaces-header">
        <span>Spaces</span>
        <NewSpaceDialog workspaceId={workspace.id} teams={teams} trigger={<button type="button" aria-label="Create space"><Plus size={15} /></button>} />
      </div>
      <div className="studio-space-list">
        {spaces.map((sp) => (
          <SpaceListItem key={sp.id} space={sp} slug={workspace.slug} workspaceId={workspace.id} />
        ))}
      </div>

      <div className="studio-spaces-header">
        <span>Teams</span>
        <NewTeamDialog workspaceId={workspace.id} trigger={<button type="button" aria-label="Create team"><Plus size={15} /></button>} />
      </div>
      <div className="studio-space-list">
        {teams.map((t) => (
          <div key={t.id}>
            <SidebarLink href={`${base}/teams/${t.id}`} icon={<em><span className="team-dot" style={{ background: t.color }} /></em>}>{t.name}</SidebarLink>
          </div>
        ))}
      </div>

      {/*
        Pinned below the spaces and above the person: reachable from every page, and costing the
        rail nothing (§5.65). Settings is one entry rather than four, because what a person wants
        is rarely "the Models page" — it is "the place where this is configured".
      */}
      <div className="studio-nav-utility">
        <SidebarLink href={`${base}${LIBRARY.path}`} icon={<BookOpen size={17} />}>{LIBRARY.label}</SidebarLink>
        <SidebarLink href={`${base}${HELP.path}`} icon={<LifeBuoy size={17} />}>{HELP.label}</SidebarLink>
        <SidebarLink href={`${base}/settings`} icon={<Settings size={17} />}>Settings</SidebarLink>
      </div>

      <footer>
        {/* The avatar takes the person's own colour — the same one their cursor wears on a
            shared board (§5.40), so "who is that" has one answer everywhere. */}
        <span className="avatar" style={{ background: user.color }}>{initials(user.name)}</span>
        <div>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        {/* A form, not a link: a GET that ends a session can be fired by any page on the web. */}
        <form action="/signout" method="post">
          <button type="submit" title={`Sign out of ${user.email}`} aria-label="Sign out" data-signout>
            <LogOut size={15} />
          </button>
        </form>
      </footer>
    </aside>
  );
}

export function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
