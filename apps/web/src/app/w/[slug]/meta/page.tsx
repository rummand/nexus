import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { metaModel } from "@/lib/metamodel";
import { conformance } from "@/lib/metamodel-conformance";
import { parseAttributes } from "@/lib/attributes";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
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
  /*
   * Conformance is computed here rather than in the browser: it reads every entity and relation in
   * the workspace, and shipping the estate to the client to divide it by a model the server already
   * has would be sending the whole graph to answer a question about it (§5.56).
   */
  const [entities, relations] = await Promise.all([
    db.select().from(s.entities).where(eq(s.entities.workspaceId, workspace.id)),
    db.select().from(s.relations_).where(eq(s.relations_.workspaceId, workspace.id)),
  ]);
  const byId = new Map(entities.map((e) => [e.id, e]));
  const report = conformance(
    model,
    entities.map((e) => ({ id: e.id, kind: e.kind, name: e.name, attributes: parseAttributes(e.attributes) })),
    relations.map((r) => ({
      id: r.id, kind: r.kind,
      fromKind: byId.get(r.fromEntityId)?.kind ?? "",
      toKind: byId.get(r.toEntityId)?.kind ?? "",
      fromName: byId.get(r.fromEntityId)?.name ?? "(gone)",
      toName: byId.get(r.toEntityId)?.name ?? "(gone)",
    })),
  );
  // The corpus is read on the server and only the matched passage crosses to the client: a
  // meta-model has a dozen types, and the corpus is megabytes.
  return <MetaModelBuilder model={model} workspaceId={workspace.id} slug={slug} notes={typeNotes(model.nodeTypes.map((t) => t.name))} report={report} />;
}
