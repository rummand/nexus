import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getWorkspaceBySlug } from "@/lib/data";
import { listCampaigns } from "@/lib/campaign/read";
import { burnWords } from "@/lib/campaign/state";
import { NewCampaign } from "@/components/campaign/NewCampaign";

/**
 * Every campaign (§5.85).
 *
 * The list exists so a campaign is a thing an organisation has rather than a page somebody
 * bookmarked, and so the one number that matters — how far through — is visible without opening
 * anything.
 */
export default async function CampaignsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const db = await getDb();
  const campaigns = await listCampaigns(db, workspace.id);

  return (
    <div className="studio-home-main campaigns" data-campaigns>
      <div className="studio-home-topbar">
        <div>
          <span>Going through the estate, deliberately</span>
          <h1>Campaigns</h1>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <p className="campaign-empty">
          No campaigns yet. A campaign is a named, finite piece of validation with an end: a scope,
          a definition of done, and a queue somebody can get through.
        </p>
      ) : (
        <ul className="campaign-list">
          {campaigns.map((c) => (
            <li key={c.id} data-campaign-card={c.id} className={c.status === "closed" ? "closed" : ""}>
              <Link href={`/w/${slug}/campaigns/${c.id}`}>
                <b>{c.name}</b>
                {c.description && <span>{c.description}</span>}
                <em>{burnWords(c.burn)}{c.status === "closed" ? " · closed" : ""}</em>
                <div className="campaign-bar"><i style={{ width: `${c.burn.percent}%` }} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewCampaign workspaceId={workspace.id} slug={slug} />
    </div>
  );
}

export const metadata = { title: "Campaigns · Nexus" };
