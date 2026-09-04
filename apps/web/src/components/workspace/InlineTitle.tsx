"use client";

import { useState, useTransition } from "react";

/** Click-to-edit heading used for space and team names. */
export function InlineTitle({ value, onCommit, className }: { value: string; onCommit: (v: string) => Promise<void>; className?: string }) {
  const [draft, setDraft] = useState(value);
  const [, start] = useTransition();
  function commit() {
    const v = draft.trim();
    if (v && v !== value) start(() => onCommit(v));
    else setDraft(value);
  }
  return (
    <input
      className={["inline-title", className ?? ""].join(" ")}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      title="Rename"
      style={{ width: `${Math.max(6, draft.length + 1)}ch` }}
    />
  );
}
