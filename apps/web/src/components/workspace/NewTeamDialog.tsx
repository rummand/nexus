"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createTeam } from "@/lib/actions";
import { Button, Input } from "@/components/ui";
import { Modal } from "./Modal";

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

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
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createTeam({ workspaceId, name, description, color });
              if (res && "error" in res) setError(res.error);
            });
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Name</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grid Architecture" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this team own?" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Colour</label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`h-7 w-7 rounded-md ring-offset-2 ${color === c ? "ring-2 ring-ink-900" : ""}`} style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending || !name.trim()}>{pending ? "Creating…" : "Create team"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
