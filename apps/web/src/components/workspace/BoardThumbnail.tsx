import { parseDocument, isBoxElement } from "@/canvas/document";

/** Tiny SVG preview of a board document: boxes only, no text. */
export function BoardThumbnail({ document: raw }: { document: string }) {
  const doc = parseDocument(raw);
  const boxes = Object.values(doc.elements).filter(isBoxElement);
  if (boxes.length === 0) {
    return <div className="flex h-full w-full items-center justify-center text-[11px] text-ink-400">Empty board</div>;
  }
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const pad = 40;
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  const sorted = [...boxes].sort((a, b) => (a.type === "frame" ? -1 : b.type === "frame" ? 1 : a.z - b.z));
  return (
    <svg viewBox={vb} className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {sorted.map((b) => {
        if (b.type === "frame") return <rect key={b.id} x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={b.color + "14"} stroke={b.color} strokeWidth={3} />;
        if (b.type === "sticky") return <rect key={b.id} x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={b.color} />;
        if (b.type === "shape") {
          if (b.shape === "ellipse") return <ellipse key={b.id} cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={b.fill} stroke={b.stroke} strokeWidth={3} />;
          return <rect key={b.id} x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={b.fill} stroke={b.stroke} strokeWidth={3} />;
        }
        return <rect key={b.id} x={b.x} y={b.y + b.h * 0.3} width={Math.min(b.w, b.text.length * b.fontSize * 0.5)} height={b.h * 0.4} rx={2} fill="#94a3b8" />;
      })}
    </svg>
  );
}
