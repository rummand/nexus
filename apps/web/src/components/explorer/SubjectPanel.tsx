"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Radar, Route } from "lucide-react";
import type { ExplorerNode } from "@/lib/explorer";
import type { Direction, RelationGroup } from "@/lib/explorer-views";

/**
 * The entity you are standing on (§5.68).
 *
 * The old panel listed up to forty neighbours as one flat column of names, which is a wall
 * rather than a description. The same neighbours grouped by relationship type **and split by
 * direction** — "uses 12 · used by 9 · hosted on 3" — say what the thing *is*. Direction is not
 * decoration: "what the CRM depends on" and "what depends on the CRM" are opposite answers, and
 * the old explorer, which treated every edge as undirected, gave the same one to both.
 */

const DIRECTION_LABEL: Record<Direction, string> = {
  out: "Downstream — what this reaches",
  in: "Upstream — what reaches this",
  both: "Either way",
};

export function SubjectPanel({
  node, groups, byId, depth, onDepth, onPick, onTrace, impact, onImpact, impactSet, slug,
}: {
  node: ExplorerNode;
  groups: RelationGroup[];
  byId: Map<string, ExplorerNode>;
  depth: number;
  onDepth: (d: number) => void;
  onPick: (id: string) => void;
  onTrace: (id: string) => void;
  impact: Direction | null;
  onImpact: (d: Direction | null) => void;
  /** Everything the current blast radius reaches, with hop counts. */
  impactSet: Map<string, number> | null;
  slug?: string;
}) {
  const name = (id: string) => byId.get(id)?.name ?? "(gone)";

  return (
    <aside className="subject-panel" aria-label="Selected entity" data-subject-panel>
      <header>
        <i style={{ background: node.color }} />
        <div>
          <small>{node.kind || "Untyped"}</small>
          <strong data-subject-name>{node.name || "(unnamed)"}</strong>
        </div>
      </header>

      {Object.keys(node.attributes).length > 0 && (
        <div className="explorer-attrs">
          {Object.entries(node.attributes).map(([k, v]) => <span key={k}><b>{k}</b> {v}</span>)}
        </div>
      )}

      <div className="subject-actions">
        <button type="button" className="ghost-button" onClick={() => onTrace(node.id)} title="Find the routes between this and another entity">
          <Route size={13} /> Trace a route
        </button>
        {slug && <Link className="ghost-button" href={`/e/${node.id}`}>Open</Link>}
      </div>

      <section className="subject-block">
        <h3>Show around it</h3>
        <div className="subject-hops" role="group" aria-label="Hops to show">
          {[1, 2, 3].map((d) => (
            <button key={d} type="button" className={depth === d ? "active" : ""} onClick={() => onDepth(d)} data-depth={d}>
              {d} hop{d === 1 ? "" : "s"}
            </button>
          ))}
        </div>
      </section>

      <section className="subject-block">
        <h3>
          <Radar size={12} /> Blast radius
        </h3>
        <div className="subject-hops" role="group" aria-label="Blast radius direction">
          {(["out", "in", "both"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={impact === d ? "active" : ""}
              onClick={() => onImpact(impact === d ? null : d)}
              title={DIRECTION_LABEL[d]}
              data-impact={d}
            >
              {d === "out" ? "Downstream" : d === "in" ? "Upstream" : "Either way"}
            </button>
          ))}
        </div>
        {impact && impactSet && (
          <p className="subject-impact" data-impact-count>
            {impactSet.size === 0
              ? impact === "out"
                ? "Nothing is downstream of this. Removing it reaches nobody."
                : "Nothing is upstream of this."
              : <>
                  <b>{impactSet.size}</b>{" "}
                  {impact === "out" ? "entities are downstream" : impact === "in" ? "entities are upstream" : "entities are connected, either way"}
                  {" — "}{[...new Set(impactSet.values())].length} hop{[...new Set(impactSet.values())].length === 1 ? "" : "s"} deep.
                </>}
          </p>
        )}
      </section>

      <section className="subject-block">
        <h3>{node.degree} connection{node.degree === 1 ? "" : "s"}</h3>
        {groups.length === 0 ? (
          <p className="subject-none">
            Nothing is connected to this. Either it stands alone, or it was imported and never modelled.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.kind} className="subject-group" data-relation-group={g.kind}>
              <em>{g.kind || "related to"}</em>
              {g.out.length > 0 && (
                <ul>
                  <li className="subject-dir"><ArrowUpRight size={11} /> outgoing <b>{g.out.length}</b></li>
                  {g.out.map((c) => (
                    <li key={c.edgeId}>
                      <button type="button" onClick={() => onPick(c.other)} data-neighbour={c.other}>
                        <i style={{ background: byId.get(c.other)?.color ?? "#94a3b8" }} />
                        <b>{name(c.other)}</b>
                        <small>{byId.get(c.other)?.kind || "Untyped"}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {g.in.length > 0 && (
                <ul>
                  <li className="subject-dir"><ArrowDownRight size={11} /> incoming <b>{g.in.length}</b></li>
                  {g.in.map((c) => (
                    <li key={c.edgeId}>
                      <button type="button" onClick={() => onPick(c.other)} data-neighbour={c.other}>
                        <i style={{ background: byId.get(c.other)?.color ?? "#94a3b8" }} />
                        <b>{name(c.other)}</b>
                        <small>{byId.get(c.other)?.kind || "Untyped"}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>
    </aside>
  );
}
