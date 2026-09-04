/**
 * Canvas document model — the persisted shape of a board.
 *
 * World coordinates only. The camera (screen mapping) is never stored here.
 * `version` is bumped and migrated in `migrateDocument` whenever the shape changes.
 */

export const DOCUMENT_VERSION = 1 as const;

export type ElementId = string;

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Open metadata bag. Later: references into the knowledge graph (entity id, type, source). */
export type Meta = Record<string, unknown>;

interface BaseElement extends Box {
  id: ElementId;
  /** z-order; higher renders on top. Frames are always drawn below other elements. */
  z: number;
  meta?: Meta;
  locked?: boolean;
}

export interface StickyElement extends BaseElement {
  type: "sticky";
  text: string;
  color: string;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  shape: "rect" | "ellipse" | "diamond";
  text: string;
  fill: string;
  stroke: string;
}

export interface FrameElement extends BaseElement {
  type: "frame";
  title: string;
  color: string;
}

export type ConnectorEnd = { elementId: ElementId } | { point: Point };

export interface ConnectorElement {
  id: ElementId;
  type: "connector";
  z: number;
  from: ConnectorEnd;
  to: ConnectorEnd;
  label: string;
  stroke: string;
  style: "solid" | "dashed";
  arrowEnd: boolean;
  arrowStart: boolean;
  meta?: Meta;
  locked?: boolean;
}

export type BoxElement = StickyElement | TextElement | ShapeElement | FrameElement;
export type CanvasElement = BoxElement | ConnectorElement;
export type ElementType = CanvasElement["type"];

export interface CanvasDocument {
  version: typeof DOCUMENT_VERSION;
  elements: Record<ElementId, CanvasElement>;
}

export function emptyDocument(): CanvasDocument {
  return { version: DOCUMENT_VERSION, elements: {} };
}

export function isBoxElement(el: CanvasElement): el is BoxElement {
  return el.type !== "connector";
}

/** Parse a stored document string defensively; corrupt input yields an empty document. */
export function parseDocument(raw: string | null | undefined): CanvasDocument {
  if (!raw) return emptyDocument();
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasDocument> & { version?: number };
    return migrateDocument(parsed);
  } catch {
    return emptyDocument();
  }
}

export function migrateDocument(doc: Partial<CanvasDocument> & { version?: number }): CanvasDocument {
  // v1 is the first version; future migrations chain here.
  const elements =
    doc.elements && typeof doc.elements === "object" ? (doc.elements as CanvasDocument["elements"]) : {};
  return { version: DOCUMENT_VERSION, elements };
}

export function serializeDocument(doc: CanvasDocument): string {
  return JSON.stringify(doc);
}

// ---- palette ---------------------------------------------------------------

export const STICKY_COLORS = [
  "#FDE68A", // yellow
  "#FCA5A5", // red
  "#FDBA74", // orange
  "#86EFAC", // green
  "#93C5FD", // blue
  "#C4B5FD", // violet
  "#F9A8D4", // pink
  "#E5E7EB", // gray
] as const;

export const SHAPE_FILLS = [
  "#FFFFFF",
  "#EEF2FF",
  "#ECFDF5",
  "#FFF7ED",
  "#FEF2F2",
  "#F5F3FF",
  "#F0F9FF",
  "#F3F4F6",
] as const;

export const FRAME_COLORS = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#64748B"] as const;

export const STROKE_COLORS = ["#334155", "#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444"] as const;
