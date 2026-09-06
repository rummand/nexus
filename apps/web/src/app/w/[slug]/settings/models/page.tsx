import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/data";
import { modelSettings } from "@/lib/models/actions";
import { ModelSettings } from "@/components/settings/ModelSettings";

/**
 * Where the thinking happens.
 *
 * The one screen that decides what the rest of the product is talking to. Everything on it is
 * resolved on the server: no API key reaches the browser, and none is ever sent back out.
 */
export default async function ModelSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const settings = await modelSettings(workspace.id);
  return <ModelSettings slug={slug} workspaceId={workspace.id} {...settings} />;
}
