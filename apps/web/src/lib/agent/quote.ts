/**
 * The check that makes a model's claim worth reading.
 *
 * Shared by everything an agent says — proposals about the graph, remarks about a board — because
 * it is the same promise in both places: the agent must copy the words it read, and the words are
 * checked against the thing it says it read them from. Loose about form (it may re-wrap whitespace,
 * change case, or elide a middle with an ellipsis), strict about substance.
 *
 * Four characters is the floor. Objects in a model often say what they are in a single term —
 * "SCADA", "batch", "end of life" — and demanding a sentence would throw away the honest citations
 * along with the invented ones.
 */

export const normalise = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export function quotesFrom(haystack: string, quote: string): boolean {
  const needle = normalise(quote);
  if (needle.length < 4) return false;
  const hay = normalise(haystack);
  if (hay.includes(needle)) return true;
  const parts = needle.split(/\s*(?:…|\.\.\.)\s*/).filter((p) => p.length >= 4);
  return parts.length > 1 && parts.every((p) => hay.includes(p));
}
