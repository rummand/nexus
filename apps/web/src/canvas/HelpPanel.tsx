"use client";

import { Keyboard } from "lucide-react";
import { useCanvasStore } from "./store";

export function HelpPanel() {
  const store = useCanvasStore();
  return (
    <section className="floating-panel shortcut-panel fade-in" aria-label="Keyboard shortcuts" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <div className="panel-title" style={{ cursor: "default" }}>
        <Keyboard size={18} />
        Shortcuts
        <div className="panel-title-actions"><button type="button" onClick={() => store.getState().togglePanel("help", false)}>Hide</button></div>
      </div>
      <h3>Navigation</h3>
      <Row k="Scroll / two fingers">Pan</Row>
      <Row k="⌘ + scroll · pinch">Zoom at cursor</Row>
      <Row k="Space + drag · middle mouse">Pan</Row>
      <Row k="⇧1 · ⇧2">Fit board · Fit selection</Row>
      <Row k="⌘0 · ⌘+ · ⌘−">100% · in · out</Row>
      <Row k="⌘K">Search this board</Row>
      <h3>Tools</h3>
      <Row k="V · H">Select · Pan</Row>
      <Row k="F · C · N">Frame · Card · Note</Row>
      <Row k="T · S">Text · Section</Row>
      <Row k="R · O · D · L">Rectangle · Oval · Rhombus · Line</Row>
      <Row k="Double-click">Label a shape · new note on empty canvas</Row>
      <h3>Editing</h3>
      <Row k="⌘Z · ⇧⌘Z">Undo · Redo</Row>
      <Row k="⌘C · ⌘V · ⌘D">Copy · Paste · Duplicate</Row>
      <Row k="⌘A · ⌫ · Esc">Select all · Delete · Deselect</Row>
      <Row k="Arrows · ⇧Arrows">Nudge 1 · 10</Row>
      <Row k="⌘] · ⌘[">Bring to front · Send to back</Row>
    </section>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="shortcut-row">
      <span>{children}</span>
      <kbd>{k}</kbd>
    </div>
  );
}
