import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { ENTITY_ID_PREFIX, RELATION_ID_PREFIX } from "../graph-types";
import type { Extraction, Viewpoint } from "./types";

/**
 * Writing an accepted extraction into the graph.
 *
 * The rule that shapes everything here: **the source is a node too**. A meeting is not metadata
 * hanging off the applications it mentioned — it is an object in the graph, connected to the
 * people who attended, the things they discussed and the decisions they made. That is what makes
 * an extraction touchable afterwards: open the meeting on a canvas and pull on it, and the estate
 * it talked about comes with it.
 *
 * Provenance is therefore graph-native rather than a side table: every `mentions` edge carries
 * the quote that justified it, so "why does the graph think this?" is answered by clicking the
 * edge rather than by reading a log.
 */

export interface CommitSelection {
  candidates: string[];
  relations: string[];
  viewpoints: string[];
}

export interface CommitResult {
  entitiesCreated: number;
  entitiesLinked: number;
  relationsCreated: number;
  viewpointsCreated: number;
  sourceEntityId: string;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const now = () => new Date().toISOString();

const SOURCE_ENTITY_KIND: Record<string, string> = {
  transcript: "Meeting",
  document: "Document",
  table: "Dataset",
  connector: "Sync",
};

/**
 * The kinds intake itself writes: the source node and the viewpoints.
 *
 * These must never come back as *recognisable* vocabulary. A Risk is named by the sentence
 * somebody said, so on the next run over the same meeting the extractor would find that sentence
 * in the text and offer the risk as a thing being discussed — the graph reading its own notes
 * back to itself.
 */
export const INTAKE_RECORD_KINDS = ["Meeting", "Document", "Dataset", "Sync", "Decision", "Action", "Risk", "Question", "Need"];

const VIEWPOINT_KIND: Record<Viewpoint["type"], string> = {
  decision: "Decision",
  action: "Action",
  risk: "Risk",
  question: "Question",
  need: "Need",
};

export async function commitExtraction(
  db: Db,
  workspaceId: string,
  source: s.Source,
  extraction: Extraction,
  selection: CommitSelection,
): Promise<CommitResult> {
  const ts = now();
  const provenance = `intake:${source.id}`;
  const result: CommitResult = { entitiesCreated: 0, entitiesLinked: 0, relationsCreated: 0, viewpointsCreated: 0, sourceEntityId: "" };

  const existing = await db.select().from(s.entities).where(eq(s.entities.workspaceId, workspaceId));
  const byKey = new Map(existing.map((e) => [`${norm(e.kind)}|${norm(e.name)}`, e]));
  const byId = new Map(existing.map((e) => [e.id, e]));

  const existingRels = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspaceId));
  const relKeys = new Set(existingRels.map((r) => `${r.fromEntityId}|${norm(r.kind)}|${r.toEntityId}`));

  const insertEntity = async (kind: string, name: string, description: string, attributes: Record<string, string>) => {
    const key = `${norm(kind)}|${norm(name)}`;
    const found = byKey.get(key);
    if (found) return found;
    const row: s.Entity = {
      id: `${ENTITY_ID_PREFIX}${nanoid(12)}`,
      workspaceId,
      kind,
      name,
      description,
      attributes: JSON.stringify(attributes),
      source: provenance,
      createdAt: ts,
      updatedAt: ts,
    };
    await db.insert(s.entities).values(row);
    byKey.set(key, row);
    byId.set(row.id, row);
    result.entitiesCreated++;
    return row;
  };

  const link = async (fromId: string, kind: string, toId: string, attributes: Record<string, string> = {}) => {
    if (fromId === toId) return;
    const key = `${fromId}|${norm(kind)}|${toId}`;
    if (relKeys.has(key)) return;
    relKeys.add(key);
    await db.insert(s.relations_).values({
      id: `${RELATION_ID_PREFIX}${nanoid(12)}`,
      workspaceId,
      fromEntityId: fromId,
      toEntityId: toId,
      kind,
      attributes: JSON.stringify(attributes),
      source: provenance,
      createdAt: ts,
      updatedAt: ts,
    });
    result.relationsCreated++;
  };

  // ---- the source itself ------------------------------------------------------------------
  const sourceKind = SOURCE_ENTITY_KIND[extraction.sourceKind] ?? "Document";
  const sourceEntity = source.entityId ? byId.get(source.entityId) ?? null : null;
  const sourceNode = sourceEntity ?? await insertEntity(sourceKind, source.name, "", {
    connector: source.connector,
    captured: ts.slice(0, 10),
    ...(extraction.speakers.length ? { participants: extraction.speakers.join(", ") } : {}),
    passages: String(extraction.passages.length),
  });
  result.sourceEntityId = sourceNode.id;

  // ---- the things it talked about ----------------------------------------------------------
  const chosen = new Set(selection.candidates);
  const entityForCandidate = new Map<string, string>();
  for (const c of extraction.candidates) {
    if (!chosen.has(c.key)) continue;
    const linkedExisting = c.existingEntityId ? byId.get(c.existingEntityId) : undefined;
    const entity = linkedExisting ?? await insertEntity(c.kind, c.name, c.description, c.attributes);
    if (linkedExisting) result.entitiesLinked++;
    entityForCandidate.set(c.key, entity.id);

    const evidence = c.mentions[0];
    const attributes = evidence ? { quote: evidence.quote, ...(evidence.speaker ? { said_by: evidence.speaker } : {}) } : {};
    // A person did not get "mentioned" by a meeting they were in — they attended it; and a
    // meeting is *about* its subjects, while it merely mentions the systems it names.
    if (c.kind === "Person") await link(entity.id, "attended", sourceNode.id, attributes);
    else await link(sourceNode.id, c.kind === "Topic" ? "about" : "mentions", entity.id, attributes);
  }

  // ---- the connections it described --------------------------------------------------------
  const chosenRelations = new Set(selection.relations);
  for (const r of extraction.relations) {
    if (!chosenRelations.has(r.key)) continue;
    const from = entityForCandidate.get(r.from);
    const to = entityForCandidate.get(r.to);
    if (!from || !to) continue; // one end was not accepted
    const evidence = r.mentions[0];
    await link(from, r.kind, to, evidence ? { quote: evidence.quote, ...(evidence.speaker ? { said_by: evidence.speaker } : {}) } : {});
  }

  // ---- what people made of it --------------------------------------------------------------
  const chosenViewpoints = new Set(selection.viewpoints);
  for (const v of extraction.viewpoints) {
    if (!chosenViewpoints.has(v.key)) continue;
    const kind = VIEWPOINT_KIND[v.type];
    // The text is the name: a decision is identified by what was decided.
    const node = await insertEntity(kind, trimName(v.text), v.text, {
      ...(v.speaker ? { raised_by: v.speaker } : {}),
      source: source.name,
      confidence: v.confidence,
    });
    result.viewpointsCreated++;
    await link(sourceNode.id, "produced", node.id, { quote: v.text });
    const person = entityForCandidate.get(`person|${norm(v.speaker)}`);
    if (person) await link(person, "raised", node.id);
    for (const about of v.about) {
      const target = entityForCandidate.get(about);
      if (target) await link(node.id, "about", target);
    }
  }

  await db.update(s.sources).set({ status: "committed", entityId: sourceNode.id, updatedAt: ts }).where(eq(s.sources.id, source.id));
  return result;
}

/** A node name has to fit on a card; the full sentence stays in the description. */
function trimName(text: string, limit = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= limit) return t;
  const cut = t.lastIndexOf(" ", limit);
  return t.slice(0, cut > 20 ? cut : limit) + "…";
}
