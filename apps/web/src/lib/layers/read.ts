import type { MetaModel } from "../metamodel";
import type { ObservedEdge, TypeCount } from "./infer";

/**
 * The estate's own dependency directions, as the layering engine wants them (§5.58).
 *
 * Observed pairs only — never the declared rules. A rule is what somebody intended; the point of
 * inferring a stack is to read what the organisation's data actually does, and grading the model
 * against a layering derived from the same model would be circular.
 */
export function observedEdges(model: MetaModel): ObservedEdge[] {
  return model.relationTypes.flatMap((rt) =>
    rt.observedPairs.map((p) => ({ from: p.fromType, to: p.toType, count: p.count })));
}

/** The kinds to place, with how much of the estate each accounts for. */
export function typeCounts(model: MetaModel): TypeCount[] {
  return model.nodeTypes.map((t) => ({ name: t.name, instances: t.instances }));
}

/** Where each kind currently sits, for checking a declared stack against the data. */
export function placement(model: MetaModel): Map<string, { name: string; position: number }> {
  const byId = new Map(model.layers.map((l) => [l.id, l]));
  const out = new Map<string, { name: string; position: number }>();
  for (const t of model.nodeTypes) {
    const l = t.layerId ? byId.get(t.layerId) : undefined;
    if (l) out.set(t.name.trim().toLowerCase(), { name: l.name, position: l.position });
  }
  return out;
}
