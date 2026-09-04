"use client";

import { memo, type CSSProperties } from "react";
import type { ElementId, FrameElement, ShapeElement, StickyElement, TextElement } from "../document";
import { isBoxElement } from "../document";
import { clamp } from "../geometry";
import { useCanvas, useCanvasStore } from "../store";
import { EditableText } from "./EditableText";

/** Renders one box element, subscribing only to its own slice of the store. */
export const ElementView = memo(function ElementView({ id }: { id: ElementId }) {
  const el = useCanvas((s) => s.elements[id]);
  const editing = useCanvas((s) => s.editingId === id);
  if (!el || !isBoxElement(el)) return null;
  switch (el.type) {
    case "sticky": return <StickyView el={el} editing={editing} />;
    case "text": return <TextView el={el} editing={editing} />;
    case "shape": return <ShapeView el={el} editing={editing} />;
    case "frame": return <FrameView el={el} editing={editing} />;
  }
});

function boxStyle(el: { x: number; y: number; w: number; h: number; z: number }, extra?: CSSProperties): CSSProperties {
  return { position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, zIndex: el.z, ...extra };
}

function useEdit(id: ElementId) {
  const store = useCanvasStore();
  return {
    setText: (text: string) => store.getState().updateElements({ [id]: { text } }),
    setTitle: (title: string) => store.getState().updateElements({ [id]: { title } }),
    done: () => store.getState().startEditing(null),
  };
}

/** Auto-fit font size for a sticky: bigger when there is little text. */
export function stickyFontSize(w: number, h: number, text: string) {
  const len = Math.max(text.length, 8);
  return clamp(Math.sqrt((w * h * 0.6) / len), 11, 26);
}

function StickyView({ el, editing }: { el: StickyElement; editing: boolean }) {
  const { setText, done } = useEdit(el.id);
  const fontSize = stickyFontSize(el.w, el.h, el.text);
  const textStyle: CSSProperties = { fontSize, lineHeight: 1.25, fontWeight: 500, color: "#1e293b", textAlign: "center", padding: 12, fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" };
  return (
    <div
      data-element-id={el.id}
      style={boxStyle(el, { background: el.color, borderRadius: 4, boxShadow: "0 1px 2px rgb(15 23 42 / .12), 0 6px 14px rgb(15 23 42 / .10)" })}
      className="flex items-center justify-center"
    >
      {editing ? (
        <EditableText value={el.text} onChange={setText} onDone={done} placeholder="Type…" style={{ ...textStyle, display: "block" }} />
      ) : (
        <div className="flex h-full w-full items-center justify-center overflow-hidden" style={textStyle}>
          <span>{el.text}</span>
        </div>
      )}
    </div>
  );
}

function TextView({ el, editing }: { el: TextElement; editing: boolean }) {
  const { setText, done } = useEdit(el.id);
  const style: CSSProperties = { fontSize: el.fontSize, lineHeight: 1.3, color: el.color, textAlign: el.align, fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 2 };
  return (
    <div data-element-id={el.id} style={boxStyle(el, { minHeight: el.fontSize * 1.3 })}>
      {editing ? (
        <EditableText value={el.text} onChange={setText} onDone={done} placeholder="Text" style={style} />
      ) : (
        <div style={{ ...style, height: "100%", overflow: "hidden" }}>{el.text || <span style={{ color: "#94a3b8" }}>Text</span>}</div>
      )}
    </div>
  );
}

function ShapeView({ el, editing }: { el: ShapeElement; editing: boolean }) {
  const { setText, done } = useEdit(el.id);
  const sw = 2;
  const textStyle: CSSProperties = { fontSize: 15, lineHeight: 1.3, fontWeight: 500, color: "#0f172a", textAlign: "center", padding: 10, fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" };
  return (
    <div data-element-id={el.id} style={boxStyle(el)} className="flex items-center justify-center">
      <svg width="100%" height="100%" viewBox={`0 0 ${el.w} ${el.h}`} preserveAspectRatio="none" className="absolute inset-0" style={{ overflow: "visible" }}>
        {el.shape === "rect" && <rect x={sw / 2} y={sw / 2} width={Math.max(0, el.w - sw)} height={Math.max(0, el.h - sw)} rx={8} fill={el.fill} stroke={el.stroke} strokeWidth={sw} />}
        {el.shape === "ellipse" && <ellipse cx={el.w / 2} cy={el.h / 2} rx={Math.max(0, el.w / 2 - sw / 2)} ry={Math.max(0, el.h / 2 - sw / 2)} fill={el.fill} stroke={el.stroke} strokeWidth={sw} />}
        {el.shape === "diamond" && <polygon points={`${el.w / 2},${sw / 2} ${el.w - sw / 2},${el.h / 2} ${el.w / 2},${el.h - sw / 2} ${sw / 2},${el.h / 2}`} fill={el.fill} stroke={el.stroke} strokeWidth={sw} strokeLinejoin="round" />}
      </svg>
      <div className="relative flex h-full w-full items-center justify-center" style={{ padding: el.shape === "rect" ? 0 : "12%" }}>
        {editing ? (
          <EditableText value={el.text} onChange={setText} onDone={done} placeholder="Label" style={{ ...textStyle, display: "block" }} />
        ) : (
          <div className="flex h-full w-full items-center justify-center overflow-hidden" style={textStyle}><span>{el.text}</span></div>
        )}
      </div>
    </div>
  );
}

function FrameView({ el, editing }: { el: FrameElement; editing: boolean }) {
  const { setTitle, done } = useEdit(el.id);
  const edge = 6;
  const edgeStyle = (s: CSSProperties): CSSProperties => ({ position: "absolute", pointerEvents: "auto", ...s });
  return (
    <div data-element-id={el.id} style={boxStyle(el, { pointerEvents: "none", zIndex: 0 })}>
      <div className="absolute inset-0 rounded-lg" style={{ background: el.color + "12", border: `2px solid ${el.color}55` }} />
      {/* hit areas: edges + title */}
      <div style={edgeStyle({ left: 0, top: 0, right: 0, height: edge, cursor: "move" })} />
      <div style={edgeStyle({ left: 0, bottom: 0, right: 0, height: edge, cursor: "move" })} />
      <div style={edgeStyle({ left: 0, top: 0, bottom: 0, width: edge, cursor: "move" })} />
      <div style={edgeStyle({ right: 0, top: 0, bottom: 0, width: edge, cursor: "move" })} />
      <div
        className="absolute flex items-center rounded-md px-2 text-[13px] font-semibold text-white"
        style={{ left: 0, top: -30, height: 26, minWidth: 80, maxWidth: "100%", background: el.color, pointerEvents: "auto", cursor: "move", whiteSpace: "nowrap" }}
      >
        {editing ? (
          <EditableText value={el.title} onChange={setTitle} onDone={done} singleLine style={{ fontSize: 13, fontWeight: 600, color: "white", fontFamily: "inherit", lineHeight: "26px", padding: 0, width: Math.max(80, el.title.length * 8 + 16) }} />
        ) : (
          <span className="truncate">{el.title || "Frame"}</span>
        )}
      </div>
    </div>
  );
}
