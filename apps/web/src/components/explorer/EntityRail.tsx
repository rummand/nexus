"use client";

import { Search, Unlink } from "lucide-react";
import type { ExplorerGraph, ExplorerNode } from "@/lib/explorer";

/**
 * Every entity, as a list you can search (§5.68).
 *
 * The old explorer's only way in was to find a dot on a canvas and hope you had guessed which
 * one it was — search existed, but it floated over the picture in a card that covered it. A
 * graph tool needs a *directory*: the whole estate, ordered by how connected each thing is,
 * always visible, one click to stand on any of it.
 *
 * The unconnected entities have their own section at the bottom, and it is phrased as the
 * finding it is. On the old canvas they were scattered across the middle of the view — most of
 * the picture on this workspace — where they read as structure. They are its absence.
 */

export function EntityRail({
  graph, nodes, isolatedIds, subject, query, onQuery, hiddenKinds, onToggleKind,
  hiddenRelations, onToggleRelation, onPick,
}: {
  graph: ExplorerGraph;
  /** Already filtered by kind and search, ordered by degree. */
  nodes: ExplorerNode[];
  isolatedIds: Set<string>;
  subject: string | null;
  query: string;
  onQuery: (q: string) => void;
  hiddenKinds: Set<string>;
  onToggleKind: (kind: string) => void;
  hiddenRelations: Set<string>;
  onToggleRelation: (kind: string) => void;
  onPick: (id: string) => void;
}) {
  const connected = nodes.filter((n) => !isolatedIds.has(n.id));
  const alone = nodes.filter((n) => isolatedIds.has(n.id));

  /*
   * Three entities called "Asset Register" is a real thing in a real estate, and a list of three
   * identical rows is unnavigable — you cannot pick the one you mean. Where a name repeats, the
   * kind is shown beside it. It does not always separate them, but it says *that* they are
   * different, which a bare repeated name actively denies.
   */
  const seen = new Map<string, number>();
  for (const n of nodes) seen.set(n.name, (seen.get(n.name) ?? 0) + 1);

  const row = (n: ExplorerNode) => (
    <button
      key={n.id}
      type="button"
      className={n.id === subject ? "on" : ""}
      onClick={() => onPick(n.id)}
      data-rail-entity={n.id}
      title={(seen.get(n.name) ?? 0) > 1 ? `One of ${seen.get(n.name)} entities called "${n.name}"` : undefined}
    >
      <i style={{ background: n.color }} />
      <b>{n.name || "(unnamed)"}</b>
      {(seen.get(n.name) ?? 0) > 1 && <u data-rail-dupe>{n.kind || "Untyped"}</u>}
      <small>{n.degree || ""}</small>
    </button>
  );

  return (
    <aside className="entity-rail" aria-label="Entities" data-entity-rail>
      <label className="studio-home-search rail-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Find an entity"
          aria-label="Find an entity"
          data-rail-search
        />
      </label>

      <div className="rail-filters">
        <span>Kinds</span>
        {graph.kinds.map((k) => (
          <button
            key={k.kind}
            type="button"
            className={hiddenKinds.has(k.kind) ? "off" : ""}
            onClick={() => onToggleKind(k.kind)}
            title={hiddenKinds.has(k.kind) ? `Show ${k.kind || "untyped"}` : `Hide ${k.kind || "untyped"}`}
            data-kind-filter={k.kind}
          >
            <i style={{ background: k.color }} /> {k.kind || "Untyped"} <small>{k.count}</small>
          </button>
        ))}
      </div>

      {graph.relationKinds.length > 0 && (
        <div className="rail-filters">
          <span>Relationships</span>
          {graph.relationKinds.map((k) => (
            <button
              key={k.kind}
              type="button"
              className={hiddenRelations.has(k.kind) ? "off" : ""}
              onClick={() => onToggleRelation(k.kind)}
              title={hiddenRelations.has(k.kind) ? `Follow ${k.kind} again` : `Stop following ${k.kind}`}
              data-relation-filter={k.kind}
            >
              {k.kind || "untyped"} <small>{k.count}</small>
            </button>
          ))}
        </div>
      )}

      <div className="rail-list" data-rail-list>
        {connected.length > 0 && (
          <>
            <h3>Connected <small>{connected.length}</small></h3>
            {connected.map(row)}
          </>
        )}

        {alone.length > 0 && (
          <>
            <h3 className="rail-alone" data-rail-isolated>
              <Unlink size={11} /> Connected to nothing <small>{alone.length}</small>
            </h3>
            <p className="rail-note">
              No relationships at all. Standalone, or imported and never modelled.
            </p>
            {alone.map(row)}
          </>
        )}

        {nodes.length === 0 && <p className="rail-note">Nothing matches.</p>}
      </div>
    </aside>
  );
}
