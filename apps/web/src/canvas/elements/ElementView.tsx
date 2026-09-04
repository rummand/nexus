"use client";

import { memo, type CSSProperties } from "react";
import { cardColorForKind, FRAME_COLORS, isBoxElement, type CardElement, type ElementId, type FrameElement, type ShapeElement, type StickyElement, type TextElement } from "../document";
import { useCanvas, useCanvasStore } from "../store";
import { EditableText } from "./EditableText";
import { LiveField } from "./LiveField";

/** Renders one box element, subscribing only to its own slice of the store. */
export const ElementView = memo(function ElementView({ id }: { id: ElementId }) {
  const el = useCanvas((s) => s.elements[id]);
  const selected = useCanvas((s) => s.selection.includes(id));
  const editing = useCanvas((s) => s.editingId === id);
  if (!el || !isBoxElement(el)) return null;
  switch (el.type) {
    case "card": return <CardView el={el} selected={selected} fresh={editing} />;
    case "sticky": return <NoteView el={el} selected={selected} fresh={editing} />;
    case "text": return <TextBlockView el={el} selected={selected} fresh={editing} />;
    case "shape": return <ShapeView el={el} selected={selected} editing={editing} />;
    case "frame": return <FrameView el={el} selected={selected} />;
  }
});

function boxStyle(el: { x: number; y: number; w: number; h: number; z: number }, extra?: CSSProperties): CSSProperties {
  return { left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z, ...extra };
}

function usePatch<T extends object>(id: ElementId) {
  const store = useCanvasStore();
  return (p: Partial<T>) => store.getState().updateElements({ [id]: p as never });
}

function CardView({ el, selected, fresh }: { el: CardElement; selected: boolean; fresh: boolean }) {
  const patch = usePatch<CardElement>(el.id);
  const dimmed = useCanvas((s) => s.hiddenKinds.includes(el.kind));
  const cls = ["board-object", "fact-card", selected ? "selected" : "", dimmed ? "dimmed" : ""].filter(Boolean).join(" ");
  return (
    <div data-element-id={el.id} className={cls} style={boxStyle(el, { "--card-color": el.color } as CSSProperties)}>
      <span className="fact-kind">
        <i />
        <LiveField active={selected} value={el.kind} placeholder="Kind (e.g. Application)" ariaLabel="Card kind" onChange={(kind) => patch({ kind, color: cardColorForKind(kind) === "#1376d4" && el.color !== "#1376d4" ? el.color : cardColorForKind(kind) })} />
      </span>
      <LiveField active={selected} className="fact-title" value={el.title} placeholder="Name" ariaLabel="Card title" autoFocus={fresh} onChange={(title) => patch({ title })} />
      <LiveField active={selected} className="fact-desc" multiline value={el.description} placeholder="Description" ariaLabel="Card description" onChange={(description) => patch({ description })} style={{ flex: 1 }} />
    </div>
  );
}

function NoteView({ el, selected, fresh }: { el: StickyElement; selected: boolean; fresh: boolean }) {
  const patch = usePatch<StickyElement>(el.id);
  return (
    <div data-element-id={el.id} className={selected ? "board-object impact-note selected" : "board-object impact-note"} style={boxStyle(el, { "--note-color": el.color } as CSSProperties)}>
      <span>Note</span>
      <LiveField active={selected} className="impact-note-title-input" value={el.title} placeholder="Title" ariaLabel="Note title" autoFocus={fresh} onChange={(title) => patch({ title })} />
      <LiveField active={selected} className="impact-note-body-input" multiline value={el.text} placeholder="Write a note…" ariaLabel="Note body" onChange={(text) => patch({ text })} />
    </div>
  );
}

function TextBlockView({ el, selected, fresh }: { el: TextElement; selected: boolean; fresh: boolean }) {
  const patch = usePatch<TextElement>(el.id);
  const cls = ["board-object", "board-text-block", el.variant === "section" ? "section" : "", selected ? "selected" : ""].filter(Boolean).join(" ");
  return (
    <div data-element-id={el.id} className={cls} style={boxStyle(el, { "--text-block-color": el.color } as CSSProperties)}>
      <div className="board-text-block-title">
        <LiveField active={selected} value={el.title} placeholder={el.variant === "section" ? "Section title" : "Title"} ariaLabel="Title" autoFocus={fresh} onChange={(title) => patch({ title })} />
        <span>{el.variant}</span>
      </div>
      <LiveField active={selected} multiline value={el.text} placeholder={el.variant === "section" ? "Describe this section…" : "Write text…"} ariaLabel="Body" onChange={(text) => patch({ text })} />
    </div>
  );
}

function ShapeView({ el, selected, editing }: { el: ShapeElement; selected: boolean; editing: boolean }) {
  const store = useCanvasStore();
  const patch = usePatch<ShapeElement>(el.id);
  const cls = ["board-object", "board-shape-object", el.shape, selected ? "selected" : ""].filter(Boolean).join(" ");
  return (
    <div data-element-id={el.id} className={cls} style={boxStyle(el, { "--shape-fill": el.fill, "--shape-stroke": el.stroke } as CSSProperties)}>
      <div className="board-shape-geometry" />
      {editing ? (
        <EditableText value={el.text} onChange={(text) => patch({ text })} onDone={() => store.getState().startEditing(null)} placeholder="Label" style={{ position: "relative", fontSize: 15, fontWeight: 600, textAlign: "center", padding: 10, color: "#0f172a", fontFamily: "inherit" }} />
      ) : (
        <div className="board-shape-label">{el.text || <span style={{ color: "#a5afc0" }}>Double-click to label</span>}</div>
      )}
    </div>
  );
}

function FrameView({ el, selected }: { el: FrameElement; selected: boolean }) {
  const store = useCanvasStore();
  const patch = usePatch<FrameElement>(el.id);
  const order = useCanvas((s) => {
    const frames = Object.values(s.elements).filter((e) => e.type === "frame").sort((a, b) => a.z - b.z);
    return frames.findIndex((f) => f.id === el.id) + 1;
  });
  const edge = 8;
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <section data-element-id={el.id} className={selected ? "board-object board-frame selected" : "board-object board-frame"} style={boxStyle(el, { "--frame-color": el.color, zIndex: 0 } as CSSProperties)}>
      <div className="board-frame-edge" style={{ left: 0, top: 0, right: 0, height: edge, cursor: "move" }} />
      <div className="board-frame-edge" style={{ left: 0, bottom: 0, right: 0, height: edge, cursor: "move" }} />
      <div className="board-frame-edge" style={{ left: 0, top: 0, bottom: 0, width: edge, cursor: "move" }} />
      <div className="board-frame-edge" style={{ right: 0, top: 0, bottom: 0, width: edge, cursor: "move" }} />
      <div className="board-frame-titlebar">
        <LiveField active={selected} value={el.title} placeholder="Frame" ariaLabel="Frame title" onChange={(title) => patch({ title })} style={{ width: `${Math.max(6, el.title.length + 1)}ch`, maxWidth: 320 }} />
        <span>#{order}</span>
        <button type="button" onPointerDown={stop} onClick={(e) => { e.stopPropagation(); const i = FRAME_COLORS.indexOf(el.color as (typeof FRAME_COLORS)[number]); store.getState().updateElements({ [el.id]: { color: FRAME_COLORS[(i + 1) % FRAME_COLORS.length] } }, { history: true }); }}>Color</button>
        <button type="button" onPointerDown={stop} onClick={(e) => { e.stopPropagation(); store.getState().focusElement(el.id); }}>Focus</button>
        <button type="button" className="danger" onPointerDown={stop} onClick={(e) => { e.stopPropagation(); store.getState().deleteElements([el.id]); }}>Delete</button>
      </div>
    </section>
  );
}
