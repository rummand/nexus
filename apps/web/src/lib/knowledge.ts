import "server-only";
import {
  REFERENCES,
  SOURCES,
  allLessons,
  citationLabel,
  groundingFor,
  knowledgeBase,
  loadManifest,
  rankLessons,
  retrieve,
  type Answer,
  type Lesson,
  type LessonScope,
} from "@nexus/ea-knowledge";

/**
 * The web app's view of the knowledge base.
 *
 * `@nexus/ea-knowledge` is a standalone module — it has its own CLI and knows nothing about Nexus.
 * This file is the seam: it reads the corpus from disk (server only; the corpus is megabytes and
 * has no business in a browser bundle) and turns it into the plain shapes the page and the agents
 * want.
 */

export interface Passage {
  id: string;
  label: string;
  title: string;
  url: string;
  license: string;
  text: string;
  score: number;
  matched: string[];
}

export interface KnowledgeResult {
  query: string;
  passages: Passage[];
  unknownTerms: string[];
  /** No corpus at all, as opposed to no match — the page says something different for each. */
  empty: boolean;
  tookMs: number;
}

export function searchKnowledge(query: string, limit = 6): KnowledgeResult {
  const started = Date.now();
  const answer: Answer = retrieve(query, { limit });
  return {
    query,
    passages: answer.hits.map((hit) => ({
      id: hit.chunk.id,
      label: citationLabel(hit.chunk),
      title: hit.chunk.title,
      url: hit.chunk.url,
      license: hit.chunk.license,
      text: hit.chunk.text,
      score: hit.score,
      matched: hit.matched,
    })),
    unknownTerms: answer.unknownTerms,
    empty: answer.empty,
    tookMs: Date.now() - started,
  };
}

export interface KnowledgeOverview {
  builtAt: string;
  documents: number;
  registered: number;
  passages: number;
  characters: number;
  licenses: Array<{ id: string; name: string; count: number }>;
  topics: Array<{ topic: string; count: number }>;
  sources: Array<{ id: string; title: string; url: string; license: string; topics: string[]; why: string; characters: number; fetchedAt: string }>;
  unreachable: Array<{ id: string; title: string; error: string }>;
  references: typeof REFERENCES;
  lessons: Lesson[];
}

export function knowledgeOverview(): KnowledgeOverview {
  const kb = knowledgeBase();
  const manifest = loadManifest();
  const licenses = new Map<string, { id: string; name: string; count: number }>();
  const topics = new Map<string, number>();
  for (const source of manifest?.sources ?? []) {
    const entry = licenses.get(source.license) ?? { id: source.license, name: source.licenseName, count: 0 };
    entry.count++;
    licenses.set(source.license, entry);
    for (const topic of source.topics) topics.set(topic, (topics.get(topic) ?? 0) + 1);
  }
  return {
    builtAt: manifest?.builtAt ?? "",
    documents: kb.corpus.documents.length,
    registered: SOURCES.length,
    passages: kb.chunks.length,
    characters: manifest?.characters ?? 0,
    licenses: [...licenses.values()].sort((a, b) => b.count - a.count),
    topics: [...topics.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic)),
    sources: (manifest?.sources ?? []).map((s) => ({
      id: s.id, title: s.title, url: s.url, license: s.license, topics: s.topics, why: s.why, characters: s.characters, fetchedAt: s.fetchedAt,
    })),
    unreachable: manifest?.unreachable ?? [],
    references: REFERENCES,
    lessons: allLessons(),
  };
}

/**
 * The grounding block for an agent, or "" when the corpus is missing.
 *
 * Returning "" rather than throwing is deliberate: an agent must still work when the knowledge
 * base has not been ingested. Grounding makes it better, it does not make it possible.
 */
export function agentGrounding(scope: LessonScope, task: string, limit = 4): string {
  try {
    return groundingFor(scope, task, limit);
  } catch {
    return "";
  }
}

/** The statements an agent was grounded in, for showing the person what influenced the answer. */
export function groundedIn(scope: LessonScope, task: string, limit = 4): string[] {
  try {
    return rankLessons(scope, task, limit).map((l) => l.statement);
  } catch {
    return [];
  }
}

/**
 * The doctrine behind each estate-health measure.
 *
 * Health tells you a number and what would move it. What it could not say was *why anyone should
 * care*, which is the difference between a metric and an argument. Each health-scope lesson is
 * tagged with the measure it speaks to, so the panel can show the practice and the passage it
 * came from next to the score.
 */
export function measureAuthority(): Record<string, { statement: string; quote: string; title: string; url: string }> {
  const sources = new Map(knowledgeOverview().sources.map((s) => [s.id, s]));
  const out: Record<string, { statement: string; quote: string; title: string; url: string }> = {};
  for (const lesson of allLessons()) {
    if (!lesson.applies.includes("health")) continue;
    for (const tag of lesson.tags) {
      if (out[tag]) continue;
      const source = sources.get(lesson.citation.sourceId);
      if (!source) continue;
      out[tag] = { statement: lesson.statement, quote: lesson.citation.quote, title: source.title, url: source.url };
    }
  }
  return out;
}

/**
 * A definition for each type name in a meta-model.
 *
 * A meta-model is a set of claims about what kinds of thing exist in an organisation, and the
 * usual way it goes wrong is quietly: a "Capability" that is really a department, an "Interface"
 * that is really a file drop. Putting the field's own definition next to the declaration is the
 * cheapest possible check on that. Only names the corpus actually covers get a note — an invented
 * kind gets silence rather than the nearest article, which would be worse than nothing.
 */
export function typeNotes(names: string[]): Record<string, { label: string; title: string; url: string; text: string }> {
  const out: Record<string, { label: string; title: string; url: string; text: string }> = {};
  for (const name of names) {
    const clean = name.trim();
    if (clean.length < 3) continue;
    const answer = retrieve(clean, { limit: 1, perSource: 1 });
    const hit = answer.hits[0];
    if (!hit) continue;
    // The passage has to be about the type, not merely contain the word. A title match is the
    // signal that the corpus has an article on this thing rather than a passing mention.
    const title = hit.chunk.title.toLowerCase();
    const wanted = clean.toLowerCase();
    const overlap = wanted.split(/\s+/).filter((w) => w.length > 3 && title.includes(w)).length;
    if (!title.includes(wanted) && overlap === 0) continue;
    out[wanted] = {
      label: citationLabel(hit.chunk),
      title: hit.chunk.title,
      url: hit.chunk.url,
      text: hit.chunk.text.length > 420 ? `${hit.chunk.text.slice(0, 420).replace(/\s\S*$/, "")}…` : hit.chunk.text,
    };
  }
  return out;
}

export type { Lesson, LessonScope };
