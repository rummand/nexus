"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createRoom } from "@/lib/actions";
import type { Team } from "@/db/schema";
import { Button, Input } from "@/components/ui";
import { Modal } from "./Modal";

const EMOJIS = ["🗂️", "🗺️", "🎯", "⚡", "🧪", "🏗️", "🔒", "📊", "🧭", "🛰️", "🏭", "💡"];

export function NewRoomDialog({ workspaceId, teams, trigger, defaultTeamId }: { workspaceId: string; teams: Team[]; trigger: ReactNode; defaultTeamId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🗂️");
  const [teamId, setTeamId] = useState<string>(defaultTeamId ?? "");
  const [visibility, setVisibility] = useState<"open" | "private">("open");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await createRoom({ workspaceId, name, description, emoji, teamId: teamId || null, visibility });
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
      <Modal open={open} onClose={() => setOpen(false)} title="New room">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Icon</label>
              <div className="grid w-[132px] grid-cols-4 gap-1 rounded-md border border-ink-200 p-1">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => setEmoji(e)} className={`flex h-7 w-7 items-center justify-center rounded text-base ${emoji === e ? "bg-accent-100" : "hover:bg-ink-100"}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Name</label>
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Application Landscape" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500">Description</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this room for?" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Team</label>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm">
                <option value="">Whole workspace</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as "open" | "private")} className="h-9 w-full rounded-md border border-ink-200 bg-white px-2 text-sm">
                <option value="open">Open — anyone in the workspace</option>
                <option value="private">Private — team members only</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create room"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
