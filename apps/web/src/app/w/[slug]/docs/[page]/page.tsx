import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { docPage, neighbours, PAGES } from "@/lib/docs";
import { DocArticle } from "@/components/docs/DocArticle";

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  const doc = docPage(page);
  return { title: doc ? `${doc.title} · Nexus documentation` : "Documentation · Nexus" };
}

/** Every page is known at build time, so they can all be static. */
export function generateStaticParams() {
  return PAGES.map((page) => ({ page: page.slug }));
}

export default async function DocPageRoute({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page } = await params;
  const doc = docPage(page);
  if (!doc) notFound();
  const { previous, next } = neighbours(page);
  return <DocArticle page={doc} slug={slug} previous={previous} next={next} />;
}
