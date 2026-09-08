/**
 * Reading the entity attribute bag.
 *
 * Attributes are stored as a JSON object of string→string, and everything that reads the graph
 * needs the same forgiving parse: a bad blob is an empty bag, never an exception, because one
 * malformed row must not take out the page that would let somebody fix it.
 *
 * It lives on its own (rather than in `graph.ts`) so that the history recorder can snapshot an
 * entity without importing the board-synchronisation module that imports the recorder.
 */
export function parseAttributes(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (k.trim() && val !== null && val !== undefined && String(val).trim()) out[k.trim()] = String(val).trim();
    return out;
  } catch {
    return {};
  }
}
