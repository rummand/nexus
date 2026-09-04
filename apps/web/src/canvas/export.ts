import type { CanvasDocument, CanvasElement, CardElement, FrameElement, ShapeElement, StickyElement, TextElement } from "./document";
import { attributeIsRisk, isBoxElement } from "./document";
import { connectorPath, contentBounds } from "./geometry";

/**
 * Render a board document to a standalone SVG string — the export behind "Download SVG".
 * It is a faithful-enough rendition of the DOM canvas (LeanFlow card / note / frame styling),
 * not pixel identical: text wraps by an approximate character width and long text is clipped.
 */

const FONT = "'IBM Plex Sans', Aptos, 'Segoe UI', system-ui, sans-serif";
const PAD = 60;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Greedy word wrap on an approximate glyph width (0.55 em). */
export function wrapText(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const perChar = fontSize * 0.55;
  const maxChars = Math.max(1, Math.floor(maxWidth / perChar));
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars) line = next;
      else {
        if (line) lines.push(line);
        line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
      }
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  if (lines.length === maxLines && text.length > lines.join(" ").length) lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/…$/, "").slice(0, -1)}…`;
  return lines;
}

function textBlock(x: number, y: number, lines: string[], size: number, opts: { fill?: string; weight?: number; anchor?: "start" | "middle"; lineHeight?: number } = {}): string {
  const lh = opts.lineHeight ?? size * 1.3;
  return lines.map((l, i) => `<text x="${x}" y="${y + i * lh}" font-size="${size}" font-weight="${opts.weight ?? 500}" fill="${opts.fill ?? "#172033"}" text-anchor="${opts.anchor ?? "start"}" dominant-baseline="hanging">${esc(l)}</text>`).join("");
}

function card(el: CardElement): string {
  const out: string[] = [];
  out.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="13" fill="#ffffff" stroke="#d6e0ec" stroke-width="2"/>`);
  out.push(`<rect x="${el.x + 16}" y="${el.y + 15}" width="15" height="15" rx="3" fill="${el.color}"/>`);
  out.push(textBlock(el.x + 40, el.y + 16, [el.kind || "Untyped"], 12, { fill: "#758196", weight: 800 }));
  let y = el.y + 40;
  const title = wrapText(el.title || "Untitled", el.w - 32, 16, 2);
  out.push(textBlock(el.x + 16, y, title, 16, { weight: 700, fill: "#1c2637", lineHeight: 19 }));
  y += title.length * 19 + 6;
  const attrs = Object.entries(el.attributes ?? {}).slice(0, 3);
  if (attrs.length) {
    let cx = el.x + 16;
    for (const [k, v] of attrs) {
      const label = `${k} · ${v}`;
      const w = Math.min(el.w - 32, label.length * 6.2 + 14);
      if (cx + w > el.x + el.w - 16) break;
      const risk = attributeIsRisk(k, v);
      out.push(`<rect x="${cx}" y="${y}" width="${w}" height="18" rx="7" fill="${risk ? "#fff5f5" : "#f8fbff"}" stroke="${risk ? "#f3c2c2" : "#dbe8f6"}"/>`);
      out.push(`<text x="${cx + 7}" y="${y + 4}" font-size="10" font-weight="800" fill="${risk ? "#c24141" : "#53627a"}" dominant-baseline="hanging">${esc(label.length * 6.2 + 14 > w ? `${label.slice(0, Math.floor((w - 14) / 6.2) - 1)}…` : label)}</text>`);
      cx += w + 5;
    }
    y += 24;
  }
  const room = el.y + el.h - 14 - y;
  if (el.description && room > 14) out.push(textBlock(el.x + 16, y, wrapText(el.description, el.w - 32, 12, Math.max(1, Math.floor(room / 16))), 12, { fill: "#53627a", weight: 600, lineHeight: 16 }));
  return out.join("");
}

function note(el: StickyElement): string {
  const out: string[] = [];
  out.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="12" fill="${el.color}22" stroke="${el.color}" stroke-width="2"/>`);
  out.push(textBlock(el.x + 14, el.y + 12, ["NOTE"], 9, { fill: "#8a95a8", weight: 900 }));
  const title = wrapText(el.title, el.w - 28, 13, 2);
  out.push(textBlock(el.x + 14, el.y + 28, title, 13, { weight: 800, lineHeight: 16 }));
  const y = el.y + 28 + title.length * 16 + 4;
  const room = el.y + el.h - 12 - y;
  if (el.text && room > 12) out.push(textBlock(el.x + 14, y, wrapText(el.text, el.w - 28, 11, Math.max(1, Math.floor(room / 14))), 11, { fill: "#53627a", weight: 600, lineHeight: 14 }));
  return out.join("");
}

function textEl(el: TextElement): string {
  const out: string[] = [];
  if (el.variant === "section") out.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="12" fill="${el.color}14" stroke="${el.color}55" stroke-width="1.5"/>`);
  const title = wrapText(el.title, el.w - 24, el.variant === "section" ? 15 : 14, 2);
  out.push(textBlock(el.x + 12, el.y + 12, title, el.variant === "section" ? 15 : 14, { weight: 800, fill: el.variant === "section" ? "#1c2637" : "#172033", lineHeight: 18 }));
  const y = el.y + 12 + title.length * 18 + 4;
  const room = el.y + el.h - 10 - y;
  if (el.text && room > 12) out.push(textBlock(el.x + 12, y, wrapText(el.text, el.w - 24, 12, Math.max(1, Math.floor(room / 16))), 12, { fill: "#53627a", weight: 600, lineHeight: 16 }));
  return out.join("");
}

function shape(el: ShapeElement): string {
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  let body: string;
  if (el.shape === "ellipse") body = `<ellipse cx="${cx}" cy="${cy}" rx="${el.w / 2}" ry="${el.h / 2}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="2"/>`;
  else if (el.shape === "diamond") body = `<polygon points="${cx},${el.y} ${el.x + el.w},${cy} ${cx},${el.y + el.h} ${el.x},${cy}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="2"/>`;
  else body = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="10" fill="${el.fill}" stroke="${el.stroke}" stroke-width="2"/>`;
  const lines = wrapText(el.text, el.w * 0.7, 13, 3);
  const text = lines.length ? lines.map((l, i) => `<text x="${cx}" y="${cy - ((lines.length - 1) * 16) / 2 + i * 16}" font-size="13" font-weight="700" fill="#172033" text-anchor="middle" dominant-baseline="middle">${esc(l)}</text>`).join("") : "";
  return body + text;
}

function frame(el: FrameElement): string {
  return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="16" fill="${el.color}0d" stroke="${el.color}" stroke-width="2"/>` +
    `<rect x="${el.x}" y="${el.y - 32}" width="${Math.min(el.w, Math.max(80, (el.title || "Frame").length * 8.5 + 28))}" height="26" rx="13" fill="#ffffff" stroke="#d9e1eb"/>` +
    textBlock(el.x + 14, el.y - 26, [el.title || "Frame"], 13, { weight: 800, fill: "#34445c" });
}

function arrow(tip: { x: number; y: number }, dir: { x: number; y: number }, fill: string): string {
  const a = Math.atan2(dir.y, dir.x), s = 12;
  const p = (ang: number) => `${tip.x + s * Math.cos(ang)},${tip.y + s * Math.sin(ang)}`;
  return `<polygon points="${tip.x},${tip.y} ${p(a + Math.PI * 0.82)} ${p(a - Math.PI * 0.82)}" fill="${fill}"/>`;
}

export function documentToSvg(doc: CanvasDocument, opts: { title?: string; background?: string } = {}): string {
  const elements = doc.elements;
  const bounds = contentBounds(elements) ?? { x: 0, y: 0, w: 800, h: 600 };
  const x = Math.floor(bounds.x - PAD), y = Math.floor(bounds.y - PAD - 32), w = Math.ceil(bounds.w + PAD * 2), h = Math.ceil(bounds.h + PAD * 2 + 32);
  const boxes = Object.values(elements).filter(isBoxElement).sort((a, b) => (a.type === "frame" ? -1 : 0) - (b.type === "frame" ? -1 : 0) || a.z - b.z);
  const parts: string[] = [];
  for (const el of boxes) {
    switch (el.type) {
      case "frame": parts.push(frame(el)); break;
      case "card": parts.push(card(el)); break;
      case "sticky": parts.push(note(el)); break;
      case "text": parts.push(textEl(el)); break;
      case "shape": parts.push(shape(el)); break;
    }
  }
  const connectors = Object.values(elements).filter((e): e is Extract<CanvasElement, { type: "connector" }> => e.type === "connector").sort((a, b) => a.z - b.z);
  for (const c of connectors) {
    const p = connectorPath(c, elements);
    if (!p) continue;
    parts.push(`<path d="${p.d}" fill="none" stroke="${c.stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${c.style === "dashed" ? ' stroke-dasharray="8 6"' : ""}/>`);
    if (c.arrowEnd) parts.push(arrow(p.to, p.endDir, c.stroke));
    if (c.arrowStart) parts.push(arrow(p.from, { x: -p.startDir.x, y: -p.startDir.y }, c.stroke));
    if (c.label) {
      const lw = c.label.length * 6.6 + 16;
      parts.push(`<rect x="${p.mid.x - lw / 2}" y="${p.mid.y - 10}" width="${lw}" height="20" rx="10" fill="#ffffff" stroke="#d9e1eb"/>`);
      parts.push(`<text x="${p.mid.x}" y="${p.mid.y}" font-size="11" font-weight="800" fill="#34445c" text-anchor="middle" dominant-baseline="middle">${esc(c.label)}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}">` +
    (opts.title ? `<title>${esc(opts.title)}</title>` : "") +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opts.background ?? "#f6f8fb"}"/>` +
    parts.join("") +
    `</svg>`;
}
