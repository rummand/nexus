import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { entityDetail } from "@/lib/graph";
import { metaModel } from "@/lib/metamodel";
import { getWorkspaceBySlug } from "@/lib/data";
import { FactSheet } from "@/components/factsheet/FactSheet";

/**
 * One object's own page (§5.77).
 *
 * An address somebody can send in a mail, which the drawer never was. The drawer stays where it
 * belongs — beside a canvas, where leaving the board to read an object would lose your place —
 * and everywhere else a click on an object comes here.
 *
 * Reached by a click from inside the product, this address is intercepted and the sheet opens in
 * a window over the list you came from (`@sheet/(.)fs/[entityId]`). This file is what a cold load
 * of the same address gets: the same sheet, standing on its own, scrolling in its own column.
 */
export default async function FactSheetPage({ params }: { params: Promise<{ slug: string; entityId: string }> }) {
  const { slug, entityId } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const db = await getDb();
  const detail = await entityDetail(db, entityId);
  if (!detail) notFound();

  const model = await metaModel(db, workspace.id);
  const type = model.nodeTypes.find((t) => t.name.trim().toLowerCase() === detail.entity.kind.trim().toLowerCase());

  /*
   * The fields of the type, plus whatever this object carries that the type does not declare —
   * `sheetSections` files the second lot together rather than guessing where they belong.
   */
  return (
    <div className="fs-page" data-factsheet-page={entityId}>
      <FactSheet
        slug={slug}
        detail={detail}
        fields={type?.fields ?? []}
        color={type?.color || model.nodeTypes.find((t) => t.name === detail.entity.kind)?.color || ""}
        typeDeclared={Boolean(type?.id)}
        framework={type?.framework ?? ""}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; entityId: string }> }) {
  const { entityId } = await params;
  const db = await getDb();
  const detail = await entityDetail(db, entityId);
  return { title: detail ? `${detail.entity.name} · Nexus` : "Nexus" };
}
