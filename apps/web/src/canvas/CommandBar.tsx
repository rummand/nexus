"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Frame, Search, Shapes, Spline, StickyNote, Type } from "lucide-react";
import { elementName, elementTypeLabel, type CanvasElement } from "./document";
import { useCanvas, useCanvasStore } from "./store";

function iconFor(el: CanvasElement) {
  switch (el.type) {
    case "card": return <Box size={13} />;
    case "sticky": return <StickyNote size={13} />;
    case "text": return <Type size={13} />;
    case "frame": return <Frame size={13} />;
    case "shape": return <Shapes size={13} />;
    case "connector": return <Spline size={13} />;
  }
}

function searchText(el: CanvasElement) {
  switch (el.type) {
    case "card": return `${el.kind} ${el.title} ${el.description}`;
    case "sticky": return `${el.title} ${el.text}`;
    case "text": return `${el.title} ${el.text}`;
    case "shape": return el.text;
    case "frame": return el.title;
    case "connector": return el.label;
  }
}

/** Centre-top command bar: finds objects on this board and jumps to them. ⌘K focuses it. */
export function CommandBar() {
  const store = useCanvasStore();
  const elements = useCanvas((s) => s.elements);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return Object.values(elements)
      .map((el) => {
        const text = searchText(el).toLowerCase();
        const score = terms.reduce((acc, t) => acc + (text.includes(t) ? (elementName(el).toLowerCase().startsWith(t) ? 3 : 1) : 0), 0);
        return { el, score };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [elements, query]);

  const go = (el: CanvasElement) => {
    store.getState().focusElement(el.id);
    setOpen(false);
  };

  return (
    <section className="command-bar" aria-label="Board search" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <Search size={24} />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && matches[0]) go(matches[0].el);
          if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
        }}
        placeholder="Search cards, notes, frames on this board — ask questions once the agents arrive"
        spellCheck={false}
      />
      <button className="run-button" type="button" disabled={!matches.length} onClick={() => matches[0] && go(matches[0].el)}>Find</button>
      <span className="keycap">⌘ K</span>
      {open && query.trim() && (
        <div className="search-suggestions" role="listbox">
          <div className="suggestion-header">
            <span>On this board</span>
            <small>{matches.length ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : "no match"}</small>
          </div>
          {matches.map(({ el }) => (
            <button key={el.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(el)}>
              <i>{iconFor(el)}</i>
              <span>
                <strong>{elementName(el)}</strong>
                <small>{elementTypeLabel(el)}</small>
              </span>
            </button>
          ))}
          {!matches.length && <div className="suggestion-empty">Nothing on this board matches “{query.trim()}”.</div>}
        </div>
      )}
    </section>
  );
}
