import { desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { parseAttributes } from "@/lib/graph";
import * as s from "@/db/schema";
import { getWorkspaceBySlug } from "@/lib/data";
import type { Extraction, SourceKind } from "@/lib/intake/types";
import { intakeLandscape } from "@/lib/intake/landscape";
import { scanForSources, type ScanReport } from "@/lib/catalog/discovery";
import { connectionsFor, customProviders, type ConnectionRow } from "@/lib/catalog/read";
import type { Provider } from "@/lib/catalog/types";

import type { ExplorerGraph } from "@/lib/explorer";
import { IntakeWorkbench, type SourceRow } from "@/components/intake/IntakeWorkbench";

/**
 * Intake: sources in, graph out.
 *
 * The selected source lives in the URL rather than in client state, so only that source's
 * extraction is loaded — the others can be large, and a workspace accumulates them.
 */
export default async function IntakePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ source?: string; view?: string }>;
}) {
  const { slug } = await params;
  const { source: requested, view } = await searchParams;
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();
  const db = await getDb();

  const rows = await db
    .select({
      id: s.sources.id, name: s.sources.name, kind: s.sources.kind, connector: s.sources.connector,
      status: s.sources.status, characters: s.sources.characters, createdAt: s.sources.createdAt,
    })
    .from(s.sources)
    .where(eq(s.sources.workspaceId, workspace.id))
    .orderBy(desc(s.sources.createdAt));

  // Latest run per source, for the counts in the list. Newest first, first one wins.
  const runs = rows.length
    ? await db
        .select({
          sourceId: s.sourceRuns.sourceId, candidateCount: s.sourceRuns.candidateCount,
          relationCount: s.sourceRuns.relationCount, viewpointCount: s.sourceRuns.viewpointCount,
          committedCount: s.sourceRuns.committedCount, createdAt: s.sourceRuns.createdAt,
        })
        .from(s.sourceRuns)
        .where(inArray(s.sourceRuns.sourceId, rows.map((r) => r.id)))
        .orderBy(desc(s.sourceRuns.createdAt))
    : [];
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!latest.has(r.sourceId)) latest.set(r.sourceId, r);

  const sources: SourceRow[] = rows.map((r) => {
    const run = latest.get(r.id);
    return {
      id: r.id,
      name: r.name,
      kind: r.kind as SourceKind,
      connector: r.connector,
      status: r.status,
      characters: r.characters,
      createdAt: r.createdAt,
      counts: run
        ? { candidates: run.candidateCount, relations: run.relationCount, viewpoints: run.viewpointCount, committed: run.committedCount }
        : null,
    };
  });

  // The landscape is the whole intake neighbourhood, so it is loaded only when that view is open.
  const landscape: ExplorerGraph | null = view === "landscape" ? await intakeLandscape(db, workspace.id) : null;

  // The catalogue: what has been decided here, and what the discovery agent proposes on top of
  // the evidence already in the workspace.
  let scan: ScanReport | null = null;
  let connections: ConnectionRow[] = [];
  let custom: Provider[] = [];
  if (view === "catalog") {
    connections = await connectionsFor(db, workspace.id);
    const [entityRows, relationRows, sourceTexts, boardRows, nodeTypeRows, extraProviders] = await Promise.all([
      db.select().from(s.entities).where(eq(s.entities.workspaceId, workspace.id)),
      db.select({ toEntityId: s.relations_.toEntityId }).from(s.relations_).where(eq(s.relations_.workspaceId, workspace.id)),
      db.select({ id: s.sources.id, name: s.sources.name, text: s.sources.text }).from(s.sources).where(eq(s.sources.workspaceId, workspace.id)),
      db.select({ id: s.boards.id, name: s.boards.name, document: s.boards.document }).from(s.boards).where(eq(s.boards.workspaceId, workspace.id)),
      db.select({ name: s.nodeTypes.name }).from(s.nodeTypes).where(eq(s.nodeTypes.workspaceId, workspace.id)),
      customProviders(db, workspace.id),
    ]);
    custom = extraProviders;
    // An entity is "sourced" when something explains it: an intake provenance, or an edge from a
    // source node pointing at it.
    const pointedAt = new Set(relationRows.map((r) => r.toEntityId));
    scan = scanForSources({
      entities: entityRows.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        attributes: parseAttributes(e.attributes),
        sourced: e.source !== "canvas" || pointedAt.has(e.id),
      })),
      texts: [
        ...sourceTexts.map((t) => ({ ...t, channel: "intake" as const })),
        ...boardRows.map((b) => ({ id: b.id, name: b.name, text: boardText(b.document), channel: "board" as const })),
      ],
      typeNames: nodeTypeRows.map((n) => n.name),
      decided: connections.filter((c) => c.status !== "proposed").map((c) => c.providerId),
      extraProviders,
    });
  }

  const selected = sources.find((row) => row.id === requested) ?? sources[0] ?? null;
  let extraction: Extraction | null = null;
  if (selected) {
    const [run] = await db
      .select({ extraction: s.sourceRuns.extraction })
      .from(s.sourceRuns)
      .where(eq(s.sourceRuns.sourceId, selected.id))
      .orderBy(desc(s.sourceRuns.createdAt))
      .limit(1);
    if (run) extraction = JSON.parse(run.extraction) as Extraction;
  }

  return (
    <IntakeWorkbench
      workspaceId={workspace.id}
      slug={slug}
      sources={sources}
      selected={selected}
      extraction={extraction}
      view={view === "landscape" ? "landscape" : view === "catalog" ? "catalog" : "workbench"}
      landscape={landscape}
      scan={scan}
      customProviders={custom}
      connections={connections}
    />
  );
}

/** Every readable string on a board: titles, bodies and free text. */
function boardText(document: string): string {
  try {
    const parsed = JSON.parse(document) as { elements?: Record<string, Record<string, unknown>> };
    return Object.values(parsed.elements ?? {})
      .flatMap((el) => [el.title, el.body, el.text, el.kind].filter((v): v is string => typeof v === "string" && v.length > 0))
      .join("\n");
  } catch {
    return "";
  }
}
