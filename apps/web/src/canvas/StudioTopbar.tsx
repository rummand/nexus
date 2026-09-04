"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, CircleDot, History, Keyboard, Loader2, Share2 } from "lucide-react";
import { renameBoard } from "@/lib/actions";
import { NexusMark } from "@/components/workspace/NexusMark";
import { initials } from "@/components/workspace/Sidebar";
import { useCanvas, useCanvasStore } from "./store";

export interface StudioTopbarProps {
  boardId: string;
  workspaceId: string;
  name: string;
  space: { id: string; name: string; emoji: string };
  workspace: { slug: string; name: string };
  user: { name: string; color: string };
}

export function StudioTopbar({ boardId, name: initialName, space, workspace, user }: StudioTopbarProps) {
  const store = useCanvasStore();
  const [name, setName] = useState(initialName);
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const saveState = useCanvas((s) => s.saveState);
  const count = useCanvas((s) => Object.keys(s.elements).length);
  const zoom = useCanvas((s) => s.camera.zoom);
  const helpOpen = useCanvas((s) => s.panels.help);
  const historyOpen = useCanvas((s) => s.panels.history);

  const commit = () => {
    const v = name.trim();
    if (!v) return setName(initialName);
    if (v !== initialName) start(() => renameBoard(boardId, v));
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <header className="studio-topbar">
      <div className="brand-block">
        <Link href={`/w/${workspace.slug}/spaces/${space.id}`} className="back-home-button" aria-label={`Back to ${space.name}`}><ArrowLeft size={17} /></Link>
        <Link href={`/w/${workspace.slug}`} className="brand-mark" aria-label="Nexus home"><NexusMark /></Link>
        <div style={{ minWidth: 0 }}>
          <h1>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setName(initialName); (e.target as HTMLInputElement).blur(); } }} aria-label="Board name" style={{ width: `${Math.max(8, name.length + 1)}ch`, maxWidth: 420 }} />
          </h1>
          <p>
            Board / {name} · Space / <Link href={`/w/${workspace.slug}/spaces/${space.id}`}>{space.emoji} {space.name}</Link> · Workspace / <Link href={`/w/${workspace.slug}`}>{workspace.name}</Link>
          </p>
        </div>
      </div>
      <div className="topbar-meta">
        <span className="canvas-chip">Canvas: {count} objects / Zoom: {Math.round(zoom * 100)}%</span>
        <span className={saveState === "error" ? "sync-pill warn" : saveState === "saved" ? "sync-pill" : "sync-pill board-save-pill"}>
          {saveState === "saving" ? <Loader2 size={13} className="spin" /> : saveState === "saved" ? <Check size={13} /> : <CircleDot size={13} />}
          {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "Not saved"}
        </span>
        <button className={historyOpen ? "ghost-button active" : "ghost-button"} type="button" onClick={() => store.getState().togglePanel("history")} title="Version history"><History size={16} /> History</button>
        <button className={helpOpen ? "ghost-button active" : "ghost-button"} type="button" onClick={() => store.getState().togglePanel("help")} title="Keyboard shortcuts"><Keyboard size={16} /> Shortcuts</button>
        <button className="ghost-button" type="button" onClick={() => void share()}><Share2 size={16} /> {copied ? "Link copied" : "Share"}</button>
        <span className="avatar" title={user.name}>{initials(user.name)}</span>
      </div>
    </header>
  );
}
