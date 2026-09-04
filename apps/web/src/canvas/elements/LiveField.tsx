"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useCanvas, useCanvasStore } from "../store";

/**
 * Always-editable field inside a canvas object (LeanFlow pattern): typing never needs an
 * "edit mode". Pointer events stop at the field so the object is not dragged while
 * selecting text; the first change after focus records one undo step.
 */
interface Props {
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
}

export function LiveField({ value, onChange, placeholder, className, style, multiline = false, ariaLabel, autoFocus = false, active = true }: Props) {
  const store = useCanvasStore();
  // Fields only take input with the select tool; with pan/creation tools they are inert so
  // the canvas receives the pointer (LeanFlow's isInteractiveTarget rule).
  const toolInert = useCanvas((s) => s.tool !== "select" || s.spaceDown);
  const inert = toolInert || !active;
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
    onFocus: () => { dirty.current = false; },
    onBlur: () => { dirty.current = false; if (autoFocus) store.getState().startEditing(null); },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!dirty.current) {
        store.getState().pushHistory();
        dirty.current = true;
      }
      onChange(e.target.value);
    },
  };
  return multiline ? <textarea ref={(el) => { ref.current = el; }} {...common} /> : <input ref={(el) => { ref.current = el; }} {...common} />;
}
