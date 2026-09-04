"use client";

import { useState, useTransition } from "react";
import { Settings2, Trash2 } from "lucide-react";
import type { Space, Team } from "@/db/schema";
import { deleteSpace, updateSpace } from "@/lib/actions";
import { Modal } from "./Modal";

export function SpaceSettings({ space, teams }: { space: Space; teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(space.description);
  const [teamId, setTeamId] = useState(space.teamId ?? "");
  const [visibility, setVisibility] = useState(space.visibility);
  const [pending, start] = useTransition();

  return (
    <>
      <button className="ghost-button" type="button" onClick={() => setOpen(true)}><Settings2 size={16} /> Space settings</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Space settings">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await updateSpace(space.id, { description, teamId: teamId || null, visibility });
              setOpen(false);
            });
          }}
        >
          <div className="field">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Team</label>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">Whole workspace</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as "open" | "private")}>
                <option value="open">Open</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="ghost-button danger spacer" onClick={() => { if (confirm(`Delete space "${space.name}" and all its boards?`)) start(() => deleteSpace(space.id)); }}>
              <Trash2 size={14} /> Delete space
            </button>
            <button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="primary-home-button" disabled={pending}>Save</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
