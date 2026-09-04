"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import type { BoardCard as BoardCardData } from "@/lib/data";
import { deleteBoard, duplicateBoard, renameBoard, toggleFavorite } from "@/lib/actions";
import { cx, timeAgo } from "@/components/ui";
import { BoardThumbnail } from "./BoardThumbnail";

export function BoardCard({ board, showRoom = true }: { board: BoardCardData; showRoom?: boolean }) {
  const [fav, setFav] = useState(board.favorite);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(board.name);
  const [, start] = useTransition();

  function commitRename() {
    setRenaming(false);
    if (name.trim() && name !== board.name) start(() => renameBoard(board.id, name));
    else setName(board.name);
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm transition-shadow hover:shadow-float">
      <Link href={`/b/${board.id}`} className="block aspect-[16/10] bg-ink-50">
        <BoardThumbnail document={board.document} />
      </Link>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setName(board.name);
                  setRenaming(false);
                }
              }}
              className="w-full rounded border border-accent-500 px-1 text-sm font-medium outline-none"
            />
          ) : (
            <Link href={`/b/${board.id}`} className="block truncate text-sm font-medium text-ink-900 hover:text-accent-700">{name}</Link>
          )}
          <div className="mt-0.5 truncate text-[11px] text-ink-500">
            {showRoom && <span>{board.roomEmoji} {board.roomName} · </span>}
            edited {timeAgo(board.updatedAt)}
          </div>
        </div>
        <button
          onClick={() => {
            setFav(!fav);
            start(() => toggleFavorite(board.id).then(() => undefined));
          }}
          className={cx("rounded p-1 transition-colors", fav ? "text-amber-400" : "text-ink-300 opacity-0 group-hover:opacity-100 hover:text-amber-400")}
          aria-label={fav ? "Remove from favourites" : "Add to favourites"}
        >
          <Star size={15} className={fav ? "fill-amber-400" : ""} />
        </button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="rounded p-1 text-ink-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink-100 hover:text-ink-700 data-[open=true]:opacity-100" data-open={menu} aria-label="Board actions">
            <MoreHorizontal size={15} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="fade-in absolute right-0 top-7 z-20 w-40 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 text-[13px] shadow-float">
                <MenuItem icon={<Pencil size={13} />} onClick={() => { setMenu(false); setRenaming(true); }}>Rename</MenuItem>
                <MenuItem icon={<Copy size={13} />} onClick={() => { setMenu(false); start(() => duplicateBoard(board.id)); }}>Duplicate</MenuItem>
                <MenuItem icon={<Trash2 size={13} />} danger onClick={() => { setMenu(false); if (confirm(`Delete "${board.name}"? This cannot be undone.`)) start(() => deleteBoard(board.id)); }}>Delete</MenuItem>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cx("flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-ink-50", danger ? "text-red-600" : "text-ink-700")}>
      {icon}
      {children}
    </button>
  );
}
