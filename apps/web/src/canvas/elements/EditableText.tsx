"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Textarea used for inline editing inside a canvas element. It sits inside the world
 * transform so it scales with zoom. Pointer events are stopped so the canvas does not
 * start a drag while the user selects text.
 */
export function EditableText({ value, onChange, onDone, style, className, singleLine = false, placeholder }: { value: string; onChange: (v: string) => void; onDone: () => void; style?: CSSProperties; className?: string; singleLine?: boolean; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    // Focus on the next frame: the pointerdown that created this element has a default
    // action (moving focus to the clicked surface) that would otherwise blur us immediately.
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(singleLine ? e.target.value.replace(/\n/g, "") : e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey || singleLine))) {
          e.preventDefault();
          onDone();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={className}
      style={{ resize: "none", outline: "none", border: "none", background: "transparent", width: "100%", height: "100%", overflow: "hidden", ...style }}
    />
  );
}
