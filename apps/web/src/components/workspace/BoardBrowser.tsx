"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, MoveRight, Pencil, Sparkles, Star, Trash2 } from "lucide-react";
import type { Space } from "@/db/schema";
import type { BoardCard } from "@/lib/data";
import { deleteBoard, duplicateBoard, moveBoard, renameBoard, toggleFavorite } from "@/lib/actions";
import { parseDocument } from "@/canvas/document";
import { BoardThumbnail, statsLabel } from "./BoardThumbnail";

export type ViewMode = "list" | "grid";

export function formatOpened(iso: string | null) {
  if (!iso) return "Not opened yet";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function BoardBrowser({ boards, spaces, viewMode, title, subtitle }: { boards: BoardCard[]; spaces: Space[]; viewMode: ViewMode; title: string; subtitle?: string }) {
  const router = useRouter();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [, start] = useTransition();
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));

  return (
    <section className="studio-board-browser">
      <div className="studio-board-browser-title">
        <div>
          <h2>{title}</h2>
          <p>{subtitle ?? `${boards.length} board${boards.length === 1 ? "" : "s"} · frames, cards, notes and viewport are saved per board.`}</p>
        </div>
        <span>{viewMode === "grid" ? "Grid" : "List"} view</span>
      </div>
      <div className={viewMode === "grid" ? "studio-board-grid" : "studio-board-list"}>
        {boards.map((board) => {
          const doc = parseDocument(board.document);
          const renaming = renamingId === board.id;
          return (
            <article key={board.id} className={movingId === board.id ? "studio-board-row move-open" : "studio-board-row"}>
              <button className="studio-board-open" type="button" onClick={() => !renaming && router.push(`/b/${board.id}`)}>
                <BoardThumbnail document={board.document} compact />
                <span className={board.favorite ? "board-glyph starred" : "board-glyph"}>{board.favorite ? "★" : "□"}</span>
                <span>
                  {renaming ? (
                    <input
                      autoFocus
                      className="inline-title"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => { setRenamingId(null); if (renameValue.trim() && renameValue !== board.name) start(() => renameBoard(board.id, renameValue)); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenamingId(null); }}
                      style={{ fontWeight: 700, fontSize: 15, width: "100%" }}
                    />
                  ) : (
                    <strong>{board.name}</strong>
                  )}
                  <small>{board.description || "Architecture board"}</small>
                  <em>{statsLabel(doc)}</em>
                </span>
              </button>
              <span>{formatOpened(board.lastOpenedAt)}</span>
              <span>{board.spaceEmoji} {spaceName.get(board.spaceId) ?? board.spaceName}</span>
              <div className="studio-board-row-actions">
                <button type="button" className={board.favorite ? "starred" : ""} title="Star board" onClick={() => start(() => toggleFavorite(board.id).then(() => undefined))}><Star size={18} /></button>
                <button type="button" title="Rename board" onClick={() => { setRenamingId(board.id); setRenameValue(board.name); }}><Pencil size={18} /></button>
                <button type="button" title="Move board to another space" onClick={() => { setMovingId(movingId === board.id ? null : board.id); setMoveTarget(board.spaceId); }}><MoveRight size={18} /></button>
                <button type="button" title="Duplicate board" onClick={() => start(() => duplicateBoard(board.id))}><Copy size={18} /></button>
                <button type="button" className="danger" title="Delete board" onClick={() => { if (confirm(`Delete "${board.name}"? This cannot be undone.`)) start(() => deleteBoard(board.id)); }}><Trash2 size={18} /></button>
              </div>
              {movingId === board.id && (
                <div className="studio-board-move-panel">
                  <span>Move to space</span>
                  <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                    {spaces.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                  </select>
                  <button type="button" disabled={!moveTarget || moveTarget === board.spaceId} onClick={() => { start(() => moveBoard(board.id, moveTarget)); setMovingId(null); }}>Move</button>
                  <button type="button" onClick={() => setMovingId(null)}>Cancel</button>
                </div>
              )}
            </article>
          );
        })}
        {boards.length === 0 && (
          <div className="studio-empty-boards">
            <Sparkles size={26} />
            <strong>No boards here yet</strong>
            <span>Create a board to open the canvas.</span>
          </div>
        )}
      </div>
    </section>
  );
}
