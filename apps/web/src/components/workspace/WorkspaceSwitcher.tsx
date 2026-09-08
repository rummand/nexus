"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { createWorkspace } from "@/lib/workspace-actions";

/**
 * Which workspace you are in, and how to be in another (§5.48).
 *
 * It sits where the workspace name already was, because that line was already answering the
 * question — it just could not answer it a second way. Closed it is the label it replaces; open it
 * is the list, which for most people has one thing in it and costs nothing.
 */
export interface WorkspaceChoice {
  id: string;
  slug: string;
  name: string;
  role: string;
}

export function WorkspaceSwitcher({ current, workspaces }: { current: { slug: string; name: string }; workspaces: WorkspaceChoice[] }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // One workspace and no way to make another would be a menu with one item in it; there is a way,
  // so the control is always here, but it stays quiet.
  return (
    <div className="ws-switcher" data-workspace-switcher>
      <button type="button" className="ws-switcher-current" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <span>{current.name}</span>
        <ChevronsUpDown size={13} />
      </button>

      {open && (
        <div className="ws-switcher-menu" role="menu">
          {workspaces.map((w) => (
            <Link key={w.id} href={`/w/${w.slug}`} role="menuitem" className={w.slug === current.slug ? "on" : ""} onClick={() => setOpen(false)}>
              <span>{w.name}</span>
              <small>{w.role}</small>
              {w.slug === current.slug && <Check size={13} />}
            </Link>
          ))}

          {creating ? (
            <form
              className="ws-switcher-new"
              onSubmit={(e) => {
                e.preventDefault();
                const value = String(new FormData(e.currentTarget).get("name") ?? "");
                start(async () => {
                  const r = await createWorkspace(value);
                  // A successful create redirects, so anything returned here is a refusal.
                  if (r && "error" in r) setError(r.error);
                });
              }}
            >
              <input name="name" placeholder="Organisation or division" aria-label="New workspace name" required autoFocus />
              <button type="submit" className="ghost-button" disabled={pending}>Create</button>
            </form>
          ) : (
            <button type="button" className="ws-switcher-add" onClick={() => setCreating(true)} data-new-workspace>
              <Plus size={13} /> New workspace
            </button>
          )}
          {error && <small className="ws-switcher-error">{error}</small>}
        </div>
      )}
    </div>
  );
}
