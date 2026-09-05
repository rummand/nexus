import { matchEntities, type ComposeContext } from "./apply";

/**
 * What the planner may look at before it answers.
 *
 * Planning blind is the difference between a board builder and an analyst: without this the
 * planner can write "two of them have no owner" but cannot know it. These are read-only
 * questions over the same in-memory context the executor uses — counts, samples, distinct values,
 * neighbourhoods — bounded so a curious planner cannot pull the whole graph into a prompt.
 *
 * Pure, so what the planner is allowed to see is a unit test rather than a matter of trust.
 */

export type Inspection =
  | { op: "kinds" }
  | { op: "count"; query: string }
  | { op: "sample"; query: string; limit?: number }
  | { op: "values"; attribute: string; query?: string }
  | { op: "relations"; around?: string }
  | { op: "neighbours"; name: string };

export interface InspectionResult {
  /** What the planner reads back. */
  text: string;
  /** One line for the person, so they can see what it looked at. */
  label: string;
}

const MAX_ROWS = 40;
const norm = (v: string) => v.trim().toLowerCase();

const clip = <T>(rows: T[]): { rows: T[]; more: number } => ({ rows: rows.slice(0, MAX_ROWS), more: Math.max(0, rows.length - MAX_ROWS) });

export function runInspection(ctx: ComposeContext, inspection: Inspection): InspectionResult {
  switch (inspection.op) {
    case "kinds": {
      const counts = new Map<string, number>();
      for (const e of ctx.entities) counts.set(e.kind || "(untyped)", (counts.get(e.kind || "(untyped)") ?? 0) + 1);
      const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return {
        text: ordered.map(([k, n]) => `${k}: ${n}`).join("\n") || "the graph is empty",
        label: `looked at what kinds exist (${ordered.length})`,
      };
    }

    case "count": {
      const n = matchEntities(ctx, inspection.query).length;
      return { text: `${n} entities match ${inspection.query}`, label: `counted ${inspection.query} → ${n}` };
    }

    case "sample": {
      const matched = matchEntities(ctx, inspection.query);
      const { rows, more } = clip(matched.slice(0, Math.min(MAX_ROWS, inspection.limit ?? 12)));
      const body = rows
        .map((e) => `${e.name} (${e.kind || "untyped"})${Object.keys(e.attributes).length ? ` — ${Object.entries(e.attributes).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(", ")}` : ""}`)
        .join("\n");
      return {
        text: `${matched.length} match ${inspection.query}. Showing ${rows.length}:\n${body || "none"}${more ? `\n…and ${more} more` : ""}`,
        label: `sampled ${inspection.query} (${matched.length} match)`,
      };
    }

    case "values": {
      const pool = inspection.query ? matchEntities(ctx, inspection.query) : ctx.entities;
      const counts = new Map<string, number>();
      let missing = 0;
      for (const e of pool) {
        const found = Object.entries(e.attributes).find(([k]) => norm(k) === norm(inspection.attribute));
        if (!found || !found[1].trim()) { missing++; continue; }
        counts.set(found[1], (counts.get(found[1]) ?? 0) + 1);
      }
      const { rows, more } = clip([...counts.entries()].sort((a, b) => b[1] - a[1]));
      return {
        text: `“${inspection.attribute}” over ${pool.length} entities — ${rows.map(([v, n]) => `${v}: ${n}`).join(", ") || "no values"}${more ? `, …${more} more` : ""}. ${missing} have none.`,
        label: `read the values of ${inspection.attribute} (${counts.size} distinct, ${missing} missing)`,
      };
    }

    case "relations": {
      const anchor = inspection.around
        ? ctx.entities.filter((e) => norm(e.name).includes(norm(inspection.around!))).map((e) => e.id)
        : null;
      const ids = anchor ? new Set(anchor) : null;
      const counts = new Map<string, number>();
      for (const r of ctx.relations) {
        if (ids && !ids.has(r.from) && !ids.has(r.to)) continue;
        counts.set(r.kind || "(untyped)", (counts.get(r.kind || "(untyped)") ?? 0) + 1);
      }
      const { rows } = clip([...counts.entries()].sort((a, b) => b[1] - a[1]));
      return {
        text: rows.map(([k, n]) => `${k}: ${n}`).join("\n") || "no relations",
        label: inspection.around ? `looked at the relations around ${inspection.around}` : `looked at the relation types (${counts.size})`,
      };
    }

    case "neighbours": {
      const anchors = ctx.entities.filter((e) => norm(e.name) === norm(inspection.name) || norm(e.name).includes(norm(inspection.name)));
      if (anchors.length === 0) return { text: `nothing here is called “${inspection.name}”`, label: `looked for ${inspection.name} — not found` };
      const byId = new Map(ctx.entities.map((e) => [e.id, e]));
      const lines: string[] = [];
      for (const anchor of anchors.slice(0, 3)) {
        for (const r of ctx.relations) {
          if (r.from === anchor.id) lines.push(`${anchor.name} —${r.kind || "related"}→ ${byId.get(r.to)?.name ?? "?"}`);
          if (r.to === anchor.id) lines.push(`${byId.get(r.from)?.name ?? "?"} —${r.kind || "related"}→ ${anchor.name}`);
        }
      }
      const { rows, more } = clip(lines);
      return {
        text: `${anchors[0]!.name} (${anchors[0]!.kind}):\n${rows.join("\n") || "no relations"}${more ? `\n…and ${more} more` : ""}`,
        label: `looked at what ${anchors[0]!.name} connects to (${lines.length})`,
      };
    }
  }
}

/** The schema the planner uses to ask. Read-only by construction: there is no write verb here. */
export const INSPECT_SCHEMA = {
  type: "object" as const,
  properties: {
    op: {
      type: "string",
      enum: ["kinds", "count", "sample", "values", "relations", "neighbours"],
      description: "kinds: how many of each kind exist. count: how many match a query. sample: a few matching entities with their attributes. values: the distinct values of an attribute, and how many lack it. relations: relation types and counts, optionally around one entity. neighbours: what one named entity connects to.",
    },
    query: { type: "string", description: "For count, sample and values: a query in the Nexus grammar." },
    attribute: { type: "string", description: "For values: the attribute key." },
    around: { type: "string", description: "For relations: an entity name to look around." },
    name: { type: "string", description: "For neighbours: the entity name." },
    limit: { type: "integer", description: "For sample: how many to show, at most 40." },
  },
  required: ["op"],
};

/** Validate what the planner asked to look at. An unknown op is refused, not guessed at. */
export function validateInspection(raw: unknown): Inspection | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const op = String(s.op ?? "").trim().toLowerCase();
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
  switch (op) {
    case "kinds": return { op: "kinds" };
    case "count": return str(s.query) ? { op: "count", query: str(s.query) } : null;
    case "sample": return str(s.query) ? { op: "sample", query: str(s.query), limit: Number.isFinite(Number(s.limit)) ? Math.min(MAX_ROWS, Math.max(1, Math.round(Number(s.limit)))) : undefined } : null;
    case "values": return str(s.attribute) ? { op: "values", attribute: str(s.attribute), query: str(s.query) || undefined } : null;
    case "relations": return { op: "relations", around: str(s.around) || undefined };
    case "neighbours": return str(s.name) ? { op: "neighbours", name: str(s.name) } : null;
    default: return null;
  }
}
