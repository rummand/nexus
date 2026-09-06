import { NextResponse } from "next/server";
import { knowledgeOverview, searchKnowledge } from "@/lib/knowledge";

/**
 * The knowledge base over HTTP.
 *
 * `GET /api/knowledge` describes the corpus; `?q=…` searches it. It exists so the module can be
 * used by something that is not this UI — another agent, a script, a colleague with curl — which
 * is the point of building it as a standalone package rather than a page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 6) || 6));

  if (!q) {
    const overview = knowledgeOverview();
    return NextResponse.json({
      builtAt: overview.builtAt,
      documents: overview.documents,
      registered: overview.registered,
      passages: overview.passages,
      characters: overview.characters,
      licenses: overview.licenses,
      lessons: overview.lessons.length,
    });
  }

  const result = searchKnowledge(q, limit);
  return NextResponse.json({
    query: result.query,
    empty: result.empty,
    tookMs: result.tookMs,
    unknownTerms: result.unknownTerms,
    passages: result.passages.map((p) => ({
      label: p.label, title: p.title, url: p.url, license: p.license, text: p.text, score: Number(p.score.toFixed(3)), matched: p.matched,
    })),
  });
}
