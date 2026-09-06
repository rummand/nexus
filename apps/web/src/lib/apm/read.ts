import { entry, unzip } from "./unzip";

/**
 * Turning whatever somebody dropped on the canvas into rows or prose.
 *
 * The four things an architect actually has are a ServiceNow export, an old spreadsheet, some Word
 * documents and a SharePoint dump. Two of those are tables and two are text, and pretending
 * otherwise is how import features end up only accepting the one format nobody has. So a file
 * lands as one of two shapes and the pipeline branches once, here, rather than everywhere.
 *
 * Everything is pure over a Buffer, so every format is tested without a browser or an upload.
 */

export type ReadFile =
  | { shape: "table"; name: string; format: Format; headers: string[]; rows: string[][]; sheets?: string[]; note?: string }
  | { shape: "text"; name: string; format: Format; text: string; note?: string };

export type Format = "csv" | "tsv" | "json" | "xlsx" | "docx" | "markdown" | "text";

const MAX_ROWS = 20_000;
const MAX_TEXT = 2_000_000;

export function formatOf(name: string, buffer: Buffer): Format {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "csv") return "csv";
  if (ext === "tsv" || ext === "tab") return "tsv";
  if (ext === "json") return "json";
  if (ext === "xlsx" || ext === "xlsm") return "xlsx";
  if (ext === "docx") return "docx";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "txt" || ext === "text") return "text";
  // No extension worth trusting: look at the bytes. A zip could be either Office format.
  if (buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50) {
    const names = unzip(buffer).map((e) => e.name);
    if (names.some((n) => n.startsWith("xl/"))) return "xlsx";
    if (names.some((n) => n === "word/document.xml")) return "docx";
  }
  const head = buffer.subarray(0, 400).toString("utf8").trim();
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  if (head.includes("\t")) return "tsv";
  if (head.includes(",")) return "csv";
  return "text";
}

/** Read one uploaded file. Throws only with a sentence a person can act on. */
export function readFile(name: string, buffer: Buffer): ReadFile {
  const format = formatOf(name, buffer);
  switch (format) {
    case "csv": return { shape: "table", name, format, ...delimited(decode(buffer), ",") };
    case "tsv": return { shape: "table", name, format, ...delimited(decode(buffer), "\t") };
    case "json": return { shape: "table", name, format, ...fromJson(decode(buffer)) };
    case "xlsx": return { shape: "table", name, format, ...fromXlsx(buffer) };
    case "docx": return { shape: "text", name, format, text: fromDocx(buffer).slice(0, MAX_TEXT) };
    default: return { shape: "text", name, format, text: decode(buffer).slice(0, MAX_TEXT) };
  }
}

/**
 * Text out of bytes, allowing for what an old export actually is.
 *
 * A UTF-8 BOM is stripped because a leading zero-width space turns the first column name into
 * something that matches nothing. UTF-16 is detected by its BOM, because that is what a decade-old
 * Windows export often is, and reading it as UTF-8 produces a column called "N\0a\0m\0e".
 */
export function decode(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  const text = buffer.toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Delimited text, done properly: quoted fields, doubled quotes inside them, newlines inside
 * quotes, and CRLF. Every one of those appears in a real ServiceNow export, usually in the
 * description column, and a naive split turns one row into four.
 */
export function delimited(text: string, sep: string): { headers: string[]; rows: string[][]; note?: string } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") { quoted = true; continue; }
    if (ch === sep) { row.push(field); field = ""; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = (nonEmpty.shift() ?? []).map((h, i) => h.trim() || `column ${i + 1}`);
  const body = nonEmpty.slice(0, MAX_ROWS).map((r) => headers.map((_, i) => (r[i] ?? "").trim()));
  return {
    headers,
    rows: body,
    note: nonEmpty.length > MAX_ROWS ? `Only the first ${MAX_ROWS.toLocaleString()} rows were read.` : undefined,
  };
}

/** An array of objects, which is what most systems' JSON export is. */
function fromJson(text: string): { headers: string[]; rows: string[][]; note?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("that file is not valid JSON");
  }
  // ServiceNow wraps its answer in { result: [...] }; so does half the world.
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Object.values(parsed as Record<string, unknown>).find((v): v is unknown[] => Array.isArray(v))
      : undefined;
  if (!Array.isArray(list)) throw new Error("that JSON is not a list of records, and we do not know how to read it");
  const objects = list.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object" && !Array.isArray(r));
  const headers: string[] = [];
  for (const o of objects) for (const k of Object.keys(o)) if (!headers.includes(k)) headers.push(k);
  const rows = objects.slice(0, MAX_ROWS).map((o) => headers.map((h) => flat(o[h])));
  return { headers, rows, note: objects.length < list.length ? "Some entries were not records and were skipped." : undefined };
}

/** ServiceNow returns references as { value, display_value }; take the readable half. */
function flat(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const display = o.display_value ?? o.displayValue ?? o.name ?? o.value;
    return display === undefined ? JSON.stringify(v) : String(display);
  }
  return String(v);
}

// ---- xlsx -------------------------------------------------------------------------------------

/**
 * The first worksheet of a spreadsheet.
 *
 * Cell values are read as they are stored, which for a date means an Excel serial number: the
 * number format that would tell us it is a date lives in styles.xml, and guessing from the number
 * alone would turn a headcount of 45000 into 2023. So it stays a number here, and the mapping step
 * converts it once a person has said which column is a date (§`excelDate`).
 */
export function fromXlsx(buffer: Buffer): { headers: string[]; rows: string[][]; sheets?: string[]; note?: string } {
  const entries = unzip(buffer);
  const shared = sharedStrings(entry(entries, "xl/sharedStrings.xml") ?? "");
  const sheetFiles = entries
    .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const first = sheetFiles[0];
  if (!first) throw new Error("that spreadsheet has no worksheets we can read");
  const names = sheetNames(entry(entries, "xl/workbook.xml") ?? "");

  const grid: string[][] = [];
  let width = 0;
  for (const rowMatch of matchAll(first.data.toString("utf8"), /<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const attrs = rowMatch[1] ?? "";
    const body = rowMatch[2] ?? "";
    const index = Number(/r="(\d+)"/.exec(attrs)?.[1] ?? grid.length + 1) - 1;
    const cells: string[] = [];
    for (const cellMatch of matchAll(body, /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const cellAttrs = cellMatch[1] ?? "";
      const at = columnIndex(/r="([A-Z]+)/.exec(cellAttrs)?.[1] ?? "");
      const type = /t="([^"]+)"/.exec(cellAttrs)?.[1] ?? "n";
      const value = cellValue(cellMatch[2] ?? "", type, shared);
      cells[at >= 0 ? at : cells.length] = value;
    }
    for (let i = 0; i < cells.length; i++) cells[i] ??= "";
    grid[index] = cells;
    width = Math.max(width, cells.length);
  }

  const used = grid.filter((r) => r && r.some((c) => c && c.trim() !== ""));
  const headers = (used.shift() ?? []).map((h, i) => (h ?? "").trim() || `column ${i + 1}`);
  const rows = used.slice(0, MAX_ROWS).map((r) => headers.map((_, i) => (r[i] ?? "").trim()));
  return {
    headers,
    rows,
    sheets: names,
    note: names.length > 1 ? `Only the first sheet (“${names[0]}”) was read; this workbook has ${names.length}.` : undefined,
  };
}

function cellValue(body: string, type: string, shared: string[]): string {
  if (type === "inlineStr") return unescapeXml(strip(body));
  const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
  if (type === "s") return shared[Number(v)] ?? "";
  if (type === "b") return v === "1" ? "true" : "false";
  return unescapeXml(v);
}

function sharedStrings(xml: string): string[] {
  return [...matchAll(xml, /<si>([\s\S]*?)<\/si>/g)].map(([, body]) => unescapeXml(strip(body ?? "")));
}

function sheetNames(xml: string): string[] {
  return [...matchAll(xml, /<sheet\b[^>]*name="([^"]*)"/g)].map(([, name]) => unescapeXml(name ?? ""));
}

/** "A" → 0, "AB" → 27. */
function columnIndex(letters: string): number {
  if (!letters) return -1;
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * An Excel serial number as an ISO date, once somebody has told us the column is one.
 *
 * Day 1 is 1900-01-01, and the format carries Lotus's 1900 leap-year bug: serial 60 is a day that
 * never existed. Anchoring on 1899-12-30 reproduces what Excel shows, which is what the person
 * comparing the two screens expects.
 */
export function excelDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  const ms = Math.round(serial) * 86_400_000 + Date.UTC(1899, 11, 30);
  return new Date(ms).toISOString().slice(0, 10);
}

// ---- docx -------------------------------------------------------------------------------------

/** The readable text of a Word document, with paragraphs kept and everything else dropped. */
export function fromDocx(buffer: Buffer): string {
  const xml = entry(unzip(buffer), "word/document.xml");
  if (!xml) throw new Error("that .docx has no document body we can read");
  return unescapeXml(
    xml
      /*
       * Whitespace between two tags that contains a newline is a pretty-printer's indentation, not
       * content: Word itself writes no whitespace between tags, but a document that has been through
       * a generator or a diff tool has plenty, and it would arrive as blank paragraphs. A deliberate
       * space inside a run never contains a newline, so this leaves those alone.
       */
      .replace(/>\s*\n\s*</g, "><")
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<w:p\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    // A .docx written by Word has no whitespace between tags; one written by a generator, or
    // pretty-printed on its way through some pipeline, does — and that indentation would arrive as
    // leading spaces on every paragraph.
    .split("\n")
    .map((line) => line.replace(/^[ \t]+/, "").replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- shared -------------------------------------------------------------------------------------

const strip = (xml: string) => xml.replace(/<[^>]+>/g, "");

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function* matchAll(text: string, re: RegExp): Generator<RegExpExecArray> {
  const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    yield m;
    if (m.index === rx.lastIndex) rx.lastIndex++;
  }
}
