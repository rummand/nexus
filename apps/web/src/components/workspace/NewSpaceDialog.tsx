"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createSpace } from "@/lib/actions";
import type { Team } from "@/db/schema";
import { Modal } from "./Modal";

const EMOJIS = ["🗂️", "🗺️", "🎯", "⚡", "🧪", "🏗️", "🔒", "📊", "🧭", "🛰️", "🏭", "💡"];

export function NewSpaceDialog({ workspaceId, teams, trigger, defaultTeamId }: { workspaceId: string; teams: Team[]; trigger: ReactNode; defaultTeamId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🗂️");
  const [teamId, setTeamId] = useState<string>(defaultTeamId ?? "");
  const [visibility, setVisibility] = useState<"open" | "private">("open");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
      <Modal open={open} onClose={() => setOpen(false)} title="New space">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createSpace({ workspaceId, name, description, emoji, teamId: teamId || null, visibility });
              if (res && "error" in res) setError(res.error);
            });
          }}
        >
          <div className="field">
            <label>Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Architecture thinking room" />
          </div>
          <div className="field">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this space for?" />
          </div>
          <div className="field">
            <span>Icon</span>
            <div className="emoji-row">
              {EMOJIS.map((e) => <button key={e} type="button" className={emoji === e ? "active" : ""} onClick={() => setEmoji(e)}>{e}</button>)}
            </div>
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
                <option value="open">Open — anyone in the workspace</option>
                <option value="private">Private — team members only</option>
              </select>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="primary-home-button" disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create space"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
