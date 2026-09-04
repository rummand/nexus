import Link from "next/link";
import { Lock } from "lucide-react";
import type { Room, Team } from "@/db/schema";

export function RoomCard({ room, team, boardCount, href }: { room: Room; team?: Team | null; boardCount: number; href: string }) {
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-float">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-xl">{room.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink-900 group-hover:text-accent-700">{room.name}</span>
          {room.visibility === "private" && <Lock size={12} className="shrink-0 text-ink-400" />}
        </div>
        {room.description && <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-500">{room.description}</p>}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-500">
          <span>{boardCount} {boardCount === 1 ? "board" : "boards"}</span>
          {team && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: team.color }} />{team.name}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
