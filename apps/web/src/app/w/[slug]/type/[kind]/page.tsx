import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { graphSnapshot } from "@/lib/graph";
import { metaModel } from "@/lib/metamodel";
import { descendants } from "@/lib/hierarchy";
import { getWorkspaceBySlug } from "@/lib/data";
import { Inventory } from "@/components/inventory/Inventory";

/**
 * One type, as a destination (§5.72).
 *
 * A kind used to be a chip on a page of everything. It is a place now: `/w/acme/type/Application`
 * is the application inventory, and it can be linked, bookmarked, sent to somebody and put in a
 * sidebar — which is most of what makes an inventory feel like part of the product rather than a
 * filter somebody remembered to apply.
 *
 * A kind with no declared type is still a destination. The meta-model grows out of the data
 * (§2.2), so an inventory that only worked for declared types would be unavailable exactly when
 * somebody is trying to make sense of what an import brought in.
 */
export default async function TypePage({ params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind: raw } = await params;
  const kind = decodeURIComponent(raw);
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const db = await getDb();
  const [snapshot, model] = await Promise.all([graphSnapshot(db, workspace.id), metaModel(db, workspace.id)]);

  const items = snapshot.entities.filter((e) => e.kind.trim().toLowerCase() === kind.trim().toLowerCase());
  /*
   * Where each one sits, read across the whole workspace rather than this type alone: a capability
   * can hold applications, and counting only its own kind would report a parent as empty (§5.70).
   */
  const nameOf = new Map(snapshot.entities.map((e) => [e.id, e.name]));
  const tree = snapshot.entities.map((e) => ({ id: e.id, parentId: e.parentId }));
  const type = model.nodeTypes.find((t) => t.name.trim().toLowerCase() === kind.trim().toLowerCase());
  if (items.length === 0 && !type) notFound();

  return (
    <Inventory
      slug={slug}
      kind={type?.name ?? kind}
      color={snapshot.kinds.find((k) => k.kind === kind)?.color ?? ""}
      description={type?.description ?? ""}
      declared={Boolean(type?.id)}
      framework={type?.framework ?? ""}
      fields={type?.fields ?? []}
      items={items.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        description: e.description,
        attributes: e.attributes,
        relationCount: e.relationCount,
        boardCount: e.boardCount,
        parent: (e.parentId && nameOf.get(e.parentId)) || "",
        beneath: descendants(tree, e.id).length,
      }))}
      siblings={snapshot.kinds.map((k) => ({ kind: k.kind, count: k.count, color: k.color }))}
    />
  );
}
