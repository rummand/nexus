import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { parseAttributes } from "../graph";
import { emptyDocument, type CanvasDocument } from "@/canvas/document";
import { parseScript, type ParsedLine, type Vocabulary } from "./script";
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
 * Compile and run a script.
 *
 * `from` decides whether the script *is* the board (rebuild from empty, the default — so the text
 * and the picture cannot drift apart) or adds to what is already there.
 */
export async function composeBoard(
  db: Db,
  workspaceId: string,
  script: string,
  current: CanvasDocument,
  mode: "rebuild" | "extend" = "rebuild",
): Promise<ComposeResult> {
  const { ctx, vocabulary } = await composeContext(db, workspaceId);
  const lines: ParsedLine[] = parseScript(script, vocabulary);

  let document = mode === "rebuild" ? emptyDocument() : current;
  const steps: ComposeStep[] = [];
  for (const line of lines) {
    const { document: next, result }: { document: CanvasDocument; result: StepResult } = applyInstruction(document, ctx, line.instruction);
    document = next;
    steps.push({ raw: line.raw.trim(), echo: line.echo, ok: result.ok, message: result.message });
  }
  // A rebuild keeps the viewpoints saved on the board: those are the reader's, not the script's.
  if (mode === "rebuild" && current.viewpoints?.length) document = { ...document, viewpoints: current.viewpoints };
  return { document, steps, vocabulary };
}
