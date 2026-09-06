import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data";
import { knowledgeOverview, searchKnowledge } from "@/lib/knowledge";
import { KnowledgeLibrary } from "@/components/knowledge/KnowledgeLibrary";

/**
 * The EA knowledge base: what the agents have read, and what they were taught from it.
 *
 * The query lives in the URL rather than in client state, so a passage a colleague found can be
 * sent to somebody else as a link — the same reason the intake source and the graph query do.
 * Search runs on the server: the corpus is megabytes of text and belongs nowhere near a browser.
 */
export default async function KnowledgePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { slug } = await params;
  const { q, tab } = await searchParams;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const overview = knowledgeOverview();
  const result = q?.trim() ? searchKnowledge(q.trim(), 8) : null;

  return <KnowledgeLibrary slug={slug} overview={overview} result={result} tab={tab === "sources" || tab === "lessons" ? tab : "search"} />;
}
