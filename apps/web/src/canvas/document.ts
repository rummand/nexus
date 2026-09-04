/**
 * Canvas document model — the persisted shape of a board.
 *
 * World coordinates only. The camera (screen mapping) is never stored here.
 * `version` is bumped and migrated in `migrateDocument` whenever the shape changes.
 *
 * v2 (2026-09-04): LeanFlow-style objects — `card` (architecture object with kind,
 * title, description), notes with title + body, text blocks with title/body and a
 * `section` variant. Legacy v1 text elements are migrated to text blocks.
 */

export const DOCUMENT_VERSION = 2 as const;

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

/** Note (sticky): a local remark with a title and body, tinted by `color`. */
export interface StickyElement extends BaseElement {
  type: "sticky";
  title: string;
  text: string;
  color: string;
}

/** Text block: a titled paragraph; `section` is the tinted heading variant. */
export interface TextElement extends BaseElement {
  type: "text";
  variant: "text" | "section";
  title: string;
  text: string;
  color: string;
}

/** Architecture object card: the canvas face of a (future) graph entity. */
export interface CardElement extends BaseElement {
  type: "card";
  kind: string;
  color: string;
  title: string;
  description: string;
  /** Free-form attributes (lifecycle, owner, criticality …). Synced to the entity; the set of
   *  keys per kind is the emergent attribute schema. */
  attributes?: Record<string, string>;
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
  /** Path routing; straight when omitted. Relation connectors default to curved. */
  route?: "straight" | "curved" | "elbow";
  arrowEnd: boolean;
  arrowStart: boolean;
  meta?: Meta;
  locked?: boolean;
}

export type BoxElement = StickyElement | TextElement | CardElement | ShapeElement | FrameElement;
export type CanvasElement = BoxElement | ConnectorElement;
export type ElementType = CanvasElement["type"];

import type { Lens } from "./lens";

/** A saved viewpoint: which kinds are dimmed, which lens is active and where the camera sits. */
export interface SavedViewpoint {
  id: string;
  name: string;
  hiddenKinds: string[];
  camera: { x: number; y: number; zoom: number } | null;
  createdAt: string;
  /** Optional lens (impact / attribute) — see `lens.ts`. Older views simply have none. */
  lens?: Lens;
}

export interface CanvasDocument {
  version: typeof DOCUMENT_VERSION;
  elements: Record<ElementId, CanvasElement>;
  viewpoints?: SavedViewpoint[];
}

export function emptyDocument(): CanvasDocument {
  return { version: DOCUMENT_VERSION, elements: {} };
}

export function isBoxElement(el: CanvasElement): el is BoxElement {
  return el.type !== "connector";
}

/** Human label for an element type. */
export function elementTypeLabel(el: CanvasElement): string {
  switch (el.type) {
    case "card": return el.kind || "Card";
    case "sticky": return "Note";
    case "text": return el.variant === "section" ? "Section" : "Text";
    case "shape": return el.shape === "rect" ? "Rectangle" : el.shape === "ellipse" ? "Oval" : "Rhombus";
    case "frame": return "Frame";
    case "connector": return "Connector";
  }
}

/** Display name of an element (title, text, label …). */
export function elementName(el: CanvasElement): string {
  switch (el.type) {
    case "card": return el.title || "Untitled card";
    case "sticky": return el.title || el.text.split("\n")[0] || "Note";
    case "text": return el.title || el.text.split("\n")[0] || (el.variant === "section" ? "Section" : "Text");
    case "shape": return el.text || elementTypeLabel(el);
    case "frame": return el.title || "Frame";
    case "connector": return el.label || "Connector";
  }
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

type LegacyV1Text = { type: "text"; text: string; fontSize?: number; color?: string; align?: string } & Box & { id: string; z: number };

export function migrateDocument(doc: Partial<CanvasDocument> & { version?: number }): CanvasDocument {
  const raw = doc.elements && typeof doc.elements === "object" ? (doc.elements as Record<string, unknown>) : {};
  const version = doc.version ?? 1;
  const elements: CanvasDocument["elements"] = {};
  for (const [id, value] of Object.entries(raw)) {
    const el = value as CanvasElement | LegacyV1Text;
    if (!el || typeof el !== "object" || !("type" in el)) continue;
    if (version < 2) {
      if (el.type === "text" && !("variant" in el)) {
        const legacy = el as LegacyV1Text;
        elements[id] = { id, type: "text", variant: "text", title: "", text: legacy.text ?? "", color: TEXT_COLORS[0], x: legacy.x, y: legacy.y, w: legacy.w, h: Math.max(legacy.h, 90), z: legacy.z };
        continue;
      }
      if (el.type === "sticky" && !("title" in el)) {
        elements[id] = { ...(el as StickyElement), title: "" };
        continue;
      }
    }
    elements[id] = el as CanvasElement;
  }
  const viewpoints = Array.isArray(doc.viewpoints) ? doc.viewpoints.filter((v) => v && typeof v.id === "string" && typeof v.name === "string") : undefined;
  return viewpoints && viewpoints.length ? { version: DOCUMENT_VERSION, elements, viewpoints } : { version: DOCUMENT_VERSION, elements };
}

export function serializeDocument(doc: CanvasDocument): string {
  return JSON.stringify(doc);
}

// ---- palette ---------------------------------------------------------------

/** Note tints (left border + wash). First is the LeanFlow amber. */
export const NOTE_COLORS = ["#ff9800", "#1376d4", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"] as const;
/** Backwards-compatible alias. */
export const STICKY_COLORS = NOTE_COLORS;

export const TEXT_COLORS = ["#1376d4", "#0f766e", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b"] as const;

export const SHAPE_FILLS = ["#FFFFFF", "#EEF6FF", "#ECFDF5", "#FFF7ED", "#FEF2F2", "#F5F3FF", "#F0F9FF", "#F3F4F6"] as const;

export const FRAME_COLORS = ["#1376d4", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"] as const;

export const STROKE_COLORS = ["#475569", "#1376d4", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"] as const;

/** Suggested card kinds. The real meta-model is meant to emerge from data; these are starters. */
export const CARD_KINDS: ReadonlyArray<{ kind: string; color: string }> = [
  { kind: "Application", color: "#f59e0b" },
  { kind: "Business Capability", color: "#10b981" },
  { kind: "Process", color: "#ec4899" },
  { kind: "Interface", color: "#1376d4" },
  { kind: "IT Component", color: "#8b5cf6" },
  { kind: "Data Object", color: "#0ea5e9" },
  { kind: "Provider", color: "#64748b" },
  { kind: "Objective", color: "#ef4444" },
];

export function cardColorForKind(kind: string): string {
  const hit = CARD_KINDS.find((k) => k.kind.toLowerCase() === kind.trim().toLowerCase());
  return hit?.color ?? "#1376d4";
}

/** Attribute keys whose "high"/"critical"/"end of life" values should read as a warning. */
export const RISK_ATTRIBUTE_KEYS = ["risk", "criticality", "lifecycle", "status", "compliance"];
export function attributeIsRisk(key: string, value: string) {
  return RISK_ATTRIBUTE_KEYS.includes(key.trim().toLowerCase()) && /high|critical|end of life|eol|phase out|retire|non.?compliant|red/i.test(value);
}
