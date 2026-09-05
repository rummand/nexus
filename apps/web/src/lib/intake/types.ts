/**
 * The intake layer: unconsolidated data in, candidate graph out.
 *
 * Everything here is client-safe and free of database types, because the same shapes drive the
 * pipeline viewer, the review screen and the server action that commits an extraction.
 *
 * The vocabulary, in one place:
 *
 *   source      — where data came from: an uploaded transcript, a pasted document, a connector
 *                 sync. A source is itself a node in the graph, so a meeting is as touchable as
 *                 the applications discussed in it.
 *   passage     — one segment of a source: a speaker turn in a transcript, a paragraph in a
 *                 document. Everything extracted points back at the passage it came from.
 *   candidate   — a thing the extractor believes exists, with the quotes that convinced it.
 *   viewpoint   — what a *person* said about it: a decision, an action, a risk, a question, a
 *                 need. The same meeting yields different viewpoints for different people, which
 *                 is the point of reading meetings at all.
 *   stage       — one step of the pipeline, reported with its counts so the run is watchable.
 */

export type SourceKind = "transcript" | "document" | "table" | "connector";

export interface Passage {
  id: string;
  /** Empty for documents, which have no speakers. */
  speaker: string;
  /** Timestamp as written in the source ("00:04:12"), empty when there is none. */
  at: string;
  text: string;
  index: number;
}

export type Confidence = "high" | "medium" | "low";

export interface Mention {
  passageId: string;
  speaker: string;
  quote: string;
}

/** A node the extractor believes belongs in the graph. */
export interface Candidate {
  /** Stable across runs of the same source, so decisions can be remembered. */
  key: string;
  kind: string;
  name: string;
  description: string;
  attributes: Record<string, string>;
  confidence: Confidence;
  /** Why the extractor thinks so, in one line. */
  reason: string;
  mentions: Mention[];
  /** Set when the name matches an entity already in the graph. */
  existingEntityId?: string;
}

export interface CandidateRelation {
  key: string;
  /** Candidate keys, not entity ids: the entities may not exist yet. */
  from: string;
  to: string;
  kind: string;
  confidence: Confidence;
  reason: string;
  mentions: Mention[];
}

export type ViewpointType = "decision" | "action" | "risk" | "question" | "need";

/** Something a named person said that the organisation should keep. */
export interface Viewpoint {
  key: string;
  type: ViewpointType;
  speaker: string;
  text: string;
  passageId: string;
  /** Candidate keys mentioned in the same passage — what the viewpoint is *about*. */
  about: string[];
  confidence: Confidence;
}

export type StageStatus = "ok" | "empty" | "error";

/** One step of a pipeline run, reported so the run can be watched rather than guessed at. */
export interface StageReport {
  id: string;
  name: string;
  /** One line saying what the stage did, in the run's own numbers. */
  detail: string;
  in: number;
  out: number;
  ms: number;
  status: StageStatus;
}

export interface Extraction {
  sourceKind: SourceKind;
  sourceName: string;
  passages: Passage[];
  speakers: string[];
  candidates: Candidate[];
  relations: CandidateRelation[];
  viewpoints: Viewpoint[];
  stages: StageReport[];
  /** Characters of source text read. */
  characters: number;
}
