"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useLocalStorageValue } from "@/lib/useLocalStorageValue";
import { Database, FileText, Grid3X3, LayoutList, Network, Plus, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Space } from "@/db/schema";
import type { BoardCard } from "@/lib/data";
import { createBoard } from "@/lib/actions";
import { parseDocument } from "@/canvas/document";
import type { TemplateId } from "@/canvas/templates";
import { BoardBrowser, type ViewMode } from "./BoardBrowser";
import { BoardThumbnail, statsLabel } from "./BoardThumbnail";
import { NewBoardDialog } from "./NewBoardDialog";
import { InlineTitle } from "./InlineTitle";

export type HomeMode = "home" | "space" | "recent" | "starred";

export interface HomeMainProps {
  workspaceId: string;
  heading: string;
  headingEmoji?: string;
  /** When provided, the heading becomes editable and commits through this action. */
  onRenameHeading?: (value: string) => Promise<void>;
  meta: string;
  boards: BoardCard[];
  spaces: Space[];
  mode: HomeMode;
  /** When set, "Create new" and starters create directly in this space. */
  spaceId?: string;
  lastOpened?: BoardCard | null;
  initialQuery?: string;
  headerExtra?: ReactNode;
  /** Knowledge-graph summary for the home strip. */
  graph?: { entities: number; kinds: number; relations: number; proposals: number; slug: string; recent?: Array<{ id: string; name: string; kind: string; updatedAt: string; color: string }> };
}

const VIEW_KEY = "nexus.boardView";

const STARTERS: Array<{ id: TemplateId; icon: ReactNode; title: string; hint: string }> = [
  { id: "blank", icon: <Plus size={32} />, title: "Blank board", hint: "Start with an empty architecture canvas." },
  { id: "capability", icon: <Sparkles size={32} />, title: "Capability map", hint: "Capabilities as frames, applications as cards." },
  { id: "landscape", icon: <Network size={32} />, title: "Application landscape", hint: "Applications, interfaces and dependencies." },
  { id: "integration", icon: <FileText size={32} />, title: "Integration flows", hint: "Systems and the data that moves between them." },
];

export function HomeMain({ workspaceId, heading, headingEmoji, onRenameHeading, meta, boards, spaces, mode, spaceId, lastOpened, initialQuery = "", headerExtra, graph }: HomeMainProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [storedView, storeView] = useLocalStorageValue(VIEW_KEY, "list");
  const view: ViewMode = storedView === "grid" ? "grid" : "list";
  const [dialog, setDialog] = useState<{ open: boolean; template: TemplateId }>({ open: false, template: "blank" });
  const [pending, start] = useTransition();

  const changeView = (v: ViewMode) => storeView(v);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((b) => {
      if (b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || b.spaceName.toLowerCase().includes(q)) return true;
      const doc = parseDocument(b.document);
      return Object.values(doc.elements).some((el) => JSON.stringify(el).toLowerCase().includes(q));
    });
  }, [boards, query]);

  const recent = useMemo(() => boards.filter((b) => b.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? "")).slice(0, 4), [boards]);

  const startTemplate = (template: TemplateId) => {
    if (spaceId) start(() => createBoard({ workspaceId, spaceId, template, name: template === "blank" ? "" : STARTERS.find((s) => s.id === template)?.title }));
    else setDialog({ open: true, template });
  };

  const browserTitle = query.trim()
    ? `Results for “${query.trim()}”`
    : mode === "recent" ? "Recent boards" : mode === "starred" ? "Starred boards" : mode === "space" ? "Boards in this space" : "All boards";

  return (
    <section className="studio-home-main">
      <header className="studio-home-topbar">
        <div>
          <span>{meta}</span>
          <h1 className="flex items-center gap-3">
            {headingEmoji && <span>{headingEmoji}</span>}
            {onRenameHeading ? <InlineTitle value={heading} onCommit={onRenameHeading} /> : heading}
          </h1>
        </div>
        <div className="studio-home-actions">
          {/* server-rendered slot kept as a single child: React 19 validates keys on RSC elements in lists */}
          {headerExtra && <span className="contents">{headerExtra}</span>}
          {lastOpened && <button className="ghost-button" type="button" onClick={() => router.push(`/b/${lastOpened.id}`)}>Open last board</button>}
          <button className={view === "grid" ? "ghost-button active" : "ghost-button"} type="button" onClick={() => changeView("grid")} title="Grid view"><Grid3X3 size={18} /></button>
          <button className={view === "list" ? "ghost-button active" : "ghost-button"} type="button" onClick={() => changeView("list")} title="List view"><LayoutList size={18} /></button>
          <button className="primary-home-button" type="button" disabled={pending} onClick={() => startTemplate("blank")}>
            <Plus size={18} /> Create new
          </button>
        </div>
      </header>

      {(mode === "home" || mode === "space") && (
        <>
          <section className="studio-start-panel">
            <h2>How do you want to start?</h2>
            <label>
              <Search size={24} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search boards, spaces, cards or notes — or pick a starter below" />
              <span className="keycap">⌘ K</span>
            </label>
          </section>
          <section className="studio-starters" aria-label="Board starters">
            {STARTERS.map((s) => (
              <button key={s.id} type="button" disabled={pending} onClick={() => startTemplate(s.id)}>
                {s.icon}
                <strong>{s.title}</strong>
                <span>{s.hint}</span>
              </button>
            ))}
          </section>
        </>
      )}

      {mode === "home" && graph && !query.trim() && (
        <Link href={`/w/${graph.slug}/graph`} className="graph-strip" aria-label="Knowledge graph summary">
          <span className="graph-strip-icon"><Database size={20} /></span>
          <span className="graph-strip-body">
            <strong>Knowledge graph</strong>
            <small>{graph.entities} entities · {graph.kinds} kinds · {graph.relations} relations — every card on every board is part of it</small>
          </span>
          {graph.proposals > 0 ? <span className="graph-strip-badge warn">{graph.proposals} agent proposal{graph.proposals === 1 ? "" : "s"}</span> : <span className="graph-strip-badge">consistent</span>}
          <span className="graph-strip-cta">Open graph →</span>
        </Link>
      )}
      {mode === "home" && graph?.recent && graph.recent.length > 0 && !query.trim() && (
        <div className="graph-recent" aria-label="Recently changed entities">
          <span>Recently changed</span>
          {graph.recent.map((e) => (
            <Link key={e.id} href={`/e/${e.id}`} className="graph-recent-chip" title={`${e.kind || "Untyped"} · updated ${new Date(e.updatedAt).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}>
              <i style={{ background: e.color }} />
              <b>{e.name || "(unnamed)"}</b>
              <small>{e.kind || "Untyped"}</small>
            </Link>
          ))}
        </div>
      )}

      {mode === "home" && !query.trim() && recent.length > 0 && (
        <section className="studio-recents-strip" aria-label="Recent boards">
          <div className="studio-board-browser-title">
            <div>
              <h2>Recent boards</h2>
              <p>Jump back into the last architecture rooms you touched.</p>
            </div>
          </div>
          <div className="studio-recent-board-list">
            {recent.map((b) => (
              <button key={b.id} className="studio-recent-board-card" type="button" onClick={() => router.push(`/b/${b.id}`)}>
                <BoardThumbnail document={b.document} />
                <strong>{b.name}</strong>
                <small>{b.description || `${b.spaceEmoji} ${b.spaceName}`}</small>
                <em>{statsLabel(parseDocument(b.document))}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      <BoardBrowser boards={filtered} spaces={spaces} viewMode={view} title={browserTitle} />

      <NewBoardDialog key={`${dialog.open}-${dialog.template}-${spaceId ?? ""}`} open={dialog.open} onClose={() => setDialog((d) => ({ ...d, open: false }))} workspaceId={workspaceId} spaces={spaces} defaultSpaceId={spaceId} defaultTemplate={dialog.template} />
    </section>
  );
}
