"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Eye, LayoutTemplate, Pencil, Save, Search, Trash2 } from "lucide-react";
import { deletePage, savePage } from "@/lib/wiki/actions";

/**
 * Editing a page (§5.60).
 *
 * A textarea and a preview, rather than a rich editor, and deliberately so for now: the content
 * that matters here is the embed directives, and a WYSIWYG that hides them behind a widget makes
 * the one thing worth learning invisible. The Insert menu teaches the syntax by writing it.
 */
export function PageEditor({ pageId, slug, initialTitle, initialBody, canEdit }: {
  pageId: string; slug: string; initialTitle: string; initialBody: string; canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canEdit) return null;

  const insert = (text: string) => setBody((b) => (b.endsWith("\n") || !b ? b : `${b}\n`) + text + "\n");

  if (!editing) {
    return (
      <button type="button" className="ghost-button" data-edit-page onClick={() => setEditing(true)}>
        <Pencil size={13} /> Edit
      </button>
    );
  }

  return (
    <div className="wiki-editor" data-wiki-editor>
      <div className="wiki-editor-bar">
        <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Page title" placeholder="Title" />
        <span className="wiki-insert">
          <button type="button" onClick={() => insert(":::board BOARD_ID | caption")}><LayoutTemplate size={12} /> Board</button>
          <button type="button" onClick={() => insert(":::object ENTITY_ID | caption")}><Boxes size={12} /> Object</button>
          <button type="button" onClick={() => insert(':::query kind:Application missing:owner | caption')}><Search size={12} /> Query</button>
        </span>
        <button type="button" className="ghost-button" onClick={() => { setEditing(false); setBody(initialBody); setTitle(initialTitle); }}>
          <Eye size={13} /> Cancel
        </button>
        <button
          type="button" className="primary-home-button" disabled={pending} data-save-page
          onClick={() => start(async () => {
            setError(null);
            const r = await savePage(pageId, { title, body });
            if ("error" in r) { setError(r.error ?? "That did not work."); return; }
            setEditing(false);
            router.refresh();
          })}
        >
          <Save size={13} /> {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Page body"
        spellCheck
        rows={26}
      />
      <p className="wiki-editor-hint">
        Markdown. A line beginning <code>:::board</code>, <code>:::object</code> or <code>:::query</code> embeds
        something from the model and stays current as the model changes. <code>[[Another page]]</code> links
        inside the wiki.
      </p>
      {error && <p className="form-error">{error}</p>}
      <button
        type="button" className="link-button danger" disabled={pending} data-delete-page
        onClick={() => start(async () => {
          const r = await deletePage(pageId);
          if ("error" in r) { setError(r.error ?? "That did not work."); return; }
          router.push(`/w/${slug}/wiki`);
        })}
      >
        <Trash2 size={12} /> Delete this page
      </button>
    </div>
  );
}
