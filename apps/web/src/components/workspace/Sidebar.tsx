import Link from "next/link";
import { Clock, Home, Star, Users, LayoutGrid, Plus } from "lucide-react";
import type { Board, Room, Team, User, Workspace } from "@/db/schema";
import { Avatar } from "@/components/ui";
import { SidebarLink } from "./SidebarLink";
import { NewRoomDialog } from "./NewRoomDialog";

export function Sidebar({ workspace, user, teams, rooms, favorites }: { workspace: Workspace; user: User; teams: Team[]; rooms: Room[]; favorites: Board[] }) {
  const base = `/w/${workspace.slug}`;
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-ink-200 bg-white">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Link href={base} className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">
          <NexusMark />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{workspace.name}</div>
          <div className="text-[11px] text-ink-500">Workspace</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4">
        <div className="space-y-0.5">
          <SidebarLink href={base} exact icon={<Home size={15} />}>Home</SidebarLink>
          <SidebarLink href={`${base}/recent`} icon={<Clock size={15} />}>Recent</SidebarLink>
          <SidebarLink href={`${base}/favorites`} icon={<Star size={15} />}>Favourites</SidebarLink>
        </div>

        {favorites.length > 0 && (
          <div>
            <SectionHeader>Favourites</SectionHeader>
            <div className="space-y-0.5">
              {favorites.slice(0, 6).map((b) => (
                <SidebarLink key={b.id} href={`/b/${b.id}`} icon={<Star size={13} className="fill-amber-400 text-amber-400" />}>{b.name}</SidebarLink>
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionHeader href={`${base}/teams`} action={<Link href={`${base}/teams`} className="text-ink-400 hover:text-ink-700" title="All teams"><Users size={13} /></Link>}>Teams</SectionHeader>
          <div className="space-y-0.5">
            {teams.map((t) => (
              <SidebarLink key={t.id} href={`${base}/teams/${t.id}`} icon={<span className="block h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />}>{t.name}</SidebarLink>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader
            href={`${base}/rooms`}
            action={
              <div className="flex items-center gap-1">
                <Link href={`${base}/rooms`} className="text-ink-400 hover:text-ink-700" title="All rooms"><LayoutGrid size={13} /></Link>
                <NewRoomDialog workspaceId={workspace.id} teams={teams} trigger={<button type="button" className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700" title="New room" aria-label="New room"><Plus size={14} /></button>} />
              </div>
            }
          >
            Rooms
          </SectionHeader>
          <div className="space-y-0.5">
            {rooms.map((r) => (
              <SidebarLink key={r.id} href={`${base}/rooms/${r.id}`} icon={<span className="text-sm">{r.emoji}</span>}>{r.name}</SidebarLink>
            ))}
          </div>
        </div>
      </nav>

      <div className="flex items-center gap-2.5 border-t border-ink-200 px-4 py-3">
        <Avatar name={user.name} color={user.color} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{user.name}</div>
          <div className="truncate text-[11px] text-ink-500">{user.email}</div>
        </div>
      </div>
    </aside>
  );
}

function SectionHeader({ children, action, href }: { children: React.ReactNode; action?: React.ReactNode; href?: string }) {
  const label = <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{children}</span>;
  return (
    <div className="mb-1 flex items-center justify-between px-2">
      {href ? <Link href={href} className="hover:text-ink-700">{label}</Link> : label}
      {action}
    </div>
  );
}

export function NexusMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="2.5" fill="currentColor" />
      <circle cx="19" cy="5" r="2.5" fill="currentColor" />
      <circle cx="19" cy="19" r="2.5" fill="currentColor" />
      <path d="M7 11l10-5M7 13l10 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
