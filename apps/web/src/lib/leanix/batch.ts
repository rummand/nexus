import type { BatchFile } from "@/lib/import/batch";
import type { Column } from "@/lib/import/map";
import { entityName, nameIndex, readableRelation, readableType } from "./map";
import type { FactSheet, LeanIxExport } from "./types";

/**
 * A LeanIX workspace as staged import files (§5.63).
 *
 * The point of this rev is that LeanIX goes through the *same* pipeline as a spreadsheet: staged,
 * mapped, matched against what is already in the graph, reviewed row by row, approved, and
 * rollback-able (§5.21, §5.36). Nothing new was needed for any of that — only a translation into
 * the batch's own shape.
 *
 * One file per fact sheet type rather than one big one, because the pipeline reasons per file:
 * a file has a kind, and a workspace's Applications and its IT Components are not the same kind.
 * That also makes the review page readable — "342 Applications, 88 IT Components" — instead of one
 * undifferentiated pile.
 *
 * These files are `declared`: LeanIX names every field and every relation type, so the column
 * mapper is told rather than asked. Letting it guess would turn known facts back into inferences,
 * and would quietly drop every relation — their headers are LeanIX's own names, not the English
 * the mapper's regexes look for.
 */

/** Columns every fact sheet has, in the order a person reads them. */
const NAME = "name";
const DESCRIPTION = "description";
const KEY = "leanix id";

const cell = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

export function toBatchFiles(dump: LeanIxExport): BatchFile[] {
  const byId = new Map(dump.factSheets.map((fs) => [fs.id, fs]));
  const names = nameIndex(dump.factSheets);
  const nameOf = (id: string) => names.get(id) ?? entityName(byId.get(id) ?? ({ id } as FactSheet));

  /* Outgoing relations per fact sheet, grouped by relation type: one column each, targets joined. */
  const outgoing = new Map<string, Map<string, string[]>>();
  for (const r of dump.relations) {
    if (!byId.has(r.fromId) || !byId.has(r.toId)) continue; // the other end was not exported
    const perType = outgoing.get(r.fromId) ?? new Map<string, string[]>();
    perType.set(r.type, [...(perType.get(r.type) ?? []), nameOf(r.toId)]);
    outgoing.set(r.fromId, perType);
  }

  const byType = new Map<string, FactSheet[]>();
  for (const fs of dump.factSheets) {
    const t = fs.type || "Untyped";
    byType.set(t, [...(byType.get(t) ?? []), fs]);
  }

  const files: BatchFile[] = [];
  for (const [type, sheets] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    // Only the fields this type actually uses, so a hundred empty columns do not arrive with it.
    const fieldKeys: string[] = [];
    const roleKeys: string[] = [];
    const relationKeys: string[] = [];
    for (const fs of sheets) {
      for (const k of Object.keys(fs.fields)) if (cell(fs.fields[k]) && !fieldKeys.includes(k)) fieldKeys.push(k);
      for (const sub of fs.subscriptions) {
        const role = (sub.role || "subscriber").toLowerCase();
        if (!roleKeys.includes(role)) roleKeys.push(role);
      }
      for (const rel of outgoing.get(fs.id)?.keys() ?? []) if (!relationKeys.includes(rel)) relationKeys.push(rel);
    }
    fieldKeys.sort();
    roleKeys.sort();
    relationKeys.sort();

    const headers = [NAME, DESCRIPTION, KEY, ...fieldKeys, ...roleKeys, ...relationKeys.map(readableRelation)];
    const columns: Column[] = [
      { header: NAME, role: { as: "name" }, why: "The fact sheet's display name in LeanIX.", sample: [] },
      { header: DESCRIPTION, role: { as: "description" }, why: "The fact sheet's description.", sample: [] },
      /*
       * The key, not an attribute: it is what makes the *next* export an update rather than a
       * second copy of the estate.
       */
      { header: KEY, role: { as: "key" }, why: "LeanIX's own id, so re-importing updates rather than duplicates.", sample: [] },
      ...fieldKeys.map((k): Column => ({ header: k, role: { as: "attribute", key: k }, why: `A field this workspace configured on ${readableType(type)}.`, sample: [] })),
      ...roleKeys.map((k): Column => ({ header: k, role: { as: "person", key: k }, why: `A LeanIX subscription role — who is ${k} of this.`, sample: [] })),
      ...relationKeys.map((rel): Column => ({
        header: readableRelation(rel),
        role: { as: "relation", kind: readableRelation(rel) },
        why: `A modelled relationship in LeanIX (${rel}).`,
        sample: [],
      })),
    ];

    const rows = sheets.map((fs) => {
      const rels = outgoing.get(fs.id);
      const subs = new Map<string, string[]>();
      for (const sub of fs.subscriptions) {
        const role = (sub.role || "subscriber").toLowerCase();
        subs.set(role, [...(subs.get(role) ?? []), sub.email]);
      }
      return [
        names.get(fs.id) ?? entityName(fs),
        cell(fs.description),
        fs.id,
        ...fieldKeys.map((k) => cell(fs.fields[k])),
        ...roleKeys.map((k) => (subs.get(k) ?? []).join(", ")),
        ...relationKeys.map((rel) => (rels?.get(rel) ?? []).join(", ")),
      ];
    });

    // A few real values on each column, so the review page can be judged without opening LeanIX.
    for (const [i, column] of columns.entries()) {
      column.sample = rows.map((r) => r[i] ?? "").filter(Boolean).slice(0, 3);
    }

    files.push({
      name: `LeanIX · ${readableType(type)}`,
      format: "leanix",
      headers,
      rows,
      columns,
      kind: readableType(type),
      kindWhy: `LeanIX says these are ${readableType(type)} fact sheets.`,
      kindFromRows: false,
      declared: true,
    });
  }
  return files;
}
