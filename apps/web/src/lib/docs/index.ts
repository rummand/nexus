import { FIRST_BOARD, START } from "./pages/getting-started";
import { BOARDS_AND_GRAPH, BOARD_AGENTS, CANVAS, COMPOSE, SEARCH, TIMELINE, VIEWPOINTS } from "./pages/canvas";
import { AGENT, EXPLORER, GRAPH, HEALTH, META_MODEL } from "./pages/model";
import { CATALOGUE, INTAKE, KNOWLEDGE } from "./pages/data";
import { PLATEAUS, ROADMAP } from "./pages/time";
import { CONCEPTS, FAQ, SHORTCUTS } from "./pages/reference";
import { pageText, type DocPage, type DocSection } from "./types";

/**
 * The documentation, in reading order.
 *
 * Ordered as somebody would actually learn the product — draw something, understand what it did,
 * then the model, then getting data in, then time — rather than by the shape of the codebase.
 */
export const SECTIONS: DocSection[] = [
  { title: "Getting started", pages: [START, FIRST_BOARD] },
  { title: "Working on the canvas", pages: [CANVAS, BOARDS_AND_GRAPH, VIEWPOINTS, TIMELINE, BOARD_AGENTS, COMPOSE, SEARCH] },
  { title: "The model", pages: [GRAPH, EXPLORER, META_MODEL, HEALTH, AGENT] },
  { title: "Bringing data in", pages: [INTAKE, CATALOGUE, KNOWLEDGE] },
  { title: "Planning ahead", pages: [ROADMAP, PLATEAUS] },
  { title: "Reference", pages: [SHORTCUTS, CONCEPTS, FAQ] },
];

export const PAGES: DocPage[] = SECTIONS.flatMap((s) => s.pages);

export function docPage(slug: string): DocPage | null {
  return PAGES.find((p) => p.slug === slug) ?? null;
}

/** The page before and after this one, so a reader can go straight through. */
export function neighbours(slug: string): { previous: DocPage | null; next: DocPage | null } {
  const i = PAGES.findIndex((p) => p.slug === slug);
  return { previous: i > 0 ? PAGES[i - 1]! : null, next: i >= 0 && i < PAGES.length - 1 ? PAGES[i + 1]! : null };
}

/**
 * Search the documentation.
 *
 * Word overlap over the page's whole text, with the title and summary weighted: the corpus is
 * seventeen pages, so anything cleverer would be fitting noise.
 */
export function searchDocs(query: string, limit = 8): Array<{ page: DocPage; score: number }> {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const hits: Array<{ page: DocPage; score: number }> = [];
  for (const page of PAGES) {
    const haystack = pageText(page).toLowerCase();
    const head = `${page.title} ${page.summary} ${(page.keywords ?? []).join(" ")}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (head.includes(term)) score += 4;
      else if (haystack.includes(term)) score += 1;
    }
    if (score > 0) hits.push({ page, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title)).slice(0, limit);
}

export { type Block, type DocPage, type DocSection, resolveHref } from "./types";
