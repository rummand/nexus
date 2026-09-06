import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { metaModel } from "@/lib/metamodel";
import { getWorkspaceBySlug } from "@/lib/data";
import { MetaModelBuilder } from "@/components/metamodel/MetaModelBuilder";
import { typeNotes } from "@/lib/knowledge";

/** Meta-model builder: the technical view of the graph's schema (node types, relation types, fields, rules). */
export default async function MetaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const model = await metaModel(db, workspace.id);
  // The corpus is read on the server and only the matched passage crosses to the client: a
  // meta-model has a dozen types, and the corpus is megabytes.
  return <MetaModelBuilder model={model} workspaceId={workspace.id} slug={slug} notes={typeNotes(model.nodeTypes.map((t) => t.name))} />;
}
