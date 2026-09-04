import type { Box, BoxElement, CanvasElement, ConnectorElement, ConnectorEnd, Point } from "./document";
import { isBoxElement } from "./document";

/**
 * Camera maps world → screen:  screen = world * zoom + (x, y).
 * `x`/`y` are the screen position of the world origin.
 */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function worldToScreen(p: Point, cam: Camera): Point {
  return { x: p.x * cam.zoom + cam.x, y: p.y * cam.zoom + cam.y };
}

export function screenToWorld(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.x) / cam.zoom, y: (p.y - cam.y) / cam.zoom };
}

export function boxToScreen(b: Box, cam: Camera): Box {
  const tl = worldToScreen(b, cam);
  return { x: tl.x, y: tl.y, w: b.w * cam.zoom, h: b.h * cam.zoom };
}

/** Zoom by `factor` keeping the world point under `anchor` (screen) fixed. */
export function zoomCameraAt(cam: Camera, anchor: Point, factor: number): Camera {
  const zoom = clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = zoom / cam.zoom;
  return {
    zoom,
    x: anchor.x - (anchor.x - cam.x) * ratio,
    y: anchor.y - (anchor.y - cam.y) * ratio,
  };
}

/** Set an absolute zoom keeping the world point under `anchor` fixed. */
export function zoomCameraTo(cam: Camera, anchor: Point, zoom: number): Camera {
  return zoomCameraAt(cam, anchor, clamp(zoom, MIN_ZOOM, MAX_ZOOM) / cam.zoom);
}

/** Visible world rectangle for a viewport of `w`×`h` screen pixels. */
export function visibleWorldRect(cam: Camera, w: number, h: number): Box {
  const tl = screenToWorld({ x: 0, y: 0 }, cam);
  const br = screenToWorld({ x: w, y: h }, cam);
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}

/** Camera that fits `bounds` (world) into a `w`×`h` viewport with padding (screen px). */
export function cameraToFit(bounds: Box, w: number, h: number, padding = 64, maxZoom = 1): Camera {
  if (bounds.w <= 0 || bounds.h <= 0) {
    return { x: w / 2 - bounds.x, y: h / 2 - bounds.y, zoom: 1 };
  }
  const zoom = clamp(Math.min((w - padding * 2) / bounds.w, (h - padding * 2) / bounds.h), MIN_ZOOM, maxZoom);
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  return { zoom, x: w / 2 - cx * zoom, y: h / 2 - cy * zoom };
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Fit `bounds` into the viewport area that remains after subtracting `insets` (screen px). */
export function cameraToFitInsets(bounds: Box, w: number, h: number, insets: Insets, maxZoom = 1): Camera {
  const availW = Math.max(120, w - insets.left - insets.right);
  const availH = Math.max(120, h - insets.top - insets.bottom);
  const cx = insets.left + availW / 2;
  const cy = insets.top + availH / 2;
  if (bounds.w <= 0 || bounds.h <= 0) return { x: cx - bounds.x, y: cy - bounds.y, zoom: 1 };
  const zoom = clamp(Math.min(availW / bounds.w, availH / bounds.h), MIN_ZOOM, maxZoom);
  return { zoom, x: cx - (bounds.x + bounds.w / 2) * zoom, y: cy - (bounds.y + bounds.h / 2) * zoom };
}

// ---- boxes -----------------------------------------------------------------

export function unionBoxes(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const b of boxes) {
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function boxContainsBox(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function boxContainsPoint(b: Box, p: Point): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

export function boxCenter(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Normalise a drag rectangle so w/h are positive. */
export function normalizeBox(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

// ---- connectors ------------------------------------------------------------

/** Point where the ray from the box centre towards `toward` exits the box. */
export function boxEdgePoint(b: Box, toward: Point): Point {
  const c = boxCenter(b);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = b.w / 2;
  const hh = b.h / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

export function resolveEndPoint(end: ConnectorEnd, elements: Record<string, CanvasElement>): Point | null {
  if ("point" in end) return end.point;
  const el = elements[end.elementId];
  if (!el || !isBoxElement(el)) return null;
  return boxCenter(el);
}

export interface ConnectorGeometry {
  from: Point;
  to: Point;
  mid: Point;
}

/** Endpoints on element borders (or free points) for a connector. Null if an end is missing. */
export function connectorGeometry(c: ConnectorElement, elements: Record<string, CanvasElement>): ConnectorGeometry | null {
  const fromCenter = resolveEndPoint(c.from, elements);
  const toCenter = resolveEndPoint(c.to, elements);
  if (!fromCenter || !toCenter) return null;
  let from = fromCenter;
  let to = toCenter;
  if ("elementId" in c.from) {
    const el = elements[c.from.elementId] as BoxElement;
    from = boxEdgePoint(el, toCenter);
  }
  if ("elementId" in c.to) {
    const el = elements[c.to.elementId] as BoxElement;
    to = boxEdgePoint(el, fromCenter);
  }
  return { from, to, mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } };
}

/** Bounding box of any element (connectors via their endpoints). */
export function elementBounds(el: CanvasElement, elements: Record<string, CanvasElement>): Box | null {
  if (isBoxElement(el)) return { x: el.x, y: el.y, w: el.w, h: el.h };
  const g = connectorGeometry(el, elements);
  if (!g) return null;
  return normalizeBox(g.from, g.to);
}

export function contentBounds(elements: Record<string, CanvasElement>): Box | null {
  const boxes: Box[] = [];
  for (const el of Object.values(elements)) {
    const b = elementBounds(el, elements);
    if (b) boxes.push(b);
  }
  return unionBoxes(boxes);
}

// ---- resize ----------------------------------------------------------------

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export const HANDLES: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export const MIN_SIZE = 24;

/** Apply a world-space delta to a box via a resize handle, keeping the box at least MIN_SIZE. */
export function resizeBox(start: Box, handle: HandleId, dx: number, dy: number, keepAspect = false): Box {
  let { x, y, w, h } = start;
  const left = handle.includes("w");
  const right = handle.includes("e");
  const top = handle.includes("n");
  const bottom = handle.includes("s");

  if (right) w = Math.max(MIN_SIZE, start.w + dx);
  if (left) {
    const nw = Math.max(MIN_SIZE, start.w - dx);
    x = start.x + (start.w - nw);
    w = nw;
  }
  if (bottom) h = Math.max(MIN_SIZE, start.h + dy);
  if (top) {
    const nh = Math.max(MIN_SIZE, start.h - dy);
    y = start.y + (start.h - nh);
    h = nh;
  }
  if (keepAspect && (left || right) && (top || bottom)) {
    const ratio = start.w / start.h;
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
    if (left) x = start.x + start.w - w;
    if (top) y = start.y + start.h - h;
  }
  return { x, y, w, h };
}

/** Handle position (world) on a box. */
export function handlePoint(b: Box, handle: HandleId): Point {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (handle) {
    case "nw": return { x: b.x, y: b.y };
    case "n": return { x: cx, y: b.y };
    case "ne": return { x: b.x + b.w, y: b.y };
    case "e": return { x: b.x + b.w, y: cy };
    case "se": return { x: b.x + b.w, y: b.y + b.h };
    case "s": return { x: cx, y: b.y + b.h };
    case "sw": return { x: b.x, y: b.y + b.h };
    case "w": return { x: b.x, y: cy };
  }
}

export function handleCursor(handle: HandleId): string {
  switch (handle) {
    case "nw": case "se": return "nwse-resize";
    case "ne": case "sw": return "nesw-resize";
    case "n": case "s": return "ns-resize";
    case "e": case "w": return "ew-resize";
  }
}

/** Snap a value to a grid step. */
export function snap(v: number, step: number) {
  return Math.round(v / step) * step;
}

// ---- connector paths -------------------------------------------------------

export interface ConnectorPath extends ConnectorGeometry {
  /** SVG path data in world coordinates. */
  d: string;
  /** Unit direction of the path as it arrives at `to` / leaves `from` (for arrowheads). */
  endDir: Point;
  startDir: Point;
}

/** Outward unit normal of the box side that contains `p` (p is on the box border). */
export function sideNormal(b: Box, p: Point): Point {
  const dl = Math.abs(p.x - b.x), dr = Math.abs(p.x - (b.x + b.w)), dt = Math.abs(p.y - b.y), db = Math.abs(p.y - (b.y + b.h));
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: -1, y: 0 };
  if (m === dr) return { x: 1, y: 0 };
  if (m === dt) return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function unit(dx: number, dy: number): Point {
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

/** Full path for a connector according to its route. */
export function connectorPath(c: ConnectorElement, elements: Record<string, CanvasElement>): ConnectorPath | null {
  const g = connectorGeometry(c, elements);
  if (!g) return null;
  const route = c.route ?? "straight";
  const fromBox = "elementId" in c.from ? (elements[c.from.elementId] as BoxElement | undefined) : undefined;
  const toBox = "elementId" in c.to ? (elements[c.to.elementId] as BoxElement | undefined) : undefined;
  const straightDir = unit(g.to.x - g.from.x, g.to.y - g.from.y);

  if (route === "curved") {
    const n0 = fromBox ? sideNormal(fromBox, g.from) : straightDir;
    const n1 = toBox ? sideNormal(toBox, g.to) : { x: -straightDir.x, y: -straightDir.y };
    const dist = Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y);
    const k = Math.max(40, Math.min(220, dist / 2.5));
    const c1 = { x: g.from.x + n0.x * k, y: g.from.y + n0.y * k };
    const c2 = { x: g.to.x + n1.x * k, y: g.to.y + n1.y * k };
    const mid = cubicAt(g.from, c1, c2, g.to, 0.5);
    const nearEnd = cubicAt(g.from, c1, c2, g.to, 0.97);
    const nearStart = cubicAt(g.from, c1, c2, g.to, 0.03);
    return { ...g, mid, d: `M ${g.from.x} ${g.from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${g.to.x} ${g.to.y}`, endDir: unit(g.to.x - nearEnd.x, g.to.y - nearEnd.y), startDir: unit(nearStart.x - g.from.x, nearStart.y - g.from.y) };
  }

  if (route === "elbow") {
    const dx = g.to.x - g.from.x;
    const dy = g.to.y - g.from.y;
    const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
    const p1 = horizontalFirst ? { x: g.from.x + dx / 2, y: g.from.y } : { x: g.from.x, y: g.from.y + dy / 2 };
    const p2 = horizontalFirst ? { x: g.from.x + dx / 2, y: g.to.y } : { x: g.to.x, y: g.from.y + dy / 2 };
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    return { ...g, mid, d: `M ${g.from.x} ${g.from.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${g.to.x} ${g.to.y}`, endDir: unit(g.to.x - p2.x, g.to.y - p2.y), startDir: unit(p1.x - g.from.x, p1.y - g.from.y) };
  }

  return { ...g, d: `M ${g.from.x} ${g.from.y} L ${g.to.x} ${g.to.y}`, endDir: straightDir, startDir: straightDir };
}

// ---- alignment snapping ----------------------------------------------------

export interface SnapResult {
  dx: number;
  dy: number;
  guidesX: number[];
  guidesY: number[];
}

/**
 * Snap a moving box to the edges / centres of other boxes (Miro-style smart guides).
 * Returns the correction to apply to the moving box and the guide lines to draw (world coords).
 */
export function snapToBoxes(moving: Box, others: Box[], threshold: number): SnapResult {
  const xs = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const ys = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  let bestX: { delta: number; guide: number } | null = null;
  let bestY: { delta: number; guide: number } | null = null;
  for (const o of others) {
    const ox = [o.x, o.x + o.w / 2, o.x + o.w];
    const oy = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const a of xs) for (const b of ox) {
      const delta = b - a;
      if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) bestX = { delta, guide: b };
    }
    for (const a of ys) for (const b of oy) {
      const delta = b - a;
      if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) bestY = { delta, guide: b };
    }
  }
  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, guidesX: bestX ? [bestX.guide] : [], guidesY: bestY ? [bestY.guide] : [] };
}

// ---- alignment ----------------------------------------------------------------------------

export type AlignMode = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";

/** Per-box translation that aligns `boxes` on one edge / axis of their union. */
export function alignBoxes<T extends Box & { id: string }>(boxes: T[], mode: AlignMode): Record<string, { dx: number; dy: number }> {
  const out: Record<string, { dx: number; dy: number }> = {};
  const u = unionBoxes(boxes);
  if (!u || boxes.length < 2) return out;
  for (const b of boxes) {
    let dx = 0, dy = 0;
    switch (mode) {
      case "left": dx = u.x - b.x; break;
      case "centerX": dx = u.x + u.w / 2 - (b.x + b.w / 2); break;
      case "right": dx = u.x + u.w - (b.x + b.w); break;
      case "top": dy = u.y - b.y; break;
      case "centerY": dy = u.y + u.h / 2 - (b.y + b.h / 2); break;
      case "bottom": dy = u.y + u.h - (b.y + b.h); break;
    }
    if (dx || dy) out[b.id] = { dx, dy };
  }
  return out;
}

/** Spread boxes evenly between the first and last along an axis (equal gaps, order kept). */
export function distributeBoxes<T extends Box & { id: string }>(boxes: T[], axis: "x" | "y"): Record<string, { dx: number; dy: number }> {
  const out: Record<string, { dx: number; dy: number }> = {};
  if (boxes.length < 3) return out;
  const sorted = [...boxes].sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y));
  const first = sorted[0]!, last = sorted[sorted.length - 1]!;
  const span = axis === "x" ? last.x + last.w - first.x : last.y + last.h - first.y;
  const total = sorted.reduce((acc, b) => acc + (axis === "x" ? b.w : b.h), 0);
  const gap = (span - total) / (sorted.length - 1);
  let cursor = axis === "x" ? first.x : first.y;
  for (const b of sorted) {
    const target = cursor;
    const d = target - (axis === "x" ? b.x : b.y);
    if (Math.abs(d) > 0.01) out[b.id] = axis === "x" ? { dx: d, dy: 0 } : { dx: 0, dy: d };
    cursor += (axis === "x" ? b.w : b.h) + gap;
  }
  return out;
}
