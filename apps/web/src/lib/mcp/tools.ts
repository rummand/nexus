import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "@/lib/graph";
import { buildAdjacency, withinHops } from "@/lib/graph-algo";
import { healthLabel, healthReport } from "@/lib/health";
import { runQuery } from "@/lib/query";
import { metaModel } from "@/lib/metamodel";
import { getDefinition } from "@/lib/agent/definitions";
import { scopedGraph } from "@/lib/agent/run";
import { saveRun } from "@/lib/agent/store";
import { validateProposals } from "@/lib/agent/validate";
import { VERBS, type Verb } from "@/lib/agent/definition";
import { ensureTokenAgent } from "./agent";
import type { Scope } from "./tokens";

/**
 * What Nexus offers the rest of the world.
 *
 * The estate model is the thing other people's agents most want to read — "what depends on Maximo",
 * "what is out of support next year", "what does this workspace call an interface" — and answering
 * that is cheap for us and expensive for them. So Nexus is an MCP server (§5.33).
 *
 * The shape of it is the boundary this product has kept everywhere else, pointed outwards:
 *
 * - **Reading is generous.** Six tools, real answers, the workspace's own vocabulary.
 * - **Writing does not exist.** There is no tool that changes the model. The most an outside agent
 *   can do is `propose_change`, which goes through exactly the validator our own agent goes
 *   through and lands in the same review queue, under the name of the key that sent it.
 * - **Every answer is text a person could have read.** Ids are included because a follow-up call
 *   needs them, but the prose is written for a reader, because the thing on the other end is
 *   usually summarising it to one.
 */

export interface ToolContext {
  db: Db;
  workspaceId: string;
  workspaceName: string;
  scope: Scope;
  /** The key's name and id, for attributing what it proposes. */
  tokenName: string;
  tokenId: string;
  /** The described agent outside proposals are attributed to. */
  agentId: string | null;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Reading tools are always available; a proposing tool needs the key to say so. */
  needs?: Scope;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const attrLine = (attributes: Record<string, string>) =>
  Object.entries(attributes)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");

/** Find one object by id or by name, and say honestly when a name is ambiguous. */
async function findEntity(db: Db, workspaceId: string, needle: string) {
  const rows = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const byId = rows.find((e) => e.id === needle);
  if (byId) return { entity: byId, rows, ambiguous: [] as typeof rows };
  const norm = needle.trim().toLowerCase();
  const exact = rows.filter((e) => e.name.trim().toLowerCase() === norm);
  if (exact.length === 1) return { entity: exact[0]!, rows, ambiguous: [] as typeof rows };
  if (exact.length > 1) return { entity: null, rows, ambiguous: exact };
  const partial = rows.filter((e) => e.name.toLowerCase().includes(norm));
  if (partial.length === 1) return { entity: partial[0]!, rows, ambiguous: [] as typeof rows };
  return { entity: null, rows, ambiguous: partial.slice(0, 8) };
}

export const TOOLS: Tool[] = [
  {
    name: "search_model",
    description:
      "Search this organisation's architecture model. Supports the workspace's own query language: " +
      "kind:Application, owner:\"Grid Operations\", missing:lifecycle, related:Maximo, on:\"OT landscape\", " +
      "or plain words over names, descriptions and attribute values. Returns objects with their kind, " +
      "description, attributes and why each matched.",
    inputSchema: object(
      {
        query: { type: "string", description: 'What to look for, e.g. kind:Application missing:owner' },
        limit: { type: "number", description: "How many objects to return (default 25, max 100)" },
      },
      ["query"],
    ),
    run: async (args, ctx) => {
      const query = str(args.query, 300);
      const limit = Math.min(100, Math.max(1, num(args.limit, 25)));
      const found = await runQuery(ctx.db, ctx.workspaceId, query, limit);
      if (!found.entities.length) return `Nothing in ${ctx.workspaceName} matches ${query}. ${found.explanation}.`;
      const lines = found.entities.map((e) => {
        const attrs = attrLine(e.attributes);
        return `- ${e.name} [${e.kind || "no kind"}] (${e.id})${e.description ? ` — ${e.description}` : ""}${attrs ? ` {${attrs}}` : ""}`;
      });
      return [
        `${found.total} object${found.total === 1 ? "" : "s"} in ${ctx.workspaceName} match. ${found.explanation}.`,
        ...lines,
        found.total > found.entities.length ? `…and ${found.total - found.entities.length} more; narrow the query or raise the limit.` : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  },

  {
    name: "describe_object",
    description:
      "Everything this organisation records about one object: its kind, description, attributes, every " +
      "relation with direction, which boards it appears on and where the record came from. Takes an id or a name.",
    inputSchema: object({ object: { type: "string", description: "The object's name or id" } }, ["object"]),
    run: async (args, ctx) => {
      const needle = str(args.object, 200);
      const { entity, rows, ambiguous } = await findEntity(ctx.db, ctx.workspaceId, needle);
      if (!entity) {
        if (ambiguous.length) {
          return `“${needle}” matches ${ambiguous.length} objects here. Ask again with one of these ids:\n${ambiguous.map((e) => `- ${e.name} [${e.kind || "no kind"}] (${e.id})`).join("\n")}`;
        }
        return `Nothing here is called “${needle}”. Try search_model first — the workspace may call it something else.`;
      }
      const [relations, placements] = await Promise.all([
        ctx.db.select().from(s.relations_).where(eq(s.relations_.workspaceId, ctx.workspaceId)),
        ctx.db
          .select({ boardId: s.boardEntities.boardId, name: s.boards.name })
          .from(s.boardEntities)
          .innerJoin(s.boards, eq(s.boards.id, s.boardEntities.boardId))
          .where(eq(s.boardEntities.entityId, entity.id)),
      ]);
      const name = new Map(rows.map((e) => [e.id, `${e.name} [${e.kind || "no kind"}]`]));
      const out = relations.filter((r) => r.fromEntityId === entity.id).map((r) => `- ${entity.name} —${r.kind || "?"}→ ${name.get(r.toEntityId) ?? "?"}`);
      const into = relations.filter((r) => r.toEntityId === entity.id).map((r) => `- ${name.get(r.fromEntityId) ?? "?"} —${r.kind || "?"}→ ${entity.name}`);
      const attrs = attrLine(parseAttributes(entity.attributes));
      return [
        `${entity.name} [${entity.kind || "no kind"}] (${entity.id})`,
        entity.description ? entity.description : "No description recorded.",
        attrs ? `Attributes — ${attrs}` : "No attributes recorded.",
        `Where it came from: ${entity.source || "unknown"}.`,
        out.length || into.length ? `Relations (${out.length + into.length}):` : "Nothing is connected to it, which is usually a gap rather than a fact.",
        ...out,
        ...into,
        placements.length ? `On boards: ${[...new Set(placements.map((p) => p.name))].join(", ")}.` : "It is not drawn on any board.",
      ].join("\n");
    },
  },

  {
    name: "what_depends_on",
    description:
      "Follow the model outwards from one object: everything within N relations of it, in either direction, " +
      "with how far away each thing is. The question an impact assessment actually asks.",
    inputSchema: object(
      {
        object: { type: "string", description: "The object's name or id" },
        hops: { type: "number", description: "How far to follow (default 2, max 4)" },
      },
      ["object"],
    ),
    run: async (args, ctx) => {
      const needle = str(args.object, 200);
      const hops = Math.min(4, Math.max(1, num(args.hops, 2)));
      const { entity, rows, ambiguous } = await findEntity(ctx.db, ctx.workspaceId, needle);
      if (!entity) {
        return ambiguous.length
          ? `“${needle}” matches ${ambiguous.length} objects. Ask again with an id:\n${ambiguous.map((e) => `- ${e.name} (${e.id})`).join("\n")}`
          : `Nothing here is called “${needle}”.`;
      }
      const relations = await ctx.db.select().from(s.relations_).where(eq(s.relations_.workspaceId, ctx.workspaceId));
      const adjacency = buildAdjacency(relations.map((r) => ({ id: r.id, from: r.fromEntityId, to: r.toEntityId })));
      const reached = withinHops(adjacency, [entity.id], hops);
      const named = new Map(rows.map((e) => [e.id, e]));
      const others = [...reached.entries()].filter(([id]) => id !== entity.id).sort((a, b) => a[1] - b[1]);
      if (!others.length) return `Nothing is connected to ${entity.name} in this model. That is a gap in the model as often as it is a fact about the estate.`;
      return [
        `${others.length} object${others.length === 1 ? "" : "s"} within ${hops} relation${hops === 1 ? "" : "s"} of ${entity.name}:`,
        ...others.map(([id, distance]) => {
          const e = named.get(id);
          return `- ${distance} hop${distance === 1 ? "" : "s"}: ${e?.name ?? id} [${e?.kind || "no kind"}] (${id})`;
        }),
        `Read this as what the model knows, not as everything that is true.`,
      ].join("\n");
    },
  },

  {
    name: "list_kinds",
    description:
      "The vocabulary this organisation uses: every kind of object with how many there are and which " +
      "attributes they carry, and every relation type. Read this before proposing anything, so a suggestion " +
      "uses the words this workspace uses.",
    inputSchema: object({}),
    run: async (_args, ctx) => {
      const meta = await metaModel(ctx.db, ctx.workspaceId);
      const kinds = meta.nodeTypes.map((n) => {
        const fields = n.fields.map((f) => f.key).slice(0, 8).join(", ");
        return `- ${n.name} — ${n.instances} object${n.instances === 1 ? "" : "s"}${fields ? `; attributes: ${fields}` : ""}`;
      });
      const relations = meta.relationTypes.map((r) => `- ${r.name} — used ${r.instances} time${r.instances === 1 ? "" : "s"}`);
      return [
        `${ctx.workspaceName} uses ${meta.nodeTypes.length} kinds and ${meta.relationTypes.length} relation types.`,
        "Kinds:",
        ...(kinds.length ? kinds : ["- none yet"]),
        "Relation types:",
        ...(relations.length ? relations : ["- none yet"]),
      ].join("\n");
    },
  },

  {
    name: "estate_health",
    description:
      "How trustworthy this model is right now: an overall score and each measure behind it — what is typed, " +
      "owned, explained, connected and current — with how many objects are in the way of each.",
    inputSchema: object({}),
    run: async (_args, ctx) => {
      const [entities, relations] = await Promise.all([
        ctx.db.select().from(s.entities).where(eq(s.entities.workspaceId, ctx.workspaceId)),
        ctx.db.select().from(s.relations_).where(eq(s.relations_.workspaceId, ctx.workspaceId)),
      ]);
      const report = healthReport(entities, relations);
      return [
        `${ctx.workspaceName}: ${report.score}/100 — ${healthLabel(report.score)}. ${report.entities} objects, ${report.relations} relations.`,
        ...report.measures.map((m) => `- ${m.name}: ${m.score}/100 — ${m.detail}`),
        `A score is a statement about the model, not about the estate.`,
      ].join("\n");
    },
  },

  {
    name: "propose_change",
    description:
      "Suggest a correction to the model. It changes nothing: it is checked against the graph and, if it " +
      "survives, waits in this workspace's review queue for a person to accept or dismiss. Every proposal " +
      "must quote the words in the object that justify it — a claim you cannot quote is discarded. " +
      "The five changes are setKind, renameKind, merge, setAttribute and addRelation.",
    needs: "propose",
    inputSchema: object(
      {
        change: { type: "string", enum: [...VERBS], description: "Which of the five changes" },
        why: { type: "string", description: "One sentence, plain English, for the architect who will decide" },
        readFrom: { type: "string", description: "The id of the object you read to justify this" },
        quote: { type: "string", description: "The words you read on that object, copied exactly" },
        entityId: { type: "string", description: "setKind / setAttribute: the object to change" },
        to: { type: "string", description: "setKind: the kind. renameKind: the new spelling. setAttribute: the value." },
        from: { type: "string", description: "renameKind: the spelling to replace" },
        key: { type: "string", description: "setAttribute: which attribute" },
        survivorId: { type: "string", description: "merge: the object to keep" },
        otherIds: { type: "array", items: { type: "string" }, description: "merge: the objects to fold into it" },
        fromEntityId: { type: "string", description: "addRelation: the source object" },
        toEntityId: { type: "string", description: "addRelation: the target object" },
        relationKind: { type: "string", description: "addRelation: the relation type" },
      },
      ["change", "why", "readFrom", "quote"],
    ),
    run: async (args, ctx) => {
      const agent = (ctx.agentId ? await getDefinition(ctx.db, ctx.agentId) : null)
        ?? (await ensureTokenAgent(ctx.db, ctx.workspaceId, ctx.tokenId, ctx.tokenName));
      if (!agent) return "This key has no agent to attribute suggestions to, so nothing was recorded. Ask the workspace's owner to re-issue it.";

      const graph = await scopedGraph(ctx.db, ctx.workspaceId, agent.scope);
      const decisions = await ctx.db.select().from(s.agentDecisions).where(eq(s.agentDecisions.workspaceId, ctx.workspaceId));
      const decided = new Set(decisions.map((d) => d.key));
      const verbs: Verb[] = agent.verbs.length ? agent.verbs : [...VERBS];

      const review = validateProposals({ proposals: [args] }, graph, decided, verbs);
      if (!review.proposals.length) {
        return [
          "Nothing was recorded. Every claim has to quote the object it names, and this one did not survive checking:",
          ...review.rejected.map((r) => `- ${r}`),
          "Read the object with describe_object and quote its own words.",
        ].join("\n");
      }

      // Outside proposals accumulate rather than replacing each other: they arrive one at a time
      // from something that is not having a conversation with the reviewer.
      const existing = await ctx.db.select().from(s.agentProposals).where(eq(s.agentProposals.workspaceId, ctx.workspaceId));
      const mine = existing.filter((p) => p.agentId === agent.id).length;
      if (mine >= agent.budget.maxProposals) {
        return `This key already has ${mine} suggestion${mine === 1 ? "" : "s"} waiting in the review queue, which is its budget. Nothing was recorded until somebody works through them.`;
      }

      const proposal = review.proposals[0]!;
      await saveRun(
        ctx.db,
        ctx.workspaceId,
        { proposals: [proposal], rejected: review.rejected, note: `via MCP: ${ctx.tokenName}`, grounded: [], sampled: false },
        { agentId: agent.id, keep: true },
      );
      return [
        `Recorded: “${proposal.title}”.`,
        proposal.detail,
        `It is waiting in ${ctx.workspaceName}'s review queue under “${agent.name}”. It changes nothing until a person accepts it.`,
      ].join("\n");
    },
  },
];

export const toolByName = (name: string): Tool | undefined => TOOLS.find((t) => t.name === name);

/** What this key may call. */
export const toolsFor = (scope: Scope): Tool[] => TOOLS.filter((t) => !t.needs || t.needs === scope);
