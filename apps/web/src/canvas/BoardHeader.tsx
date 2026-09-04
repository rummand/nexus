"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronLeft, CloudOff, Keyboard, Loader2 } from "lucide-react";
import { renameBoard } from "@/lib/actions";
import { Avatar } from "@/components/ui";
import { useCanvas } from "./store";

export interface BoardHeaderProps {
  boardId: string;
  name: string;
  room: { id: string; name: string; emoji: string };
  workspaceSlug: string;
  user: { name: string; color: string };
}

export function BoardHeader({ boardId, name: initialName, room, workspaceSlug, user }: BoardHeaderProps) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [help, setHelp] = useState(false);
  const [, start] = useTransition();
  const saveState = useCanvas((s) => s.saveState);

  const commit = () => {
    setEditing(false);
    const v = name.trim();
    if (!v) return setName(initialName);
    if (v !== initialName) start(() => renameBoard(boardId, v));
  };

  return (
    <>
      <div className="absolute left-4 top-4 z-20 flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1 pr-3 shadow-float" onPointerDown={(e) => e.stopPropagation()}>
        <Link href={`/w/${workspaceSlug}/rooms/${room.id}`} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900" title={`Back to ${room.name}`}>
          <ChevronLeft size={18} />
        </Link>
        <div className="flex flex-col leading-tight">
          <Link href={`/w/${workspaceSlug}/rooms/${room.id}`} className="text-[11px] text-ink-500 hover:text-ink-900">{room.emoji} {room.name}</Link>
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setName(initialName); setEditing(false); }
              }}
              className="-mx-1 rounded border border-accent-500 px-1 text-sm font-semibold outline-none"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="-mx-1 truncate rounded px-1 text-left text-sm font-semibold hover:bg-ink-100" title="Rename board">{name}</button>
          )}
        </div>
        <span className="ml-3 flex items-center gap-1 text-[11px] text-ink-400" title={saveState}>
          {saveState === "saving" && <><Loader2 size={12} className="animate-spin" /> Saving</>}
          {saveState === "saved" && <><Check size={12} /> Saved</>}
          {saveState === "dirty" && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
          {saveState === "error" && <span className="flex items-center gap-1 text-red-600"><CloudOff size={12} /> Not saved</span>}
        </span>
      </div>

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => setHelp((h) => !h)} className={`flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 bg-white shadow-float ${help ? "text-accent-700" : "text-ink-600 hover:text-ink-900"}`} title="Keyboard shortcuts">
          <Keyboard size={16} />
        </button>
        <div className="flex h-9 items-center rounded-lg border border-ink-200 bg-white px-1.5 shadow-float"><Avatar name={user.name} color={user.color} size={26} /></div>
      </div>

      {help && (
        <div className="fade-in absolute right-4 top-16 z-20 w-72 rounded-lg border border-ink-200 bg-white p-3 text-[12px] shadow-float" onPointerDown={(e) => e.stopPropagation()}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Navigation</div>
          <Shortcut k="Scroll / two fingers">Pan</Shortcut>
          <Shortcut k="⌘ + scroll · pinch">Zoom at cursor</Shortcut>
          <Shortcut k="Space + drag · middle mouse">Pan</Shortcut>
          <Shortcut k="⇧1 · ⌘1">Zoom to fit</Shortcut>
          <Shortcut k="⇧2 · ⌘2">Zoom to selection</Shortcut>
          <Shortcut k="⌘0 · ⌘+ · ⌘−">100% · in · out</Shortcut>
          <div className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Tools</div>
          <Shortcut k="V · H">Select · Hand</Shortcut>
          <Shortcut k="N · T">Sticky · Text</Shortcut>
          <Shortcut k="R · O · F · C">Rectangle · Ellipse · Frame · Connector</Shortcut>
          <Shortcut k="Double-click">Edit text · new sticky on empty canvas</Shortcut>
          <div className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Editing</div>
          <Shortcut k="⌘Z · ⇧⌘Z">Undo · Redo</Shortcut>
          <Shortcut k="⌘C · ⌘V · ⌘D">Copy · Paste · Duplicate</Shortcut>
          <Shortcut k="⌘A · ⌫ · Esc">Select all · Delete · Deselect</Shortcut>
          <Shortcut k="Arrows · ⇧Arrows">Nudge 1 · 10</Shortcut>
          <Shortcut k="⌘] · ⌘[">Bring to front · Send to back</Shortcut>
        </div>
      )}
    </>
  );
}

function Shortcut({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-ink-700">{children}</span>
      <kbd className="shrink-0 rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-600">{k}</kbd>
    </div>
  );
}
