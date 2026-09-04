"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import type { Team, User } from "@/db/schema";
import { deleteTeam, setTeamMembership } from "@/lib/actions";
import { initials } from "./Sidebar";

export function TeamMembers({ team, teamMemberIds, workspaceMembers }: { team: Team; teamMemberIds: string[]; workspaceMembers: User[] }) {
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();
  const members = workspaceMembers.filter((u) => teamMemberIds.includes(u.id));
  const candidates = workspaceMembers.filter((u) => !teamMemberIds.includes(u.id));

  return (
    <div className="home-card">
      {members.map((u) => (
        <div key={u.id} className="member-row">
          <span className="avatar" style={{ background: u.color + "22", borderColor: u.color + "66", color: u.color }}>{initials(u.name)}</span>
          <div>
            <strong>{u.name}</strong>
            <span>{u.email}</span>
          </div>
          <button onClick={() => start(() => setTeamMembership(team.id, u.id, false))} aria-label="Remove"><X size={14} /></button>
        </div>
      ))}
      {adding ? (
        <div className="mt-3 grid gap-1">
          {candidates.length === 0 && <p>Everyone is already in this team.</p>}
          {candidates.map((u) => (
            <button key={u.id} className="ghost-button" style={{ justifyContent: "flex-start" }} onClick={() => start(() => setTeamMembership(team.id, u.id, true))}>
              <span className="avatar" style={{ height: 24, width: 24, fontSize: 10 }}>{initials(u.name)}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{u.name}</span>
              <Check size={13} />
            </button>
          ))}
          <button className="ghost-button" onClick={() => setAdding(false)}>Done</button>
        </div>
      ) : (
        <button className="ghost-button mt-3 w-full" style={{ justifyContent: "center" }} onClick={() => setAdding(true)}><Plus size={14} /> Add member</button>
      )}
      <button className="ghost-button danger mt-3 w-full" style={{ justifyContent: "center" }} onClick={() => { if (confirm(`Delete team "${team.name}"? Its spaces stay in the workspace.`)) start(() => deleteTeam(team.id)); }}>
        <Trash2 size={13} /> Delete team
      </button>
    </div>
  );
}
