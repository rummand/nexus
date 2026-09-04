"use client";

import { useState, useTransition } from "react";
import { Settings2, Trash2 } from "lucide-react";
import type { Room, Team } from "@/db/schema";
import { deleteRoom, updateRoom } from "@/lib/actions";
import { Button, Input } from "@/components/ui";
import { Modal } from "./Modal";

export function RoomSettings({ room, teams }: { room: Room; teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(room.description);
  const [teamId, setTeamId] = useState(room.teamId ?? "");
  const [visibility, setVisibility] = useState(room.visibility);
  const [pending, start] = useTransition();

  return (
    <>
      <Button onClick={() => setOpen(true)} aria-label="Room settings"><Settings2 size={15} /> Settings</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Room settings">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await updateRoom(room.id, { description, teamId: teamId || null, visibility });
              setOpen(false);
            });
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Team</label>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm">
                <option value="">Whole workspace</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as "open" | "private")} className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm">
                <option value="open">Open</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => { if (confirm(`Delete room "${room.name}" and all its boards?`)) start(() => deleteRoom(room.id)); }}>
              <Trash2 size={14} /> Delete room
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={pending}>Save</Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
