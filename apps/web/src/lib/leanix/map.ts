import type { ImportPayload } from "@/lib/graph-types";
import type { FactSheet, LeanIxExport } from "./types";

/**
 * Turning a LeanIX workspace into something Nexus can read (§5.62).
 *
 * Pure, and separate from the fetching, because this is the half with judgement in it and the
 * half that can be tested without a network or a licence.
 *
 * Two rules shape all of it:
 *
 * **Keep their vocabulary.** A LeanIX "ITComponent" becomes an "IT Component", not a "Technology":
 * the names an organisation has been using for years are the ones its people will search for, and
 * a migration that renames everything on the way in is a migration nobody can check. Only the
 * spelling is normalised — LeanIX writes its types in CamelCase, and a screen full of
 * "BusinessCapability" reads as a system talking to itself.
 *
 * **Lose nothing quietly.** Every field the workspace configured comes across as an attribute,
 * even the ones Nexus has no opinion about, and the LeanIX id is kept so a second import updates
 * rather than duplicates. Where a relation points at a fact sheet that was not exported — a
 * permission boundary, usually — it is dropped and *counted*, because a relation count that
 * silently shrinks is how somebody concludes the export worked.
 */

/** "ITComponent" → "IT Component", "BusinessCapability" → "Business Capability". */
export function readableType(leanixType: string): string {
  const t = (leanixType ?? "").trim();
  if (!t) return "Untyped";
  return t
    // Split CamelCase, keeping runs of capitals together: "ITComponent" → "IT Component".
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}

/**
 * "relApplicationToITComponent" → "uses IT Component"? No — → "application to IT component".
 *
 * LeanIX names a relation after its two ends, which is a schema name rather than a sentence. The
 * readable form keeps both ends, because that is the only information the name carries, and a
 * guessed verb ("uses", "depends on") would be an invention presented as data.
 */
export function readableRelation(leanixRelation: string): string {
  const raw = (leanixRelation ?? "").trim();
  if (!raw) return "relates to";
  const body = raw.replace(/^rel/, "");
  const words = readableType(body).toLowerCase();
  return words.replace(/\bto\b/, "→").replace(/\s+/g, " ").trim() || "relates to";
}

export interface MappedImport extends ImportPayload {
  /** Relations whose other end was not in the export, and why that matters. */
  dropped: Array<{ from: string; to: string; type: string }>;
  /** Fact sheets by readable kind, for the report. */
  byKind: Array<{ kind: string; count: number }>;
}

const clean = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};

/**
 * A name Nexus can key on. LeanIX allows duplicates; the id keeps them apart.
 *
 * The short name, not the display name. For a type with a hierarchy LeanIX's `displayName` is the
 * whole path — "Electricity System Operation / Operation / Grid Monitoring & Control" — which was
 * the only way to say where something sat while the import landed everything flat. Now that the
 * hierarchy comes across as containment (§5.74), the path is in the tree, and repeating it in
 * every name makes a capability map unreadable and a search unusable. Where there is no path the
 * two are the same string, so this costs the other types nothing.
 */
export function entityName(fs: FactSheet): string {
  return (fs.name || fs.displayName || "").trim() || `(unnamed ${readableType(fs.type)})`;
}

/** The shortest id prefix that still tells every fact sheet apart — 8 unless the ids collide. */
function shortestUnique(ids: string[], from = 8): number {
  const longest = ids.reduce((n, id) => Math.max(n, id.length), 0);
  for (let width = from; width < longest; width++) {
    if (new Set(ids.map((id) => id.slice(0, width))).size === ids.length) return width;
  }
  return longest;
}

/**
 * The name each fact sheet will be known by, and a lookup from id to it.
 *
 * Two fact sheets can share a name — LeanIX does not stop it, and a large workspace is full of
 * "Reporting". Nexus keys an import on the name, so a duplicate would silently merge two different
 * systems into one. Where a name repeats, the LeanIX id is appended to every copy of it: uglier,
 * and the only version that is true.
 *
 * Exported because the batch builder needs exactly the same answer — a relation column naming
 * "Reporting" when there are two of them would point at whichever one the matcher guessed.
 */
export function nameIndex(factSheets: FactSheet[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const fs of factSheets) {
    const n = entityName(fs).toLowerCase();
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  /*
   * A short id reads better beside a name, but only while it is still an id: two fact sheets
   * whose ids share a prefix would otherwise get the *same* disambiguated name, which is worse
   * than not disambiguating at all. So the prefix is grown until it separates them.
   */
  const width = shortestUnique(factSheets.map((fs) => fs.id));
  const out = new Map<string, string>();
  for (const fs of factSheets) {
    const base = entityName(fs);
    out.set(fs.id, (counts.get(base.toLowerCase()) ?? 0) > 1 ? `${base} (${fs.id.slice(0, width)})` : base);
  }
  return out;
}

export function mapExport(dump: LeanIxExport): MappedImport {
  const byId = new Map<string, FactSheet>();
  for (const fs of dump.factSheets) if (fs.id) byId.set(fs.id, fs);

  const names = nameIndex([...byId.values()]);
  const nameOf = (fs: FactSheet): string => names.get(fs.id) ?? entityName(fs);

  const entities: ImportPayload["entities"] = [];
  const counts = new Map<string, number>();
  for (const fs of byId.values()) {
    const kind = readableType(fs.type);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    const attributes: Record<string, string> = {};
    for (const [k, v] of Object.entries(fs.fields)) {
      const value = clean(v);
      if (value) attributes[k] = value;
    }
    // Provenance, so a second import updates rather than duplicates, and so anybody can go and
    // look at the original.
    attributes["leanix id"] = fs.id;
    if (fs.tags.length) attributes["tags"] = fs.tags.join(", ");
    for (const sub of fs.subscriptions) {
      // The subscription roles are how LeanIX records ownership, and ownership is the field every
      // estate-health measure asks for first (§5.18).
      const key = sub.role ? sub.role.toLowerCase() : "subscriber";
      attributes[key] = attributes[key] ? `${attributes[key]}, ${sub.email}` : sub.email;
    }
    entities.push({ kind, name: nameOf(fs), description: clean(fs.description), attributes });
  }

  const relations: ImportPayload["relations"] = [];
  const dropped: MappedImport["dropped"] = [];
  for (const r of dump.relations) {
    const from = byId.get(r.fromId);
    const to = byId.get(r.toId);
    if (!from || !to) {
      dropped.push({ from: r.fromId, to: r.toId, type: r.type });
      continue;
    }
    relations.push({ from: nameOf(from), kind: readableRelation(r.type), to: nameOf(to) });
  }

  return {
    entities: entities.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
    relations,
    dropped,
    byKind: [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
  };
}

/** What the run found, in a form somebody can paste into a mail. */
export function summarise(dump: LeanIxExport, mapped: MappedImport): string {
  const lines = [
    `# LeanIX export — ${dump.workspace}`,
    "",
    `Host: ${dump.host}`,
    `Taken: ${dump.exportedAt}`,
    "",
    `**${dump.factSheets.length} fact sheets** across ${mapped.byKind.length} types, `
      + `**${mapped.relations.length} relations** mapped`
      + (mapped.dropped.length ? `, ${mapped.dropped.length} dropped (the other end was not in the export).` : "."),
    "",
    "| Kind | Objects |",
    "|---|---|",
    ...mapped.byKind.map((k) => `| ${k.kind} | ${k.count} |`),
  ];
  if (mapped.dropped.length) {
    lines.push(
      "",
      "## Relations that could not be mapped",
      "",
      "Their other end was not in the export — usually a permission boundary on the token, "
        + "sometimes a fact sheet type that was filtered out. They are listed in `dropped.json`.",
    );
  }
  return lines.join("\n");
}
