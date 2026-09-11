import type { ChangeOverlay } from "./store";

/**
 * Loading the to-be view of a change set or a plateau (§5.82).
 *
 * The same fetch was written out in the viewpoint panel and needed again for the ref you are
 * standing on, and a second copy of "how a change set becomes an overlay" is the kind of
 * duplication that drifts: one of them gains a field, the other quietly does not.
 *
 * `value` is the vocabulary the panel's select already speaks — `chg:<id>` for one plan,
 * `plt:<id>` for a named state — so an overlay loaded from anywhere shows up selected there.
 */
export async function loadOverlay(value: string): Promise<ChangeOverlay | null> {
  const [kind, id] = value.split(":");
  if (!id) return null;
  const res = await fetch(kind === "plt" ? `/api/plateaus/${id}/overlay` : `/api/change-sets/${id}/overlay`).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json()) as {
    id: string; name: string; targetDate: string;
    retired: string[]; changed: string[];
    added: Array<{ id: string; name: string; kind: string; description: string }>;
    impact: string;
  };
  return {
    id: value,
    name: data.name,
    targetDate: data.targetDate,
    retired: new Set(data.retired),
    changed: new Set(data.changed),
    added: data.added,
    impact: data.impact,
  };
}
