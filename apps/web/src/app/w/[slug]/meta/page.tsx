import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { metaModel } from "@/lib/metamodel";
import { getWorkspaceBySlug } from "@/lib/data";
import { MetaModelBuilder } from "@/components/metamodel/MetaModelBuilder";

/** Meta-model builder: the technical view of the graph's schema (node types, relation types, fields, rules). */
export default async function MetaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();
  const model = await metaModel(db, workspace.id);
  return <MetaModelBuilder model={model} workspaceId={workspace.id} slug={slug} />;
}
