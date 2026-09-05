/**
 * SVG → PNG in the browser, for "Download PNG" in the export menu.
 *
 * The SVG produced by `documentToSvg` is self-contained (no external images), so it can be
 * rasterised by handing it to an <img> and drawing that onto a canvas. Fonts resolve from the
 * system at draw time, which is why the export uses a plain family stack rather than a webfont.
 */

/** Largest dimension we will rasterise to, so a huge board cannot blow up browser memory. */
export const MAX_PNG_EDGE = 8000;

/** Width/height from the SVG's own viewBox, so callers need not parse it themselves. */
export function svgSize(svg: string): { width: number; height: number } {
  const m = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!m) return { width: 1600, height: 1000 };
  return { width: Math.ceil(Number(m[3])), height: Math.ceil(Number(m[4])) };
}

/**
 * Scale that keeps both edges within MAX_PNG_EDGE, never exceeding the requested scale.
 * Exported so the UI can tell the user what it will actually produce.
 */
export function fitScale(width: number, height: number, wanted: number): number {
  const longest = Math.max(width, height) * wanted;
  return longest <= MAX_PNG_EDGE ? wanted : Math.max(1, (MAX_PNG_EDGE / Math.max(width, height)));
}

export async function svgToPngBlob(svg: string, wantedScale = 2): Promise<Blob> {
  const { width, height } = svgSize(svg);
  const scale = fitScale(width, height, wantedScale);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not rasterise the board"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    // The SVG paints its own background, but fill first so any rounding gap is not transparent.
    ctx.fillStyle = "#f6f8fb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
