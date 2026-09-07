import { redirect } from "next/navigation";

/**
 * The landing zone was called APM until rev 70, when it became what it always was: the way data
 * gets into Nexus, whatever the data is about. The old address is kept because somebody has it in
 * a bookmark or a runbook, and a 404 is a poor way to tell them about a rename.
 */
export default async function LegacyApmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/w/${slug}/import`);
}
