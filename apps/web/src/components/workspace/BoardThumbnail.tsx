import { parseDocument, isBoxElement, type CanvasDocument } from "@/canvas/document";
import { connectorGeometry, contentBounds } from "@/canvas/geometry";

const W = 200;
const H = 120;

/** Counts shown under board cards. */
export function documentStats(doc: CanvasDocument) {
  const els = Object.values(doc.elements);
  return {
    cards: els.filter((e) => e.type === "card").length,
    notes: els.filter((e) => e.type === "sticky").length,
    text: els.filter((e) => e.type === "text").length,
    frames: els.filter((e) => e.type === "frame").length,
    shapes: els.filter((e) => e.type === "shape").length,
    connectors: els.filter((e) => e.type === "connector").length,
    total: els.length,
  };
}

export function statsLabel(doc: CanvasDocument) {
  const s = documentStats(doc);
  return `${s.cards} cards · ${s.frames} frames · ${s.notes} notes · ${s.connectors} connectors`;
}

/** LeanFlow-style SVG preview: frames, cards, notes, text, connectors as tinted blocks. */
export function BoardThumbnail({ document: raw, compact = false }: { document: string; compact?: boolean }) {
  const doc = parseDocument(raw);
  const bounds = contentBounds(doc.elements);
  const els = Object.values(doc.elements);
  const cls = compact ? "studio-board-row-thumb" : "studio-board-thumb";
  if (!bounds || els.length === 0) {
    return (
      <svg className={cls} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <rect className="board-thumb-bg" x={0.5} y={0.5} width={W - 1} height={H - 1} rx={12} />
        {!compact && <text className="board-thumb-empty" x={W / 2} y={H / 2 + 4}>Blank board</text>}
      </svg>
    );
  }
  const pad = 24;
  const scale = Math.min((W - pad * 2) / Math.max(bounds.w, 1), (H - pad * 2) / Math.max(bounds.h, 1));
  const ox = (W - bounds.w * scale) / 2 - bounds.x * scale;
  const oy = (H - bounds.h * scale) / 2 - bounds.y * scale;
  const tx = (x: number) => ox + x * scale;
  const ty = (y: number) => oy + y * scale;
  const frames = els.filter((e) => e.type === "frame");
  const others = els.filter((e) => isBoxElement(e) && e.type !== "frame");
  return (
    <svg className={cls} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <rect className="board-thumb-bg" x={0.5} y={0.5} width={W - 1} height={H - 1} rx={12} />
      {frames.map((f) => f.type === "frame" && (
        <rect key={f.id} className="board-thumb-frame" x={tx(f.x)} y={ty(f.y)} width={Math.max(6, f.w * scale)} height={Math.max(5, f.h * scale)} rx={4} stroke={f.color} strokeWidth={compact ? 1.2 : 1.6} />
      ))}
      {els.map((c) => {
        if (c.type !== "connector") return null;
        const g = connectorGeometry(c, doc.elements);
        if (!g) return null;
        return <line key={c.id} className={c.style === "dashed" ? "board-thumb-connector dashed" : "board-thumb-connector"} x1={tx(g.from.x)} y1={ty(g.from.y)} x2={tx(g.to.x)} y2={ty(g.to.y)} />;
      })}
      {others.map((e) => {
        if (!isBoxElement(e)) return null;
        const w = Math.max(4, e.w * scale);
        const h = Math.max(3, e.h * scale);
        const common = { x: tx(e.x), y: ty(e.y), width: w, height: h, rx: 2 };
        if (e.type === "card") return <rect key={e.id} {...common} fill={e.color} />;
        if (e.type === "sticky") return <rect key={e.id} className="board-thumb-note" {...common} fill={e.color} />;
        if (e.type === "text") return <rect key={e.id} className={e.variant === "section" ? "board-thumb-text section" : "board-thumb-text"} {...common} fill={e.color} />;
        return <rect key={e.id} className="board-thumb-shape" {...common} />;
      })}
    </svg>
  );
}
