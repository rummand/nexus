"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import type { Team, User } from "@/db/schema";
import { deleteTeam, setTeamMembership } from "@/lib/actions";
import { Avatar, Button } from "@/components/ui";

export function TeamMembers({ team, teamMemberIds, workspaceMembers }: { team: Team; teamMemberIds: string[]; workspaceMembers: User[] }) {
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();
  const members = workspaceMembers.filter((u) => teamMemberIds.includes(u.id));
  const candidates = workspaceMembers.filter((u) => !teamMemberIds.includes(u.id));

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3 shadow-sm">
      <ul className="divide-y divide-ink-100">
        {members.map((u) => (
          <li key={u.id} className="group flex items-center gap-2.5 py-2">
            <Avatar name={u.name} color={u.color} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{u.name}</div>
              <div className="truncate text-[11px] text-ink-500">{u.email}</div>
            </div>
            <button onClick={() => start(() => setTeamMembership(team.id, u.id, false))} className="rounded p-1 text-ink-300 opacity-0 hover:text-red-600 group-hover:opacity-100" aria-label="Remove"><X size={14} /></button>
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="mt-2 rounded-lg border border-ink-200 bg-ink-50 p-2">
          {candidates.length === 0 && <p className="px-1 py-2 text-[13px] text-ink-500">Everyone is already in this team.</p>}
          {candidates.map((u) => (
            <button key={u.id} onClick={() => start(() => setTeamMembership(team.id, u.id, true))} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-white">
              <Avatar name={u.name} color={u.color} size={22} />
              <span className="flex-1 truncate">{u.name}</span>
              <Check size={13} className="text-ink-400" />
            </button>
          ))}
          <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => setAdding(false)}>Done</Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="mt-2 w-full justify-center" onClick={() => setAdding(true)}><Plus size={14} /> Add member</Button>
      )}
      <div className="mt-3 border-t border-ink-100 pt-3">
        <Button size="sm" variant="ghost" className="w-full justify-center text-red-600 hover:bg-red-50" onClick={() => { if (confirm(`Delete team "${team.name}"? Its rooms stay in the workspace.`)) start(() => deleteTeam(team.id)); }}>
          <Trash2 size={13} /> Delete team
        </Button>
      </div>
    </div>
  );
}
