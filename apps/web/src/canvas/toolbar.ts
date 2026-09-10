import type { ConnectorPreset, PanelName, Tool } from "./store";

/**
 * What is in the tool rail, as data (§5.59).
 *
 * Held apart from the component for the same reason the meta-model catalogue is (§5.57): a rail is
 * a list of claims about the product — these are the things you can make, these are the panels you
 * can open, this key arms that tool — and a list of claims can be held to invariants by a test
 * instead of by whoever last edited the JSX. Two keys on one letter, a flyout offering a tool the
 * keyboard cannot reach, a button in no group: all mechanical, all invisible in review.
 */

export type ShapeTool = Extract<Tool, "rect" | "ellipse" | "diamond">;

/** A rail button that arms a tool. */
export interface ToolItem {
  kind: "tool";
  tool: Tool;
  label: string;
  /** The letter that arms it, matching TOOL_KEYS in useKeyboard. */
  key: string;
  /** Which flyout it opens, if any. A flyout button also arms its remembered choice on click. */
  flyout?: FlyoutName;
}

/** A rail button that shows or hides a panel. */
export interface PanelItem {
  kind: "panel";
  panel: PanelName;
  label: string;
  /** What the button means when the panel is off — a toggle has to say which way it is. */
  offLabel: string;
}

/** Undo and redo, which are neither. */
export interface HistoryItem {
  kind: "history";
  action: "undo" | "redo";
  label: string;
  key: string;
}

export type RailItem = ToolItem | PanelItem | HistoryItem;

export type FlyoutName = "card" | "shape" | "line";

export interface RailGroup {
  /** Named for the tooltip on the separator, and so a test can talk about it. */
  name: string;
  items: RailItem[];
}

/**
 * Four groups, in the order a hand reaches for them: how you point, what you make, what you look
 * at, and what you undo. The separators are the only labelling — a rail with a caption under every
 * button was the thing §5.55 spent a rev removing from everywhere else.
 */
export const RAIL: RailGroup[] = [
  {
    name: "Pointer",
    items: [
      { kind: "tool", tool: "select", label: "Select", key: "V" },
      { kind: "tool", tool: "hand", label: "Pan", key: "H" },
    ],
  },
  {
    name: "Make",
    items: [
      { kind: "tool", tool: "frame", label: "Frame", key: "F" },
      { kind: "tool", tool: "card", label: "Card", key: "C", flyout: "card" },
      { kind: "tool", tool: "sticky", label: "Note", key: "N" },
      { kind: "tool", tool: "text", label: "Text", key: "T" },
      { kind: "tool", tool: "section", label: "Section", key: "S" },
      { kind: "tool", tool: "rect", label: "Shape", key: "R", flyout: "shape" },
      { kind: "tool", tool: "connector", label: "Connection", key: "L", flyout: "line" },
      { kind: "tool", tool: "agent", label: "Agent", key: "A" },
    ],
  },
  {
    name: "Show",
    items: [
      { kind: "panel", panel: "inventory", label: "Hide the graph inventory", offLabel: "Show the graph inventory" },
      { kind: "panel", panel: "inspector", label: "Hide the selection panel", offLabel: "Show the selection panel" },
      { kind: "panel", panel: "map", label: "Hide the map", offLabel: "Show the map" },
    ],
  },
  {
    name: "History",
    items: [
      { kind: "history", action: "undo", label: "Undo", key: "⌘Z" },
      { kind: "history", action: "redo", label: "Redo", key: "⇧⌘Z" },
    ],
  },
];

export const RAIL_ITEMS: RailItem[] = RAIL.flatMap((g) => g.items);

/** Every tool a flyout can arm, so the rail button can show the one you picked last. */
export const SHAPE_CHOICES: Array<{ tool: ShapeTool; label: string; key: string }> = [
  { tool: "rect", label: "Rectangle", key: "R" },
  { tool: "ellipse", label: "Oval", key: "O" },
  { tool: "diamond", label: "Rhombus", key: "D" },
];

export const LINE_CHOICES: Array<{ preset: ConnectorPreset; label: string; hint: string }> = [
  { preset: "arrow", label: "Arrow", hint: "One direction. The default for a dependency." },
  { preset: "line", label: "Line", hint: "No arrowhead — a relationship with no direction to it." },
  { preset: "dashed", label: "Dashed arrow", hint: "Proposed, planned, or not yet real." },
];

/** Which tools the shape flyout owns, for deciding whether its rail button reads as active. */
export const SHAPE_TOOLS = new Set<Tool>(SHAPE_CHOICES.map((c) => c.tool));

/**
 * Is this rail button the one currently armed?
 *
 * A flyout button is active for *any* of the tools its flyout can arm, not only the one it is
 * showing: pressing O for an oval must light the Shape button even though the button is still
 * displaying a rectangle until it re-renders.
 */
export function isArmed(item: ToolItem, tool: Tool): boolean {
  if (item.flyout === "shape") return SHAPE_TOOLS.has(tool);
  return item.tool === tool;
}

/** "Select · V" — the tooltip line, so the label and its key are never assembled twice. */
export function tipFor(item: RailItem, panelOpen = false): { label: string; key?: string } {
  if (item.kind === "panel") return { label: panelOpen ? item.label : item.offLabel };
  return { label: item.label, key: item.key };
}
