/**
 * Doctrine: what the agents are actually taught.
 *
 * Retrieval alone does not make an agent better at enterprise architecture. Dropping three
 * paragraphs of encyclopedia into a prompt mostly adds tokens; what changes behaviour is a short
 * rule the agent can apply while it works — "a capability is what the organisation does, not the
 * team that does it" — at the moment it is deciding something.
 *
 * So the module carries two layers: the corpus (evidence, searchable, quotable) and this file
 * (rules, few, applied). The rule that keeps the second honest is that **every lesson quotes a
 * passage that is really in the corpus**, verbatim. `lessons.test.ts` checks each quote against
 * the fetched text and fails if it is not there, which is what stops this file drifting into
 * folklore that sounds like knowledge.
 */

import { loadCorpus } from "./corpus";
import { LESSON_DATA } from "./lesson-data";
import type { Lesson, LessonScope } from "./types";

export function allLessons(): Lesson[] {
  return LESSON_DATA;
}

export function lessonsFor(scope: LessonScope): Lesson[] {
  return LESSON_DATA.filter((l) => l.applies.includes(scope));
}

/**
 * The lessons most relevant to a task, best first.
 *
 * Scoring is deliberately simple — tag and word overlap with the task text — because the set is
 * small enough that a cleverer ranker would be fitting noise. A task that matches nothing gets
 * the scope's lessons in their declared order, which are ordered most-general-first for exactly
 * this case.
 */
export function rankLessons(scope: LessonScope, task: string, limit = 4): Lesson[] {
  const words = new Set(task.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const scoped = lessonsFor(scope);
  const scored = scoped.map((lesson) => {
    let score = 0;
    for (const tag of lesson.tags) if (words.has(tag.toLowerCase())) score += 3;
    for (const w of lesson.statement.toLowerCase().split(/[^a-z0-9]+/)) if (w.length > 3 && words.has(w)) score += 1;
    return { lesson, score };
  });
  const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.lesson);
  return (hits.length ? hits : scoped).slice(0, limit);
}

/**
 * The grounding block for a task: the rules, each with the passage it came from.
 *
 * The citation travels with the rule on purpose. An agent that has been told "capabilities are
 * stable, processes change" and can also see where that came from will cite it when it explains
 * itself, and a human reviewing the output can go and disagree with the source rather than with
 * the machine.
 */
export function groundingFor(scope: LessonScope, task: string, limit = 4): string {
  const lessons = rankLessons(scope, task, limit);
  if (!lessons.length) return "";
  const docs = new Map(loadCorpus().documents.map((d) => [d.sourceId, d]));
  const lines = lessons.map((lesson, i) => {
    const doc = docs.get(lesson.citation.sourceId);
    const where = doc ? `${doc.title} — ${doc.url}` : lesson.citation.sourceId;
    return `${i + 1}. ${lesson.statement}\n   ${lesson.detail}\n   Source: ${where}\n   “${lesson.citation.quote}”`;
  });
  return `Enterprise-architecture practice to follow (from the Nexus knowledge base):\n\n${lines.join("\n\n")}`;
}
