"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createTeam } from "@/lib/actions";
import { Modal } from "./Modal";

const COLORS = ["#1376d4", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

export function NewTeamDialog({ workspaceId, trigger }: { workspaceId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">{trigger}</span>
      <Modal open={open} onClose={() => setOpen(false)} title="New team">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createTeam({ workspaceId, name, description, color });
              if (res && "error" in res) setError(res.error);
            });
          }}
        >
          <div className="field">
            <label>Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grid Architecture" />
          </div>
          <div className="field">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this team own?" />
          </div>
          <div className="field">
            <span>Colour</span>
            <div className="swatch-row">
              {COLORS.map((c) => <button key={c} type="button" className={color === c ? "active" : ""} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="primary-home-button" disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create team"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
