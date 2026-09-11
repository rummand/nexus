import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { graphSnapshot } from "@/lib/graph";
import { metaModel } from "@/lib/metamodel";
import { getWorkspaceBySlug } from "@/lib/data";
import { Repository } from "@/components/inventory/Repository";

/**
 * The repository: every object the model holds (§5.76).
 *
 * Rev 109 gave each type a page and no way to reach it except a chip on the knowledge graph.
 * This is the entry in the rail that was missing — the shelf the fact sheets sit on — and it is
 * one flat list on purpose: the question it answers is "where is that thing", and a search box
 * over everything answers it faster than any tree.
 */
export default async function RepositoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const db = await getDb();
  const [snapshot, model] = await Promise.all([graphSnapshot(db, workspace.id), metaModel(db, workspace.id)]);
  const declared = new Set(model.nodeTypes.map((t) => t.name.trim().toLowerCase()));
  const nameOf = new Map(snapshot.entities.map((e) => [e.id, e.name]));

  return (
    <Repository
      slug={slug}
      types={snapshot.kinds.map((k) => ({
        kind: k.kind,
        count: k.count,
        color: k.color,
        declared: declared.has(k.kind.trim().toLowerCase()),
      }))}
      items={snapshot.entities.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        description: e.description,
        parent: (e.parentId && nameOf.get(e.parentId)) || "",
        relationCount: e.relationCount,
        boardCount: e.boardCount,
        updatedAt: e.updatedAt,
        /* Whether the meta-model declares the type this object claims — a filter in the rail
           (§5.78), and the reason 52 undeclared types is visible rather than merely true. */
        declared: declared.has(e.kind.trim().toLowerCase()),
      }))}
    />
  );
}
