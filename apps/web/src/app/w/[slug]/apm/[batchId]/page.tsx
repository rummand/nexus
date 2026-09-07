import { redirect } from "next/navigation";

/** The old address of one batch. See ../page.tsx. */
export default async function LegacyApmBatchPage({ params }: { params: Promise<{ slug: string; batchId: string }> }) {
  const { slug, batchId } = await params;
  redirect(`/w/${slug}/import/${batchId}`);
}
