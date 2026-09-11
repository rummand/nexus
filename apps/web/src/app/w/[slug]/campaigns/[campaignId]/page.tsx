import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { getCampaign } from "@/lib/campaign/read";
import { CampaignQueue } from "@/components/campaign/CampaignQueue";

/** One campaign, as a queue (§5.85). */
export default async function CampaignPage({ params }: { params: Promise<{ slug: string; campaignId: string }> }) {
  const { slug, campaignId } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const db = await getDb();
  const detail = await getCampaign(db, campaignId);
  if (!detail || detail.campaign.workspaceId !== workspace.id) notFound();

  return <div className="studio-home-main"><CampaignQueue slug={slug} detail={detail} /></div>;
}
