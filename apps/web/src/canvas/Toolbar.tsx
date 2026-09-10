"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Bot, Circle, Database, Diamond, Frame, Hand, Map as MapIcon, Minus,
  MousePointer2, PanelRight, Redo2, Square, StickyNote, Type, Undo2,
} from "lucide-react";
import { CARD_KINDS, cardColorForKind } from "./document";
import { useCanvas, useCanvasStore, type ConnectorPreset, type PanelName, type Tool } from "./store";
import {
  LINE_CHOICES, RAIL, SHAPE_CHOICES, isArmed, tipFor,
  type FlyoutName, type RailItem, type ToolItem,
} from "./toolbar";

/**
 * The tool rail (§5.59).
 *
 * Three things were wrong with the one this replaces, and they are the three things a rail can get
 * wrong. Every button wore a permanent 8px caption — "card", "note", "on", "off" — which is the
 * duplication §5.55 spent a whole revision deleting from the rest of the canvas, and the captions
 * were positioned into the gap below each button so the rail read as one crowded column. The
 * shortcuts, which are the thing a returning user actually wants, were hidden in native `title`
 * attributes. And the one submenu was a floating card pinned at an absolute `top: 250px`, so it
 * pointed at whatever button happened to be there — the same class of mistake §5.54 fixed for the
 * property bar, in the one place that had been missed.
 *
 * So: four groups, no captions, a tooltip that carries the keycap, and flyouts measured from the
 * button that opens them. The flyouts are the part that adds rather than removes — a card is
 * placed *as a kind*, a shape and a line are picked once and remembered, and the rail button shows
 * what it is about to make.
 */

/* ---- glyphs the icon set does not have ------------------------------------------------------
 * Drawn rather than imported for the three tools that are this product rather than a whiteboard.
 * The stock icons were actively wrong: a 3D cube for an architecture card, a paragraph-heading
 * mark for a section. An icon that describes the wrong thing is worse than a plain square.
 */

/** A card: a titled object with a type stripe down its left edge, which is what one looks like. */
function CardGlyph({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 4.5v11" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 9h6M8 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
    </svg>
  );
}

/** A section: a band across the board with a name tab, which is what one looks like. */
function SectionGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.5" y="6.5" width="15" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 4.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** A dashed connector, which no icon set draws as a line rather than a border. */
function DashedGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M2 9h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2.5 2.5" />
      <path d="M11 5.5 15.5 9 11 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SHAPE_ICON: Record<string, React.ReactNode> = {
  rect: <Square size={19} />,
  ellipse: <Circle size={19} />,
  diamond: <Diamond size={19} />,
};

const LINE_ICON: Record<ConnectorPreset, React.ReactNode> = {
  arrow: <ArrowRight size={19} />,
  line: <Minus size={19} />,
  dashed: <DashedGlyph />,
};

const PANEL_ICON: Partial<Record<PanelName, React.ReactNode>> = {
  inventory: <Database size={19} />,
  inspector: <PanelRight size={19} />,
  map: <MapIcon size={19} />,
};

const TOOL_ICON: Partial<Record<Tool, React.ReactNode>> = {
  select: <MousePointer2 size={19} />,
  hand: <Hand size={19} />,
  frame: <Frame size={19} />,
  sticky: <StickyNote size={19} />,
  text: <Type size={19} />,
  section: <SectionGlyph />,
  agent: <Bot size={19} />,
};

export function Toolbar() {
  const store = useCanvasStore();
  const tool = useCanvas((s) => s.tool);
  const panels = useCanvas((s) => s.panels);
  const preset = useCanvas((s) => s.connectorPreset);
  const lastShape = useCanvas((s) => s.lastShape);
  const cardKind = useCanvas((s) => s.cardKind);
  const canUndo = useCanvas((s) => s.past.length > 0);
  const canRedo = useCanvas((s) => s.future.length > 0);

  const [open, setOpen] = useState<FlyoutName | null>(null);
  const railRef = useRef<HTMLElement | null>(null);

  /**
   * A flyout closes when you look away: Escape, or a press anywhere that is not the rail.
   *
   * Escape is taken in the capture phase and stopped there, because the canvas listens for Escape
   * too and uses it to disarm the tool. Both firing means opening a menu and pressing Escape
   * leaves you holding nothing, which is not what one press asked for. Escape peels one layer:
   * the menu first, the tool on the next press.
   */
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!railRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(null);
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc, { capture: true });
    };
  }, [open]);

  /** The icon a flyout button wears: whatever it is currently about to make. */
  const iconFor = (item: ToolItem): React.ReactNode => {
    if (item.flyout === "card") return <CardGlyph color={cardColorForKind(cardKind)} />;
    if (item.flyout === "shape") return SHAPE_ICON[lastShape];
    if (item.flyout === "line") return LINE_ICON[preset];
    return TOOL_ICON[item.tool];
  };

  /**
   * Clicking a flyout button arms its remembered choice *and* opens the flyout.
   *
   * Both, because the two readings of a split button are both right: somebody who wants the shape
   * they used last wants one click, and somebody who wants a different one wants the list. Opening
   * the list costs the first person nothing — they are already drawing.
   */
  const clickTool = (item: ToolItem) => {
    if (item.flyout === "shape") store.getState().setTool(lastShape);
    else store.getState().setTool(item.tool);
    setOpen(item.flyout && open !== item.flyout ? item.flyout : null);
  };

  return (
    <aside
      className="canvas-toolbar"
      ref={railRef}
      aria-label="Board tools"
      /* The rail sits under the panels at rest; an open flyout has to clear them. */
      data-flyout-open={open ?? undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {RAIL.map((group, gi) => (
        <div key={group.name} className="tool-group" role="group" aria-label={group.name}>
          {gi > 0 && <hr />}
          {group.items.map((item) => (
            <RailButton
              key={keyOf(item)}
              item={item}
              icon={item.kind === "tool" ? iconFor(item) : item.kind === "panel" ? PANEL_ICON[item.panel] : item.action === "undo" ? <Undo2 size={18} /> : <Redo2 size={18} />}
              active={item.kind === "tool" ? isArmed(item, tool) : item.kind === "panel" ? panels[item.panel] : false}
              disabled={item.kind === "history" && (item.action === "undo" ? !canUndo : !canRedo)}
              open={item.kind === "tool" ? open === item.flyout : false}
              panelOpen={item.kind === "panel" ? panels[item.panel] : false}
              onClick={() => {
                if (item.kind === "tool") clickTool(item);
                else if (item.kind === "panel") store.getState().togglePanel(item.panel);
                else if (item.action === "undo") store.getState().undo();
                else store.getState().redo();
              }}
            >
              {item.kind === "tool" && open === item.flyout && (
                <Flyout name={item.flyout!} onClose={() => setOpen(null)} />
              )}
            </RailButton>
          ))}
        </div>
      ))}
    </aside>
  );
}

const keyOf = (item: RailItem) =>
  item.kind === "tool" ? item.tool : item.kind === "panel" ? item.panel : item.action;

function RailButton({ item, icon, active, disabled, open, panelOpen, onClick, children }: {
  item: RailItem; icon: React.ReactNode; active: boolean; disabled: boolean;
  open: boolean; panelOpen: boolean; onClick: () => void; children?: React.ReactNode;
}) {
  const tip = tipFor(item, panelOpen);
  const hasFlyout = item.kind === "tool" && Boolean(item.flyout);
  return (
    <div className="tool-slot">
      <button
        type="button"
        className={active || open ? "tool-button active" : "tool-button"}
        aria-label={tip.label}
        aria-pressed={item.kind === "panel" ? panelOpen : undefined}
        aria-expanded={hasFlyout ? open : undefined}
        disabled={disabled}
        data-tool={item.kind === "tool" ? item.tool : undefined}
        data-panel-toggle={item.kind === "panel" ? item.panel : undefined}
        data-history={item.kind === "history" ? item.action : undefined}
        onClick={onClick}
      >
        {icon}
        {/* The affordance that says "there is more here", in the corner every tool ever put it. */}
        {hasFlyout && <span className="tool-caret" aria-hidden />}
      </button>
      {/* Styled rather than a native title: a keycap is the half of a tooltip people are reading. */}
      <span className="tool-tip" role="tooltip">
        {tip.label}
        {tip.key && <kbd>{tip.key}</kbd>}
      </span>
      {children}
    </div>
  );
}

/** The submenu, anchored beside the button that owns it rather than to the viewport. */
function Flyout({ name, onClose }: { name: FlyoutName; onClose: () => void }) {
  const store = useCanvasStore();
  const tool = useCanvas((s) => s.tool);
  const preset = useCanvas((s) => s.connectorPreset);
  const cardKind = useCanvas((s) => s.cardKind);

  return (
    <div className="tool-flyout fade-in" role="menu" data-flyout={name} onPointerDown={(e) => e.stopPropagation()}>
      {name === "card" && (
        <>
          <h4>Place a card as</h4>
          <div className="flyout-kinds">
            {CARD_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="menuitemradio"
                aria-checked={cardKind === k.kind}
                className={cardKind === k.kind ? "active" : ""}
                data-card-kind={k.kind}
                onClick={() => { store.getState().setCardKind(k.kind); store.getState().setTool("card"); onClose(); }}
              >
                <i style={{ background: k.color }} />
                {k.kind}
              </button>
            ))}
          </div>
          <p>The kind is what the graph indexes it under. You can change it later in the selection panel.</p>
        </>
      )}

      {name === "shape" && (
        <>
          <h4>Shape</h4>
          {SHAPE_CHOICES.map((c) => (
            <button
              key={c.tool}
              type="button"
              role="menuitemradio"
              aria-checked={tool === c.tool}
              className={tool === c.tool ? "active" : ""}
              data-shape={c.tool}
              onClick={() => { store.getState().setTool(c.tool); onClose(); }}
            >
              {SHAPE_ICON[c.tool]}
              <span>{c.label}</span>
              <kbd>{c.key}</kbd>
            </button>
          ))}
        </>
      )}

      {name === "line" && (
        <>
          <h4>Connection</h4>
          {LINE_CHOICES.map((c) => (
            <button
              key={c.preset}
              type="button"
              role="menuitemradio"
              aria-checked={preset === c.preset}
              className={preset === c.preset ? "active" : ""}
              data-line={c.preset}
              onClick={() => { store.getState().setConnectorPreset(c.preset); store.getState().setTool("connector"); onClose(); }}
            >
              {LINE_ICON[c.preset]}
              <span>{c.label}<small>{c.hint}</small></span>
            </button>
          ))}
          <p>Press on the first object and release on the second. Between two cards it becomes a relation in the graph.</p>
        </>
      )}
    </div>
  );
}
