"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, CircleDot, Copy, Download, History, Image as ImageIcon, Keyboard, Loader2, Presentation, Share2 } from "lucide-react";
import { documentToSvg } from "./export";
import { svgToPngBlob } from "./png";
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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
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

  const svg = () => documentToSvg(store.getState().toDocument(), { title: name });
  const save = (blob: Blob, extension: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w.-]+/g, "_") || "board"}.${extension}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const downloadSvg = () => {
    save(new Blob([svg()], { type: "image/svg+xml;charset=utf-8" }), "svg");
    setExportNote("SVG downloaded");
    setExportOpen(false);
  };
  const downloadPng = () => {
    setExportOpen(false);
    setExportNote("Rendering PNG…");
    void svgToPngBlob(svg(), 2)
      .then((blob) => { save(blob, "png"); setExportNote("PNG downloaded"); })
      .catch((e) => setExportNote(e instanceof Error ? e.message : "PNG export failed"));
  };
  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(svg());
      setExportNote("SVG copied to the clipboard");
    } catch {
      setExportNote("Clipboard unavailable");
    }
    setExportOpen(false);
  };
  const present = () => { setExportOpen(false); store.getState().setPresenting(true); };

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
        <span className="export-anchor">
          <button className={exportOpen ? "ghost-button active" : "ghost-button"} type="button" onClick={() => setExportOpen((v) => !v)} aria-haspopup="menu" aria-expanded={exportOpen} data-export-button><Download size={16} /> {exportNote && !exportOpen ? exportNote : "Export"}</button>
          {exportOpen && (
            <div className="export-menu" role="menu" data-export-menu>
              <button type="button" role="menuitem" onClick={downloadSvg}><Download size={14} /> Download SVG<small>Vector, opens in Figma / PowerPoint / browsers</small></button>
              <button type="button" role="menuitem" onClick={downloadPng} data-export-png><ImageIcon size={14} /> Download PNG<small>2× raster for slides and chat</small></button>
              <button type="button" role="menuitem" onClick={() => void copySvg()}><Copy size={14} /> Copy SVG<small>Paste into a document or design tool</small></button>
              <button type="button" role="menuitem" onClick={present}><Presentation size={14} /> Present<small>Hide the chrome and fit the board · Esc to leave</small></button>
            </div>
          )}
        </span>
        <button className="ghost-button" type="button" onClick={() => void share()}><Share2 size={16} /> {copied ? "Link copied" : "Share"}</button>
        <span className="avatar" title={user.name}>{initials(user.name)}</span>
      </div>
    </header>
  );
}
