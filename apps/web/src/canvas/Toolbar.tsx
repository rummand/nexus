"use client";

import { ArrowRight, Bot, Box, Circle, Database, Diamond, Filter, Frame, Hand, Heading, Map as MapIcon, Minus, MousePointer2, Redo2, Shapes, Square, StickyNote, Type, Undo2 } from "lucide-react";
import { useCanvas, useCanvasStore, type ConnectorPreset, type Tool } from "./store";

const TOOLS: Array<{ tool: Tool; label: string; key: string; badge?: string; icon: React.ReactNode }> = [
  { tool: "select", label: "Select", key: "V", icon: <MousePointer2 size={22} /> },
  { tool: "hand", label: "Pan", key: "H", icon: <Hand size={22} /> },
  { tool: "frame", label: "Frame", key: "F", badge: "frame", icon: <Frame size={22} /> },
  { tool: "card", label: "Architecture card", key: "C", badge: "card", icon: <Box size={22} /> },
  { tool: "sticky", label: "Note", key: "N", badge: "note", icon: <StickyNote size={22} /> },
  { tool: "text", label: "Text block", key: "T", badge: "text", icon: <Type size={22} /> },
  { tool: "section", label: "Section", key: "S", badge: "section", icon: <Heading size={22} /> },
  { tool: "agent", label: "Agent — put one where the work is", key: "A", badge: "agent", icon: <Bot size={22} /> },
];

const SHAPE_TOOLS = new Set<Tool>(["rect", "ellipse", "diamond", "connector"]);

export function Toolbar() {
  const store = useCanvasStore();
  const tool = useCanvas((s) => s.tool);
  const panels = useCanvas((s) => s.panels);
  const preset = useCanvas((s) => s.connectorPreset);
  const canUndo = useCanvas((s) => s.past.length > 0);
  const canRedo = useCanvas((s) => s.future.length > 0);
  const shapeActive = SHAPE_TOOLS.has(tool);

  const pick = (t: Tool, p?: ConnectorPreset) => {
    store.getState().setTool(t);
    if (p) store.getState().setConnectorPreset(p);
    store.getState().togglePanel("shapePicker", true);
  };

  return (
    <>
      <aside className="canvas-toolbar" aria-label="Board tools" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        {TOOLS.map((t) => (
          <button key={t.tool} className={tool === t.tool ? "tool-button active" : "tool-button"} type="button" aria-label={t.label} title={`${t.label}  ${t.key}`} onClick={() => store.getState().setTool(t.tool)}>
            {t.icon}
            {t.badge && <span className="tool-button-badge">{t.badge}</span>}
          </button>
        ))}
        <button className={shapeActive || panels.shapePicker ? "tool-button active" : "tool-button"} type="button" aria-label="Shapes and lines" title="Shapes and lines" onClick={() => store.getState().togglePanel("shapePicker")}>
          <Shapes size={22} />
          <span className="tool-button-badge">{shapeActive ? (tool === "connector" ? "line" : "draw") : "shape"}</span>
        </button>
        <hr />
        <button className={panels.inventory ? "tool-button active" : "tool-button"} type="button" title="Graph inventory" onClick={() => store.getState().togglePanel("inventory")}>
          <Database size={22} />
          <span className="tool-button-badge">graph</span>
        </button>
        <button className={panels.inspector ? "tool-button active" : "tool-button"} type="button" title="Selection inspector" onClick={() => store.getState().togglePanel("inspector")}>
          <Filter size={22} />
          <span className="tool-button-badge">{panels.inspector ? "on" : "off"}</span>
        </button>
        <button className={panels.map ? "tool-button active" : "tool-button"} type="button" title="Map overview" onClick={() => store.getState().togglePanel("map")}>
          <MapIcon size={22} />
          <span className="tool-button-badge">{panels.map ? "on" : "off"}</span>
        </button>
        <hr />
        <button className="tool-button" type="button" title="Undo  ⌘Z" disabled={!canUndo} onClick={() => store.getState().undo()}><Undo2 size={20} /></button>
        <button className="tool-button" type="button" title="Redo  ⇧⌘Z" disabled={!canRedo} onClick={() => store.getState().redo()}><Redo2 size={20} /></button>
      </aside>

      {panels.shapePicker && (
        <section className="shape-picker-panel fade-in" aria-label="Shapes and lines" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <div className="shape-picker-group">
            <span>Lines</span>
            <button type="button" className={tool === "connector" && preset === "line" ? "active" : ""} onClick={() => pick("connector", "line")}><Minus size={16} /> Line</button>
            <button type="button" className={tool === "connector" && preset === "arrow" ? "active" : ""} onClick={() => pick("connector", "arrow")}><ArrowRight size={16} /> Arrow</button>
            <button type="button" className={tool === "connector" && preset === "dashed" ? "active" : ""} onClick={() => pick("connector", "dashed")}><span style={{ width: 16, borderTop: "2px dashed currentColor" }} /> Dashed arrow</button>
          </div>
          <div className="shape-picker-group">
            <span>Shapes</span>
            <button type="button" className={tool === "rect" ? "active" : ""} onClick={() => pick("rect")}><Square size={16} /> Rectangle</button>
            <button type="button" className={tool === "ellipse" ? "active" : ""} onClick={() => pick("ellipse")}><Circle size={16} /> Oval</button>
            <button type="button" className={tool === "diamond" ? "active" : ""} onClick={() => pick("diamond")}><Diamond size={16} /> Rhombus</button>
          </div>
          <p className="shape-picker-hint">Pick a tool, then click or drag on the canvas. Lines connect two objects: press on the first, release on the second.</p>
        </section>
      )}
    </>
  );
}
