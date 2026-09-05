"use server";

import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { commitExtraction, INTAKE_RECORD_KINDS, type CommitSelection } from "./commit";
import { providerById } from "../catalog/providers";
import { runPipeline } from "./pipeline";
import { extractWithModel, modelConfigured } from "./model";
import { parsePassages } from "./transcript";
import { detectSourceKind } from "./transcript";
import type { Extraction } from "./types";
import type { Vocabulary } from "./extract";

/**
 * Intake actions: add a source, run the pipeline over it, commit what a human accepted.
 *
 * A run never touches the graph. Extraction and commitment are separate on purpose — the whole
 * argument for reading a meeting automatically only holds if a person can see what it concluded
 * before the graph believes it.
 */

const now = () => new Date().toISOString();
const MAX_SOURCE_CHARS = 400_000;

async function touched(workspaceId: string) {
  const db = await getDb();
  const [ws] = await db.select({ slug: s.workspaces.slug }).from(s.workspaces).where(eq(s.workspaces.id, workspaceId));
  if (ws) revalidatePath(`/w/${ws.slug}`, "layout");
}

/** What the workspace already knows, so an extraction links instead of duplicating. */
async function vocabulary(workspaceId: string): Promise<Vocabulary> {
  const db = await getDb();
  const [entities, relations, declaredNodes, declaredRels] = await Promise.all([
    db.select({ id: s.entities.id, name: s.entities.name, kind: s.entities.kind }).from(s.entities).where(eq(s.entities.workspaceId, workspaceId)),
    db.select({ kind: s.relations_.kind }).from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId)),
    db.select({ name: s.nodeTypes.name }).from(s.nodeTypes).where(eq(s.nodeTypes.workspaceId, workspaceId)),
    db.select({ name: s.relationTypes.name }).from(s.relationTypes).where(eq(s.relationTypes.workspaceId, workspaceId)),
  ]);
  const kinds = new Set<string>([...declaredNodes.map((n) => n.name), ...entities.map((e) => e.kind)].filter(Boolean));
  const relationKinds = new Set<string>([...declaredRels.map((r) => r.name), ...relations.map((r) => r.kind)].filter(Boolean));
  const records = new Set(INTAKE_RECORD_KINDS.map((k) => k.toLowerCase()));
  return {
    // What intake wrote is evidence, not vocabulary — see INTAKE_RECORD_KINDS.
    entities: entities.filter((e) => !records.has(e.kind.trim().toLowerCase())),
    kinds: [...kinds],
    relationKinds: [...relationKinds],
  };
}

export async function createSource(input: { workspaceId: string; name: string; text: string; connector: string }) {
  const text = input.text.slice(0, MAX_SOURCE_CHARS);
  if (!text.trim()) return { error: "There is nothing to read in that source" };
  const connector = providerById(input.connector);
  if (!connector) return { error: `Unknown connector “${input.connector}”` };
  if (connector.status !== "available") return { error: `${connector.name} is on the roadmap, not connected yet` };

  const db = await getDb();
  const id = `src_${nanoid(10)}`;
  const ts = now();
  await db.insert(s.sources).values({
    id,
    workspaceId: input.workspaceId,
    name: input.name.trim() || "Untitled source",
    kind: detectSourceKind(text),
    connector: connector.id,
    text,
    characters: text.length,
    status: "new",
    createdAt: ts,
    updatedAt: ts,
  });
  await touched(input.workspaceId);
  return { id };
}

/** Run the pipeline and store the result. Never writes to the graph. */
export async function runSource(sourceId: string) {
  const db = await getDb();
  const [source] = await db.select().from(s.sources).where(eq(s.sources.id, sourceId));
  if (!source) return { error: "That source is gone" };

  const started = Date.now();
  const vocab = await vocabulary(source.workspaceId);

  // A model reads the source when one is configured; the rules read it when not. Either way the
  // result is validated against the passages and reviewed by a human before it reaches the graph.
  let read: Awaited<ReturnType<typeof extractWithModel>> | undefined;
  if (modelConfigured()) {
    try {
      read = await extractWithModel(source.name, parsePassages(source.text), vocab);
    } catch {
      read = undefined; // a planner that is down is not a reason to read nothing
    }
  }

  const extraction = runPipeline({ name: source.name, text: source.text, vocabulary: vocab, read });
  const ms = Date.now() - started;

  await db.insert(s.sourceRuns).values({
    id: `run_${nanoid(10)}`,
    sourceId,
    extraction: JSON.stringify(extraction),
    candidateCount: extraction.candidates.length,
    relationCount: extraction.relations.length,
    viewpointCount: extraction.viewpoints.length,
    ms,
    createdAt: now(),
  });
  await db.update(s.sources)
    .set({ kind: extraction.sourceKind, status: source.status === "committed" ? "committed" : "extracted", updatedAt: now() })
    .where(eq(s.sources.id, sourceId));
  await touched(source.workspaceId);
  return { ok: true, ms };
}

/** Write the accepted part of the latest run into the graph. */
export async function commitSource(sourceId: string, selection: CommitSelection) {
  const db = await getDb();
  const [source] = await db.select().from(s.sources).where(eq(s.sources.id, sourceId));
  if (!source) return { error: "That source is gone" };
  const [run] = await db.select().from(s.sourceRuns).where(eq(s.sourceRuns.sourceId, sourceId)).orderBy(desc(s.sourceRuns.createdAt)).limit(1);
  if (!run) return { error: "Run the pipeline first" };

  const extraction = JSON.parse(run.extraction) as Extraction;
  const result = await commitExtraction(db, source.workspaceId, source, extraction, selection);
  await db.update(s.sourceRuns)
    .set({ committedCount: result.entitiesCreated + result.relationsCreated + result.viewpointsCreated })
    .where(eq(s.sourceRuns.id, run.id));
  await touched(source.workspaceId);
  return result;
}

export async function deleteSource(sourceId: string) {
  const db = await getDb();
  const [source] = await db.select().from(s.sources).where(eq(s.sources.id, sourceId));
  if (!source) return { ok: true };
  await db.delete(s.sources).where(eq(s.sources.id, sourceId));
  await touched(source.workspaceId);
  return { ok: true };
}

export async function renameSource(sourceId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "A name is required" };
  const db = await getDb();
  const [source] = await db.select().from(s.sources).where(eq(s.sources.id, sourceId));
  if (!source) return { error: "That source is gone" };
  await db.update(s.sources).set({ name: trimmed, updatedAt: now() }).where(eq(s.sources.id, sourceId));
  await touched(source.workspaceId);
  return { ok: true };
}
