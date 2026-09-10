"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Layers as LayersIcon, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import type { MetaModel } from "@/lib/metamodel";
import { inferLayers, upwardFlows } from "@/lib/layers/infer";
import { observedEdges, placement, typeCounts } from "@/lib/layers/read";
import { adoptInferredLayering, createLayer, deleteLayer, moveLayer } from "@/lib/layers/actions";
import { framework } from "@/lib/frameworks";

/**
 * The stack (§5.58).
 *
 * A layering is the one piece of an EA model that everybody arrives already having an opinion
 * about — business over application over technology — and the one most tools make you configure
 * before you have any data. Nexus can do it the other way round, which is §2.2 in miniature: the
 * estate's own dependency directions already say what sits under what, so the agent reads the
 * stack out of the graph and offers it, with the counts that justify each band.
 *
 * Three things share this screen, in the order somebody needs them: what the stack is now, what the
 * data thinks it should be, and where the two disagree.
 */
export function Layers({ model, workspaceId, onChanged }: { model: MetaModel; workspaceId: string; onChanged: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adopted, setAdopted] = useState<string | null>(null);

  const reading = useMemo(() => inferLayers(typeCounts(model), observedEdges(model)), [model]);
  const disagreements = useMemo(() => upwardFlows(placement(model), observedEdges(model)), [model]);

  const typesIn = (layerId: string) => model.nodeTypes.filter((t) => t.layerId === layerId);
  const relsIn = (layerId: string) => model.relationTypes.filter((t) => t.layerId === layerId);
  const unplaced = model.nodeTypes.filter((t) => !t.layerId);

  const run = (fn: () => Promise<{ error?: string } | unknown>) => {
    setError(null);
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      if (r && "error" in r && r.error) { setError(r.error); return; }
      onChanged();
    });
  };

  return (
    <div className="meta-layers" data-layers>
      <p className="muted">
        A layer groups object types and relation types into a stack, top to bottom. Dependencies are
        supposed to run downward — which is what makes a stack worth having, and what lets the data
        be checked against it.
      </p>

      {/* ---- the stack as it stands ---------------------------------------------------- */}
      {model.layers.length === 0 ? (
        <p className="layer-empty"><LayersIcon size={15} /> No layers yet. Read one out of the estate below, adopt a framework that brings its own, or add one by hand.</p>
      ) : (
        <ol className="layer-stack" data-layer-stack>
          {model.layers.map((l, i) => (
            <li key={l.id} className="layer" data-layer={l.id}>
              <header>
                <b>{l.name}</b>
                <LayerSource source={l.source} />
                <span className="layer-count">{typesIn(l.id).length} object type{typesIn(l.id).length === 1 ? "" : "s"}</span>
                <span className="layer-controls">
                  <button type="button" disabled={pending || i === 0} aria-label={`Move ${l.name} up`}
                          onClick={() => run(() => moveLayer(l.id, "up"))}><ArrowUp size={13} /></button>
                  <button type="button" disabled={pending || i === model.layers.length - 1} aria-label={`Move ${l.name} down`}
                          onClick={() => run(() => moveLayer(l.id, "down"))}><ArrowDown size={13} /></button>
                  <button type="button" disabled={pending} aria-label={`Delete ${l.name}`}
                          onClick={() => run(() => deleteLayer(l.id))}><Trash2 size={13} /></button>
                </span>
              </header>
              {l.description && <p className="layer-why">{l.description}</p>}
              <div className="layer-types">
                {typesIn(l.id).map((t) => (
                  <span key={t.name} className="layer-chip"><i style={{ background: t.color }} />{t.name}<small>{t.instances}</small></span>
                ))}
                {relsIn(l.id).map((t) => (
                  <span key={`r-${t.name}`} className="layer-chip rel">{t.name}</span>
                ))}
                {typesIn(l.id).length === 0 && relsIn(l.id).length === 0 && <span className="muted">nothing in this layer yet</span>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {unplaced.length > 0 && model.layers.length > 0 && (
        <div className="layer-unplaced" data-unplaced>
          <h5>Not in any layer · {unplaced.length}</h5>
          <div className="layer-types">
            {unplaced.map((t) => (
              <span key={t.name} className="layer-chip"><i style={{ background: t.color }} />{t.name}<small>{t.instances}</small></span>
            ))}
          </div>
          <p className="muted">Put a type in a layer from its own page, under Details.</p>
        </div>
      )}

      <form
        className="layer-add"
        onSubmit={(e) => { e.preventDefault(); if (!newName.trim()) return; run(() => createLayer(workspaceId, newName)); setNewName(""); }}
      >
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New layer" aria-label="New layer name" disabled={pending} />
        <button type="submit" disabled={pending || !newName.trim()}>Add layer</button>
      </form>

      {/* ---- what the estate says ------------------------------------------------------- */}
      <section className="layer-reading" data-layer-reading>
        <h4><Sparkles size={14} /> What the estate says the stack is</h4>
        <p className="muted">
          Read from the direction of the connections that actually exist, not from the names. If
          nineteen connections run one way between two kinds and none run back, one of them is
          underneath the other.
        </p>
        <p className="layer-verdict">{reading.verdict}</p>

        {reading.layers.length > 0 && (
          <ol className="layer-stack proposed">
            {reading.layers.map((band, i) => (
              <li key={i} className="layer" data-proposed-layer={i}>
                <header><b>{band.name}</b><span className="layer-count">{band.instances} object{band.instances === 1 ? "" : "s"}</span></header>
                <p className="layer-why">{band.why}</p>
                <div className="layer-types">
                  {band.types.map((t) => <span key={t} className="layer-chip">{t}</span>)}
                </div>
              </li>
            ))}
          </ol>
        )}

        {reading.unplaced.length > 0 && (
          <p className="muted layer-note">
            Nothing connects {reading.unplaced.map((u) => u.name).join(", ")}, so the data cannot say where {reading.unplaced.length === 1 ? "it belongs" : "they belong"}.
          </p>
        )}
        {reading.ambiguous.length > 0 && (
          <ul className="layer-caveats">
            {reading.ambiguous.map((a, i) => (
              <li key={i}>{a.from} sits above {a.to} on {a.forward} connections against {a.back} — close enough to be worth checking.</li>
            ))}
          </ul>
        )}
        {reading.dropped.length > 0 && (
          <ul className="layer-caveats">
            {reading.dropped.map((d, i) => (
              <li key={i}>Ignored {d.count} connection{d.count === 1 ? "" : "s"} from {d.from} to {d.to}: with {d.from === d.to ? "it" : "them"} the stack would be a loop.</li>
            ))}
          </ul>
        )}

        {reading.confident && (
          <div className="layer-adopt">
            <button
              type="button" className="primary-home-button" disabled={pending} data-adopt-layering
              onClick={() => start(async () => {
                setError(null);
                const r = await adoptInferredLayering(workspaceId);
                if ("error" in r) { setError(r.error as string); return; }
                setAdopted(
                  `Added ${r.created} layer${r.created === 1 ? "" : "s"} and placed ${r.placed} type${r.placed === 1 ? "" : "s"}`
                  + (r.declared ? `, declaring ${r.declared} that had only grown from the data.` : "."),
                );
                onChanged();
              })}
            >
              {pending ? "Reading…" : "Use this layering"}
            </button>
            <span className="muted">
              Adds only what is missing, and a type you placed yourself is left where you put it. A
              kind that has never been declared is declared, because a kind that is not a type
              cannot be in a layer.
            </span>
          </div>
        )}
        {adopted && <p className="layer-ok" data-layering-ok>{adopted}</p>}
      </section>

      {/* ---- where the two disagree ------------------------------------------------------ */}
      {disagreements.length > 0 && (
        <section className="layer-upward" data-upward>
          <h4><TriangleAlert size={14} /> Connections that run up the stack · {disagreements.length}</h4>
          <p className="muted">
            A layered model claims dependencies run downward. Each of these runs the other way, so
            either the connection is wrong or one of the two types is in the wrong band. Nothing has
            been blocked or changed.
          </p>
          <ul>
            {disagreements.slice(0, 30).map((f, i) => <li key={i}>{f.detail}</li>)}
          </ul>
        </section>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/** Who put this layer here: a framework, a person, or the agent reading the estate. */
function LayerSource({ source }: { source: string }) {
  if (!source) return <i className="layer-source hand">by hand</i>;
  if (source === "agent") return <i className="layer-source agent"><Sparkles size={10} /> from the data</i>;
  return <i className="layer-source fw">{framework(source)?.name ?? source}</i>;
}
