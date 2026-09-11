"use client";

import { useEffect, useRef, useState } from "react";
import type { MetaField } from "@/lib/metamodel";

/**
 * A value you edit by typing in it (§5.77).
 *
 * No edit mode, no save button, no dialog: the text on the page *is* the input. Click it, change
 * it, look away — it is written. The product already works this way on the canvas, where a card's
 * title is a live field and nobody has ever asked where the save button is; a fact sheet that
 * behaved differently would be the odd one out.
 *
 * Three things make that safe rather than alarming:
 *
 * - **It writes on blur, not on keystroke.** One edit is one change in the history, not eleven.
 * - **It says so, quietly.** The word "saved" appears next to the field for a moment. A field that
 *   flashes green on every keystroke teaches people to watch the chrome instead of the content.
 * - **It can be taken back.** The value before the edit is kept, and "undo" puts it straight back —
 *   which is the honest answer to "there is no save button, what if I break something".
 */

export function LiveValue({
  value,
  onCommit,
  field,
  placeholder = "—",
  multiline = false,
  label,
  big = false,
}: {
  value: string;
  onCommit: (next: string) => Promise<void> | void;
  field?: MetaField;
  placeholder?: string;
  multiline?: boolean;
  label: string;
  big?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [previous, setPrevious] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The server is the truth: a value changed elsewhere (an agent, another person) replaces the
  // draft, unless this field is the one being typed in.
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commit = async (next: string) => {
    if (next === value) { setState("idle"); return; }
    setPrevious(value);
    setState("saving");
    await onCommit(next);
    setState("saved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 4000);
  };

  const undo = async () => {
    if (previous === null) return;
    const back = previous;
    setPrevious(null);
    setDraft(back);
    setState("saving");
    await onCommit(back);
    setState("idle");
  };

  const shared = {
    value: draft,
    "aria-label": label,
    placeholder,
    onFocus: () => { focused.current = true; },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => { focused.current = false; void commit(draft); },
  };

  const enumOptions = field?.dataType === "enum" ? field.options.filter(Boolean) : [];

  return (
    <div className={`live-value${big ? " big" : ""}`} data-live-value={label}>
      {enumOptions.length > 0 ? (
        <select
          value={draft}
          aria-label={label}
          onChange={(e) => { setDraft(e.target.value); void commit(e.target.value); }}
          data-live-select
        >
          <option value="">—</option>
          {enumOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          {draft && !enumOptions.includes(draft) && <option value={draft}>{draft} (not an allowed value)</option>}
        </select>
      ) : multiline ? (
        <textarea {...shared} rows={Math.max(2, Math.min(10, draft.split("\n").length + 1))} data-live-text />
      ) : (
        <input
          {...shared}
          type={field?.dataType === "number" ? "text" : field?.dataType === "date" ? "text" : "text"}
          inputMode={field?.dataType === "number" ? "decimal" : undefined}
          onKeyDown={(e) => { if (e.key === "Enter" && !multiline) (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); } }}
          data-live-input
        />
      )}
      <span className={`live-state ${state}`} aria-live="polite">
        {state === "saving" && "saving…"}
        {state === "saved" && (
          <>
            saved
            {previous !== null && <button type="button" onClick={() => void undo()} data-live-undo>undo</button>}
          </>
        )}
      </span>
    </div>
  );
}
