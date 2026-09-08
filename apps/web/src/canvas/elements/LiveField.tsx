"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { lockedBy } from "@/lib/live/protocol";
import { useCanvas, useCanvasStore } from "../store";

/**
 * Always-editable field inside a canvas object (LeanFlow pattern): typing never needs an
 * "edit mode". Pointer events stop at the field so the object is not dragged while
 * selecting text; the first change after focus records one undo step.
 *
 * It is also where the one thing multiplayer cannot merge is handled (§5.40). Positions and
 * colours merge fine under last-writer-wins; two people typing into one field under the same rule
 * silently eat each other's characters. So a field somebody else is in becomes read-only and says
 * whose it is. The lock is presence, not state: it lifts the moment they blur, close the tab or
 * lose the connection, and there is nothing to release.
 */
interface Props {
  /** The object this field belongs to — the unit the lock is taken on. */
  elementId: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
  ariaLabel?: string;
  /** Focus on mount (used for the title of a freshly created object). */
  autoFocus?: boolean;
  /** Whether the owning object is selected. Unselected objects keep their fields inert so the
   *  first click selects / drags the object (Miro model); the second click edits text. */
  active?: boolean;
  /** id of a <datalist> with suggestions (single-line fields only). */
  list?: string;
}

export function LiveField({ elementId, value, onChange, placeholder, className, style, multiline = false, ariaLabel, autoFocus = false, active = true, list }: Props) {
  const store = useCanvasStore();
  // Fields only take input with the select tool; with pan/creation tools they are inert so
  // the canvas receives the pointer (LeanFlow's isInteractiveTarget rule).
  const toolInert = useCanvas((s) => s.tool !== "select" || s.spaceDown);
  const heldBy = useCanvas((s) => lockedBy(s.peers, elementId));
  const inert = toolInert || !active || heldBy !== null;
  const dirty = useRef(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const raf = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [autoFocus]);
  const common = {
    value,
    placeholder,
    className,
    style: inert ? { ...style, pointerEvents: "none" as const } : style,
    readOnly: inert,
    tabIndex: inert ? -1 : undefined,
    "aria-label": ariaLabel,
    spellCheck: false,
    // pointerdown bubbles to the canvas so the owning object gets selected; the canvas
    // recognises text fields and does not start a drag from them
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      e.stopPropagation();
      if (e.key === "Escape" || (!multiline && e.key === "Enter")) {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    },
    onFocus: () => { dirty.current = false; store.getState().setFocused(elementId); },
    onBlur: () => {
      dirty.current = false;
      if (autoFocus) store.getState().startEditing(null);
      // Only give up the lock if it is still ours: tabbing between two fields of one object
      // fires this blur after the next field's focus.
      if (store.getState().focusedId === elementId) store.getState().setFocused(null);
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!dirty.current) {
        store.getState().pushHistory();
        dirty.current = true;
      }
      onChange(e.target.value);
    },
  };
  const field = multiline
    ? <textarea ref={(el) => { ref.current = el; }} {...common} />
    : <input ref={(el) => { ref.current = el; }} {...common} list={inert ? undefined : list} />;
  if (!heldBy) return field;
  return (
    <span className="field-held" style={{ ["--held-color" as string]: heldBy.color }} title={`${heldBy.name} is editing this`}>
      {field}
    </span>
  );
}
