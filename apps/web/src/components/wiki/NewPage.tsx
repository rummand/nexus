"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, LayoutTemplate } from "lucide-react";
import { createPage, pageFromBoard } from "@/lib/wiki/actions";

/**
 * Starting a page (§5.60).
 *
 * Two ways, and the second is the one this feature exists for: a board can write its own first
 * draft. Blank pages are how wikis stay empty; a draft that is already half true is how they get
 * started.
 */
export function NewPage({ workspaceId, slug, boards, parentId, prominent }: {
  workspaceId: string;
  slug: string;
  boards: Array<{ id: string; name: string }>;
  parentId?: string;
  prominent?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = (fn: () => Promise<{ slug?: string; error?: string }>) => start(async () => {
    setError(null);
    const r = await fn();
    if (r.error) { setError(r.error); return; }
    setOpen(false);
    setTitle("");
    if (r.slug) router.push(`/w/${slug}/wiki/${r.slug}`);
    router.refresh();
  });

  if (!open) {
    return (
      <button
        type="button"
        className={prominent ? "primary-home-button" : "wiki-new"}
        data-new-page
        onClick={() => setOpen(true)}
      >
        <FilePlus2 size={13} /> New page
      </button>
    );
  }

  return (
    <div className="wiki-new-panel" data-new-page-panel>
      <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) go(() => createPage(workspaceId, { title, parentId })); }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" aria-label="New page title" autoFocus disabled={pending} />
        <button type="submit" disabled={pending || !title.trim()}>Create</button>
      </form>

      {boards.length > 0 && (
        <>
          <h5><LayoutTemplate size={11} /> Or write up a board</h5>
          <ul>
            {boards.slice(0, 12).map((b) => (
              <li key={b.id}>
                <button type="button" disabled={pending} data-writeup={b.id} onClick={() => go(() => pageFromBoard(workspaceId, b.id))}>
                  {b.name}
                </button>
              </li>
            ))}
          </ul>
          <p>The draft embeds the board itself, so it stays current as the board changes.</p>
        </>
      )}

      {error && <p className="form-error">{error}</p>}
      <button type="button" className="link-button" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
