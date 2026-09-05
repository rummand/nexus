import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "../graph";
import { emptyDocument, type CanvasDocument } from "@/canvas/document";
import { parseScript, type Instruction, type ParsedLine, type Vocabulary } from "./script";
import { modelConfigured, modelStatus, planWithModel } from "./llm";
import { applyInstruction, type ComposeContext, type StepResult } from "./apply";

/**
 * Running a board script against the workspace graph.
 *
 * Server-side, because compiling a line needs the workspace's real vocabulary — its kinds, its
 * relation types, the attribute keys people actually use — and executing it needs the graph. The
 * client sends text and gets back a document and a line-by-line account of what happened.
 */

export interface ComposeStep {
  raw: string;
  echo: string;
  ok: boolean;
  message: string;
}

export interface ComposeResult {
  document: CanvasDocument;
  steps: ComposeStep[];
  vocabulary: Vocabulary;
  /** Which front-end read the request: the model, or the rule compiler. */
  engine: "model" | "rules";
  /** The planner's answer in plain English; empty when the rules ran. */
  reply: string;
  /** Steps the planner proposed that were not allowed through, and why. */
  rejected: string[];
  /** What to tell the person if the model is not configured. */
  status: string;
  /** The script the plan amounts to, so it can be read, edited and re-run by hand. */
  script: string;
}

export async function composeContext(db: Db, workspaceId: string): Promise<{ ctx: ComposeContext; vocabulary: Vocabulary }> {
  const [entities, relations, placements, declaredKinds, declaredRelations] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
    db.select({ entityId: s.boardEntities.entityId, name: s.boards.name })
      .from(s.boardEntities)
      .innerJoin(s.boards, eq(s.boardEntities.boardId, s.boards.id))
      .where(eq(s.boards.workspaceId, workspaceId)),
    db.select({ name: s.nodeTypes.name }).from(s.nodeTypes).where(eq(s.nodeTypes.workspaceId, workspaceId)),
    db.select({ name: s.relationTypes.name }).from(s.relationTypes).where(eq(s.relationTypes.workspaceId, workspaceId)),
  ]);

  const boardsOf = new Map<string, string[]>();
  for (const p of placements) boardsOf.set(p.entityId, [...(boardsOf.get(p.entityId) ?? []), p.name]);

  const attributeKeys = new Set<string>();
  const ctx: ComposeContext = {
    entities: entities.map((e) => {
      const attributes = parseAttributes(e.attributes);
      for (const k of Object.keys(attributes)) attributeKeys.add(k);
      return {
        id: e.id,
        kind: e.kind,
        name: e.name,
        description: e.description,
        attributes,
        boards: boardsOf.get(e.id) ?? [],
      };
    }),
    relations: relations.map((r) => ({ id: r.id, from: r.fromEntityId, to: r.toEntityId, kind: r.kind })),
  };

  return {
    ctx,
    vocabulary: {
      kinds: [...new Set([...declaredKinds.map((k) => k.name), ...entities.map((e) => e.kind)].filter(Boolean))],
      relationKinds: [...new Set([...declaredRelations.map((r) => r.name), ...relations.map((r) => r.kind)].filter(Boolean))],
      attributeKeys: [...attributeKeys],
    },
  };
}

/**
 * Answer a request with a board.
 *
 * The request is planned either by the model (when one is configured) or by the rule compiler,
 * and either way ends as the same closed instruction set, executed by the same pure executor.
 * `mode` decides whether the answer *is* the board (rebuild, the default) or adds to it.
 */
export async function composeBoard(
  db: Db,
  workspaceId: string,
  input: string,
  current: CanvasDocument,
  mode: "rebuild" | "extend" = "rebuild",
  engine: "auto" | "model" | "rules" = "auto",
): Promise<ComposeResult> {
  const { ctx, vocabulary } = await composeContext(db, workspaceId);

  let planned: Array<{ instruction: Instruction; raw: string; echo: string }> = [];
  let used: "model" | "rules" = "rules";
  let reply = "";
  let rejected: string[] = [];

  const wantsModel = engine === "model" || (engine === "auto" && modelConfigured());
  if (wantsModel) {
    try {
      const plan = await planWithModel(input, {
        vocabulary,
        sampleNames: ctx.entities.slice(0, 60).map((e) => e.name),
        onBoard: Object.keys(current.elements).length,
      });
      used = "model";
      reply = plan.reply;
      rejected = plan.rejected;
      planned = plan.instructions.map((instruction) => ({ instruction, raw: describeInstruction(instruction), echo: describeInstruction(instruction) }));
    } catch (error) {
      // A planner that is down is not a reason to do nothing: fall back and say so.
      rejected = [error instanceof Error ? error.message : "the planner failed"];
    }
  }

  if (used === "rules") {
    const lines: ParsedLine[] = parseScript(input, vocabulary);
    planned = lines.map((l) => ({ instruction: l.instruction, raw: l.raw.trim(), echo: l.echo }));
  }

  let document = mode === "rebuild" ? emptyDocument() : current;
  const steps: ComposeStep[] = [];
  for (const line of planned) {
    const { document: next, result }: { document: CanvasDocument; result: StepResult } = applyInstruction(document, ctx, line.instruction);
    document = next;
    steps.push({ raw: line.raw, echo: line.echo, ok: result.ok, message: result.message });
  }
  // A rebuild keeps the viewpoints saved on the board: those are the reader's, not the script's.
  if (mode === "rebuild" && current.viewpoints?.length) document = { ...document, viewpoints: current.viewpoints };

  return {
    document,
    steps,
    vocabulary,
    engine: used,
    reply,
    rejected,
    status: modelStatus(),
    script: planned.map((p) => p.raw).join("\n"),
  };
}

/** An instruction written back as the line a person would have typed for it. */
export function describeInstruction(ins: Instruction): string {
  switch (ins.verb) {
    case "clear": return "clear";
    case "add": return `add ${ins.query}${ins.limit !== 60 ? ` max ${ins.limit}` : ""}`;
    case "remove": return `remove ${ins.query}`;
    case "expand": return `expand ${ins.hops} hop${ins.hops === 1 ? "" : "s"}${ins.relationKinds.length ? ` via ${ins.relationKinds.join(", ")}` : ""}${ins.direction !== "both" ? ` ${ins.direction === "in" ? "upstream" : "downstream"}` : ""}`;
    case "connect": return `connect${ins.relationKinds.length ? ` via ${ins.relationKinds.join(", ")}` : " them"}`;
    case "group": return `group by ${ins.by}`;
    case "colour": return `colour by ${ins.by}`;
    case "layout": return `lay out as ${ins.style}${ins.by ? ` by ${ins.by}` : ""}`;
    case "title": return `title ${ins.text}`;
    case "note": return `note ${ins.text}`;
    case "unknown": return ins.hint;
  }
}
