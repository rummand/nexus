"use client";

import { useState, useTransition } from "react";
import { cx } from "@/components/ui";

/** Click-to-edit heading used for room and team names. */
export function InlineTitle({ value, onCommit, className }: { value: string; onCommit: (v: string) => Promise<void>; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [, start] = useTransition();

  function commit() {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) start(() => onCommit(v));
    else setDraft(value);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={cx("rounded border border-accent-500 bg-white px-1 outline-none", className)}
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className={cx("rounded px-1 text-left hover:bg-ink-100", className)} title="Rename">
      {draft}
    </button>
  );
}
