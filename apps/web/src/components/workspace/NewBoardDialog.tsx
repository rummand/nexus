"use client";

import { useState, useTransition } from "react";
import { createBoard } from "@/lib/actions";
import type { Space } from "@/db/schema";
import { TEMPLATES, type TemplateId } from "@/canvas/templates";
import { Modal } from "./Modal";

export function NewBoardDialog({ open, onClose, workspaceId, spaces, defaultSpaceId, defaultTemplate = "blank" }: { open: boolean; onClose: () => void; workspaceId: string; spaces: Space[]; defaultSpaceId?: string; defaultTemplate?: TemplateId }) {
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? spaces[0]?.id ?? "");
  const [template, setTemplate] = useState<TemplateId>(defaultTemplate);
  const [pending, start] = useTransition();

  return (
    <Modal open={open} onClose={onClose} title="Create board">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!spaceId) return;
          const tpl = TEMPLATES.find((t) => t.id === template);
          start(() => createBoard({ workspaceId, spaceId, name: name || (template === "blank" ? "" : tpl?.name), template }));
        }}
      >
        <div className="field">
          <label>Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={template === "blank" ? "Untitled board" : TEMPLATES.find((t) => t.id === template)?.name} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Space</label>
            <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Start from</label>
            <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateId)}>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-home-button" disabled={pending || !spaceId}>{pending ? "Creating…" : "Create board"}</button>
        </div>
      </form>
    </Modal>
  );
}
