import { detectSourceKind, parsePassages, speakersOf } from "./transcript";
import { extractCandidates, extractRelations, extractViewpoints, type Vocabulary } from "./extract";
import type { Extraction, StageReport } from "./types";

/**
 * One pass over one source, reported stage by stage.
 *
 * The stages are not an implementation detail: the intake screen draws them, so a run is
 * something you watch rather than a spinner that eventually produces rows. Every stage says what
 * it did in the run's own numbers ("47 passages from 5 speakers"), which is what makes an
 * extraction arguable — if the graph gains something odd, the stage that invented it is visible.
 *
 * Pure, so a pipeline run is a unit test rather than a screenshot.
 */

export const PIPELINE_STAGES = [
  { id: "read", name: "Read" },
  { id: "segment", name: "Segment" },
  { id: "recognise", name: "Recognise" },
  { id: "resolve", name: "Resolve" },
  { id: "relate", name: "Relate" },
  { id: "viewpoints", name: "Viewpoints" },
  { id: "stage", name: "Stage for review" },
] as const;

export type StageId = (typeof PIPELINE_STAGES)[number]["id"];

export interface PipelineInput {
  name: string;
  text: string;
  vocabulary: Vocabulary;
  /** Injectable clock so stage timings are deterministic in tests. */
  clock?: () => number;
}

export function runPipeline({ name, text, vocabulary, clock = () => Date.now() }: PipelineInput): Extraction {
  const stages: StageReport[] = [];
  const timed = <T>(id: StageId, inCount: number, run: () => { out: number; detail: string; value: T }): T => {
    const started = clock();
    try {
      const { out, detail, value } = run();
      stages.push({
        id,
        name: PIPELINE_STAGES.find((s) => s.id === id)!.name,
        detail,
        in: inCount,
        out,
        ms: Math.max(0, clock() - started),
        status: out > 0 ? "ok" : "empty",
      });
      return value;
    } catch (error) {
      stages.push({
        id,
        name: PIPELINE_STAGES.find((s) => s.id === id)!.name,
        detail: error instanceof Error ? error.message : "failed",
        in: inCount,
        out: 0,
        ms: Math.max(0, clock() - started),
        status: "error",
      });
      throw error;
    }
  };

  const sourceKind = timed("read", 1, () => {
    const kind = detectSourceKind(text);
    return { out: text.length, detail: `${text.length.toLocaleString("en")} characters, read as a ${kind}`, value: kind };
  });

  const passages = timed("segment", text.length, () => {
    const parsed = parsePassages(text);
    const speakers = speakersOf(parsed);
    const detail = speakers.length
      ? `${parsed.length} passages from ${speakers.length} speaker${speakers.length === 1 ? "" : "s"}`
      : `${parsed.length} paragraph${parsed.length === 1 ? "" : "s"}, no speakers`;
    return { out: parsed.length, detail, value: parsed };
  });
  const speakers = speakersOf(passages);

  const candidates = timed("recognise", passages.length, () => {
    const found = extractCandidates(passages, vocabulary);
    const emergent = found.filter((c) => !c.kind).length;
    return {
      out: found.length,
      detail: `${found.length} candidate${found.length === 1 ? "" : "s"}${emergent ? `, ${emergent} of a kind nobody has declared` : ""}`,
      value: found,
    };
  });

  timed("resolve", candidates.length, () => {
    const linked = candidates.filter((c) => c.existingEntityId).length;
    return {
      out: linked,
      detail: linked
        ? `${linked} of ${candidates.length} already exist in the graph — the rest would be new`
        : `nothing matched an existing entity; all ${candidates.length} would be new`,
      value: null,
    };
  });

  const relations = timed("relate", candidates.length, () => {
    const found = extractRelations(passages, candidates, vocabulary);
    const kinds = new Set(found.map((r) => r.kind));
    return {
      out: found.length,
      detail: `${found.length} connection${found.length === 1 ? "" : "s"} across ${kinds.size} relation kind${kinds.size === 1 ? "" : "s"}`,
      value: found,
    };
  });

  const viewpoints = timed("viewpoints", passages.length, () => {
    const found = extractViewpoints(passages, candidates);
    const counts = new Map<string, number>();
    for (const v of found) counts.set(v.type, (counts.get(v.type) ?? 0) + 1);
    const detail = found.length
      ? [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t}${n === 1 ? "" : "s"}`).join(", ")
      : "nothing decided, asked or owed";
    return { out: found.length, detail, value: found };
  });

  const total = candidates.length + relations.length + viewpoints.length;
  timed("stage", total, () => ({
    out: total,
    detail: `${total} object${total === 1 ? "" : "s"} waiting for a human`,
    value: null,
  }));

  return {
    sourceKind,
    sourceName: name,
    passages,
    speakers,
    candidates,
    relations,
    viewpoints,
    stages,
    characters: text.length,
  };
}
