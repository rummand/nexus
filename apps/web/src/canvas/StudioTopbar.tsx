"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, CircleDot, Copy, Download, History, Image as ImageIcon, Keyboard, Loader2, LogOut, MessageSquare, Presentation, Share2, Sparkles, TriangleAlert } from "lucide-react";
import { documentToSvg } from "./export";
import { svgToPngBlob } from "./png";
import { renameBoard } from "@/lib/actions";
import { NexusMark } from "@/components/workspace/NexusMark";
import { initials } from "@/components/workspace/Sidebar";
import { PeerChips } from "./PeerLayer";
import { useComments } from "./comments/CommentsContext";
import { useCanvas, useCanvasStore } from "./store";

export interface StudioTopbarProps {
  boardId: string;
  workspaceId: string;
  name: string;
  space: { id: string; name: string; emoji: string };
  workspace: { slug: string; name: string };
  user: { id: string; name: string; color: string };
}

export function StudioTopbar({ boardId, name: initialName, space, workspace, user }: StudioTopbarProps) {
  const store = useCanvasStore();
  const [name, setName] = useState(initialName);
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [, start] = useTransition();
  const saveState = useCanvas((s) => s.saveState);
  /* On a live board the room is the writer, so "Saved" would be describing somebody else's work. */
  const live = useCanvas((s) => s.live);
  const count = useCanvas((s) => Object.keys(s.elements).length);
  const zoom = useCanvas((s) => s.camera.zoom);
  const helpOpen = useCanvas((s) => s.panels.help);
  const historyOpen = useCanvas((s) => s.panels.history);
  const composeOpen = useCanvas((s) => s.panels.compose);
  const commentsOpen = useCanvas((s) => s.panels.comments);
  const { open: openComments } = useComments();

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
        <PeerChips />
        <span className="canvas-chip">Canvas: {count} objects / Zoom: {Math.round(zoom * 100)}%</span>
        {saveState === "conflict" ? (
          <button
            type="button"
            className="sync-pill warn"
            title="Somebody else saved this board while you were editing it. Your changes since then are only in this tab."
            onClick={() => window.location.reload()}
            data-save-conflict
          >
            <TriangleAlert size={13} /> Changed elsewhere — reload
          </button>
        ) : (
          <span className={saveState === "error" ? "sync-pill warn" : saveState === "saved" ? "sync-pill" : "sync-pill board-save-pill"}>
            {saveState === "saving" ? <Loader2 size={13} className="spin" /> : saveState === "saved" ? <Check size={13} /> : <CircleDot size={13} />}
            {saveState === "saved" ? (live ? "Shared" : "Saved") : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "Not saved"}
          </span>
        )}
        <button
          className={commentsOpen ? "ghost-button active" : "ghost-button"}
          type="button"
          onClick={() => store.getState().togglePanel("comments")}
          title={openComments ? `${openComments} open conversation${openComments === 1 ? "" : "s"} on this board` : "Conversations about this board"}
          data-comments-button
        >
          <MessageSquare size={16} /> Comments{openComments > 0 && <b className="topbar-count">{openComments}</b>}
        </button>
        <button className={composeOpen ? "ghost-button active" : "ghost-button"} type="button" onClick={() => store.getState().togglePanel("compose")} title="Write the board instead of drawing it"><Sparkles size={16} /> Compose</button>
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
        {/*
          Who you are, in the colour your cursor wears on everybody else's screen (§5.40) — the
          question "which one of these is me" has to have an answer on a shared board. Sign out is
          a form rather than a link, because a GET that ends a session can be fired by any page.
        */}
        <span className="avatar" style={{ background: user.color }} title={`Signed in as ${user.name}`} data-me>{initials(user.name)}</span>
        <form action="/signout" method="post" className="topbar-signout">
          <button type="submit" className="ghost-button" title={`Sign out of ${user.name}`} aria-label="Sign out" data-signout><LogOut size={16} /></button>
        </form>
      </div>
    </header>
  );
}
