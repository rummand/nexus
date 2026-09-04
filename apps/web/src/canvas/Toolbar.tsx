"use client";

import { Circle, Frame, Hand, MousePointer2, Redo2, Spline, Square, StickyNote, Type, Undo2 } from "lucide-react";
import { useCanvas, useCanvasStore, type Tool } from "./store";

const TOOLS: Array<{ tool: Tool; label: string; key: string; icon: React.ReactNode }> = [
  { tool: "select", label: "Select", key: "V", icon: <MousePointer2 size={17} /> },
  { tool: "hand", label: "Hand (pan)", key: "H", icon: <Hand size={17} /> },
  { tool: "sticky", label: "Sticky note", key: "N", icon: <StickyNote size={17} /> },
  { tool: "text", label: "Text", key: "T", icon: <Type size={17} /> },
  { tool: "rect", label: "Rectangle", key: "R", icon: <Square size={17} /> },
  { tool: "ellipse", label: "Ellipse", key: "O", icon: <Circle size={17} /> },
  { tool: "frame", label: "Frame (area)", key: "F", icon: <Frame size={17} /> },
  { tool: "connector", label: "Connector", key: "C", icon: <Spline size={17} /> },
];

export function Toolbar() {
  const store = useCanvasStore();
  const tool = useCanvas((s) => s.tool);
  const canUndo = useCanvas((s) => s.past.length > 0);
  const canRedo = useCanvas((s) => s.future.length > 0);

  return (
    <div className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-ink-200 bg-white p-1.5 shadow-float" onPointerDown={(e) => e.stopPropagation()}>
      {TOOLS.map((t) => (
        <ToolButton key={t.tool} active={tool === t.tool} title={`${t.label}  ${t.key}`} onClick={() => store.getState().setTool(t.tool)}>
          {t.icon}
        </ToolButton>
      ))}
      <div className="my-1 h-px bg-ink-200" />
      <ToolButton title="Undo  ⌘Z" disabled={!canUndo} onClick={() => store.getState().undo()}><Undo2 size={17} /></ToolButton>
      <ToolButton title="Redo  ⇧⌘Z" disabled={!canRedo} onClick={() => store.getState().redo()}><Redo2 size={17} /></ToolButton>
    </div>
  );
}

function ToolButton({ children, active, title, onClick, disabled }: { children: React.ReactNode; active?: boolean; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"}`}
    >
      {children}
    </button>
  );
}
