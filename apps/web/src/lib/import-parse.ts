import type { ImportPayload } from "./graph-types";

/** Pure CSV / JSON parsing for graph imports — shared by the server action and the client-side preview. */

const norm = (v: string) => v.trim().toLowerCase();

/** Parse CSV text into an import payload. Entities: kind,name[,description]. Relations: from,relation,to. */
export function parseImportText(text: string): ImportPayload {
  const trimmed = text.trim();
  if (!trimmed) return { entities: [], relations: [] };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as Partial<ImportPayload> | ImportPayload["entities"];
    if (Array.isArray(parsed)) return { entities: parsed, relations: [] };
    return { entities: parsed.entities ?? [], relations: parsed.relations ?? [] };
  }
  const entities: ImportPayload["entities"] = [];
  const relations: ImportPayload["relations"] = [];
  let mode: "entities" | "relations" = "entities";
  let attributeColumns: string[] = [];
  let descriptionColumn = 2; // -1 when the header has no "description" column: every extra column is an attribute
  for (const line of trimmed.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    if (/^#\s*relations/i.test(l)) { mode = "relations"; continue; }
    if (/^#\s*entities/i.test(l)) { mode = "entities"; continue; }
    if (l.startsWith("#")) continue;
    const cells = splitCsv(l);
    const header = cells.map(norm);
    if (header[0] === "kind" && header[1] === "name") {
      mode = "entities";
      descriptionColumn = header[2] === "description" ? 2 : -1;
      attributeColumns = cells.slice(descriptionColumn === 2 ? 3 : 2).map((c) => c.trim());
      continue;
    }
    if (header[0] === "from" && (header[1] === "relation" || header[1] === "kind")) { mode = "relations"; continue; }
    if (mode === "entities") {
      const attributes: Record<string, string> = {};
      const firstAttr = descriptionColumn === 2 ? 3 : 2;
      if (attributeColumns.length) {
        attributeColumns.forEach((col, i) => { const v = cells[firstAttr + i]; if (col && v && v.trim()) attributes[col] = v.trim(); });
      }
      entities.push({ kind: cells[0] ?? "", name: cells[1] ?? "", description: descriptionColumn === 2 ? cells[2] ?? "" : "", ...(Object.keys(attributes).length ? { attributes } : {}) });
    } else relations.push({ from: cells[0] ?? "", kind: cells[1] ?? "", to: cells[2] ?? "" });
  }
  return { entities, relations };
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if ((ch === "," || ch === ";") && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export interface ImportPreview {
  entities: number;
  newEntities: number;
  existingEntities: number;
  kinds: Array<{ kind: string; count: number }>;
  attributeKeys: string[];
  relations: number;
  warnings: string[];
}

/**
 * What an import *would* do, judged against the entities already in the graph (matched by
 * kind + name, case-insensitive, like the server does).
 */
export function previewImport(payload: ImportPayload, existing: Array<{ kind: string; name: string }>): ImportPreview {
  const known = new Set(existing.map((e) => `${norm(e.kind)}|${norm(e.name)}`));
  const knownNames = new Set(existing.map((e) => norm(e.name)));
  const kinds = new Map<string, number>();
  const attributeKeys = new Set<string>();
  const warnings: string[] = [];
  let newEntities = 0, existingEntities = 0, unnamed = 0;
  const importedNames = new Set<string>();
  for (const e of payload.entities) {
    const name = (e.name ?? "").trim();
    if (!name) { unnamed++; continue; }
    importedNames.add(norm(name));
    const kind = (e.kind ?? "").trim();
    kinds.set(kind || "(untyped)", (kinds.get(kind || "(untyped)") ?? 0) + 1);
    for (const k of Object.keys(e.attributes ?? {})) attributeKeys.add(k);
    if (known.has(`${norm(kind)}|${norm(name)}`)) existingEntities++; else newEntities++;
  }
  if (unnamed) warnings.push(`${unnamed} row${unnamed === 1 ? "" : "s"} without a name will be skipped`);
  let dangling = 0;
  for (const r of payload.relations) {
    const ends = [r.from, r.to].map((v) => norm((v ?? "").includes(":") ? (v ?? "").split(":").slice(1).join(":") : v ?? ""));
    if (ends.some((v) => !v || (!importedNames.has(v) && !knownNames.has(v)))) dangling++;
  }
  if (dangling) warnings.push(`${dangling} relation${dangling === 1 ? "" : "s"} point${dangling === 1 ? "s" : ""} at names that are neither in the file nor in the graph`);
  if (payload.entities.length - unnamed === 0 && payload.relations.length === 0) warnings.unshift("Nothing recognised — the first line must be a header starting with kind,name");
  return { entities: payload.entities.length - unnamed, newEntities, existingEntities, kinds: [...kinds.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count), attributeKeys: [...attributeKeys], relations: payload.relations.length, warnings };
}
