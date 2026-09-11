import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { entityDetail } from "@/lib/graph";
import { metaModel } from "@/lib/metamodel";
import { getWorkspaceBySlug } from "@/lib/data";
import { campaignsFor } from "@/lib/campaign/read";
import { FactSheet } from "@/components/factsheet/FactSheet";
import { SheetWindow } from "@/components/factsheet/SheetWindow";

/**
 * An object opened from somewhere else (§5.77).
 *
 * This is the same page as `/w/[slug]/fs/[entityId]`, intercepted: clicking a row in the
 * repository does not leave the repository, it opens the object over it, in a window that fills
 * everything right of the menu. The list underneath keeps its scroll position and its filters, the
 * address bar still says what you are looking at, and Escape or the back button puts it away.
 *
 * A cold load of the same address gets the standalone page instead — nothing is behind it to
 * overlay, and a link in a mail must still open something whole.
 */
export default async function SheetOverlay({ params }: { params: Promise<{ slug: string; entityId: string }> }) {
  const { slug, entityId } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const db = await getDb();
  const detail = await entityDetail(db, entityId);
  if (!detail) notFound();

  const [model, campaigns] = await Promise.all([metaModel(db, workspace.id), campaignsFor(db, workspace.id, entityId)]);
  const type = model.nodeTypes.find((t) => t.name.trim().toLowerCase() === detail.entity.kind.trim().toLowerCase());

  return (
    <SheetWindow name={detail.entity.name} kind={detail.entity.kind} slug={slug} entityId={entityId}>
      <FactSheet
        slug={slug}
        detail={detail}
        fields={type?.fields ?? []}
        color={type?.color || ""}
        typeDeclared={Boolean(type?.id)}
        framework={type?.framework ?? ""}
        campaigns={campaigns}
      />
    </SheetWindow>
  );
}
