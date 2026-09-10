/**
 * What the data says the layers are (§5.58).
 *
 * §2.2 is the whole product: **the organisation's data describes its meta-model**, and the agents
 * read it rather than an architect configuring it. A layering imported from ArchiMate is somebody
 * else's stack; this asks the narrower and more useful question — given how these kinds of thing
 * actually connect in *this* estate, what sits above what?
 *
 * The answer comes from direction of dependency, which is the only signal that is really there.
 * If nineteen connections run Application → Technology and none run back, Technology is underneath.
 * That is not a heuristic about names; it is what the graph says. So:
 *
 * 1. Sum the observed connections between every ordered pair of kinds.
 * 2. For each pair, keep the dominant direction and note how lopsided it was.
 * 3. Break any remaining cycle by dropping its weakest edge, and say which — a stack drawn out of a
 *    cyclic graph has had a decision taken for it, and the reader should be told.
 * 4. Rank by longest path from the kinds nothing points at. Equal rank means the same band.
 *
 * **Only the name is guessed.** The grouping is the data's; the label comes from a small word list
 * so the bands arrive with something readable on them, and it is an editable default rather than a
 * claim. Naming a band "Technology" because it contains Server and Database is a convenience;
 * putting Server and Database in the same band is a finding.
 */

export interface TypeCount {
  name: string;
  instances: number;
}

export interface ObservedEdge {
  from: string;
  to: string;
  count: number;
}

export interface ProposedLayer {
  name: string;
  types: string[];
  /** Total instances across its types, so a one-object band can be recognised as one. */
  instances: number;
  /** Why these sit at this height, with the counts that say so. */
  why: string;
}

export interface DroppedEdge {
  from: string;
  to: string;
  count: number;
}

export interface Layering {
  /** Top to bottom. */
  layers: ProposedLayer[];
  /** Kinds nothing connects, which could sit anywhere. */
  unplaced: Array<{ name: string; instances: number }>;
  /** Pairs the data points both ways about; the weaker direction lost. */
  ambiguous: Array<{ from: string; to: string; forward: number; back: number }>;
  /** Edges dropped to break a cycle, because a stack cannot contain one. */
  dropped: DroppedEdge[];
  /** How many observed connections the layering was derived from. */
  observed: number;
  /** Enough to be worth showing. Below this it is arithmetic on noise. */
  confident: boolean;
  /** Said in one sentence, for somebody who will not read the bands. */
  verdict: string;
}

const norm = (v: string) => v.trim().toLowerCase();

/**
 * A label for a band, guessed from the words in it.
 *
 * Deliberately short and deliberately conventional: these are the layer names an EA team already
 * argues in, so a band that happens to hold Server and Database should arrive called "Technology"
 * rather than "Layer 3". Ordered most specific first — "data object" must beat "object".
 */
const VOCABULARY: Array<{ layer: string; rank: number; words: string[] }> = [
  { layer: "Motivation", rank: 0, words: ["goal", "driver", "principle", "requirement", "outcome", "strategic theme", "objective", "risk"] },
  { layer: "Strategy", rank: 1, words: ["capability", "value stream", "course of action", "resource", "portfolio epic"] },
  { layer: "Business", rank: 2, words: ["business", "process", "actor", "organisation", "organization", "department", "team", "role", "person", "customer", "product", "service offer", "contract"] },
  { layer: "Information", rank: 3, words: ["data object", "information", "dataset", "data entity", "document", "message", "event"] },
  { layer: "Application", rank: 4, words: ["application", "software system", "system", "component", "module", "container", "microservice", "app"] },
  { layer: "Integration", rank: 5, words: ["interface", "api", "integration", "queue", "topic", "endpoint"] },
  { layer: "Technology", rank: 6, words: ["technology", "infrastructure", "platform", "server", "node", "database", "runtime", "host", "network", "artifact", "device", "it component"] },
];

/** Which conventional layer a set of type names reads as, or "" when nothing matches. */
export function nameFor(types: string[]): string {
  const scores = new Map<string, number>();
  for (const t of types) {
    const n = norm(t);
    /*
     * The longest matching word wins *across all layers*, not the first layer in list order: an
     * "IT Component" is technology by way of "it component" rather than software by way of
     * "component", and a "Data Object" is information rather than an object of some kind. A type
     * counts towards one layer only.
     */
    let best: { layer: string; word: string } | null = null;
    for (const { layer, words } of VOCABULARY) {
      for (const w of words) {
        if (!n.includes(w)) continue;
        if (!best || w.length > best.word.length) best = { layer, word: w };
      }
    }
    if (best) scores.set(best.layer, (scores.get(best.layer) ?? 0) + 1);
  }
  if (scores.size === 0) return "";
  const top = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
  // A band whose name would rest on one type out of many is not named at all.
  return top[1] * 2 >= types.length ? top[0] : "";
}

/** Where convention puts a named layer in the stack. Lower is higher up. */
export const conventionalRank = (layer: string): number =>
  VOCABULARY.find((v) => v.layer === layer)?.rank ?? -1;

/** The list of names a sentence can carry without becoming a list. */
const few = (names: string[]) =>
  names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;

export function inferLayers(types: TypeCount[], edges: ObservedEdge[]): Layering {
  const present = new Map<string, TypeCount>();
  for (const t of types) if (norm(t.name)) present.set(norm(t.name), t);

  // ---- 1. sum the connections between every ordered pair -----------------------------------
  const pair = new Map<string, number>();
  let observed = 0;
  for (const e of edges) {
    const from = norm(e.from), to = norm(e.to);
    if (!present.has(from) || !present.has(to) || from === to) continue;
    pair.set(`${from}|${to}`, (pair.get(`${from}|${to}`) ?? 0) + e.count);
    observed += e.count;
  }

  // ---- 2. keep the dominant direction of each pair -------------------------------------------
  const ambiguous: Layering["ambiguous"] = [];
  const above = new Map<string, Map<string, number>>(); // from → to → weight, meaning "from is above to"
  const seenPair = new Set<string>();
  for (const key of pair.keys()) {
    const [a, b] = key.split("|") as [string, string];
    const unordered = [a, b].sort().join("|");
    if (seenPair.has(unordered)) continue;
    seenPair.add(unordered);
    const forward = pair.get(`${a}|${b}`) ?? 0;
    const back = pair.get(`${b}|${a}`) ?? 0;
    if (forward === back) continue; // a genuine tie says nothing about which is above
    const [hi, lo, w, l] = forward > back ? [a, b, forward, back] : [b, a, back, forward];
    // Lopsided enough to be a direction, or merely more of one than the other? Both are kept, but
    // a near-tie is reported: it is the reader's business that the stack rests on 6 against 5.
    if (l > 0 && l * 3 >= w) ambiguous.push({ from: present.get(hi)!.name, to: present.get(lo)!.name, forward: w, back: l });
    const m = above.get(hi) ?? new Map<string, number>();
    m.set(lo, w - l);
    above.set(hi, m);
  }

  // ---- 3. break cycles, weakest edge first ---------------------------------------------------
  const dropped: DroppedEdge[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const cycle = findCycle(above, [...present.keys()]);
    if (!cycle) break;
    let weakest: { from: string; to: string; w: number } | null = null;
    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i]!, to = cycle[(i + 1) % cycle.length]!;
      const w = above.get(from)?.get(to) ?? Infinity;
      if (!weakest || w < weakest.w) weakest = { from, to, w };
    }
    if (!weakest) break;
    above.get(weakest.from)?.delete(weakest.to);
    dropped.push({ from: present.get(weakest.from)!.name, to: present.get(weakest.to)!.name, count: weakest.w });
  }

  // ---- 4. rank by longest path from the kinds nothing points at -------------------------------
  const incoming = new Map<string, number>();
  for (const key of present.keys()) incoming.set(key, 0);
  for (const [, tos] of above) for (const to of tos.keys()) incoming.set(to, (incoming.get(to) ?? 0) + 1);

  const rank = new Map<string, number>();
  const order: string[] = [];
  const queue = [...present.keys()].filter((k) => (incoming.get(k) ?? 0) === 0);
  const pending = new Map(incoming);
  for (const k of queue) rank.set(k, 0);
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const [to] of above.get(n) ?? []) {
      rank.set(to, Math.max(rank.get(to) ?? 0, (rank.get(n) ?? 0) + 1));
      pending.set(to, (pending.get(to) ?? 1) - 1);
      if ((pending.get(to) ?? 0) === 0) queue.push(to);
    }
  }

  // Anything the walk never reached (only possible if a cycle survived the guard) sits at the bottom.
  for (const k of present.keys()) if (!rank.has(k)) rank.set(k, Math.max(0, ...rank.values()) + 1);

  const connected = new Set<string>();
  for (const [from, tos] of above) { if (tos.size) connected.add(from); for (const to of tos.keys()) connected.add(to); }

  const unplaced = [...present.keys()]
    .filter((k) => !connected.has(k))
    .map((k) => ({ name: present.get(k)!.name, instances: present.get(k)!.instances }))
    .sort((a, b) => b.instances - a.instances || a.name.localeCompare(b.name));

  const byRank = new Map<number, string[]>();
  for (const k of connected) byRank.set(rank.get(k) ?? 0, [...(byRank.get(rank.get(k) ?? 0) ?? []), k]);

  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  const layers: ProposedLayer[] = ranks.map((r, i) => {
    const keys = (byRank.get(r) ?? []).sort((a, b) =>
      (present.get(b)!.instances - present.get(a)!.instances) || a.localeCompare(b));
    const names = keys.map((k) => present.get(k)!.name);
    const guessed = nameFor(names);
    // Downward traffic from the band above, which is the evidence this band is below it.
    let down = 0, up = 0;
    if (i > 0) {
      const aboveKeys = new Set(byRank.get(ranks[i - 1]!) ?? []);
      for (const k of keys) {
        for (const a of aboveKeys) {
          down += pair.get(`${a}|${k}`) ?? 0;
          up += pair.get(`${k}|${a}`) ?? 0;
        }
      }
    }
    const why = i === 0
      ? `Nothing in the estate points at ${few(names)}; every connection they have runs downward.`
      : up === 0
        ? `All ${down} connection${down === 1 ? "" : "s"} between this band and the one above run downward.`
        : `${down} of the ${down + up} connections between this band and the one above run downward.`;
    return { name: guessed, types: names, instances: keys.reduce((n, k) => n + present.get(k)!.instances, 0), why };
  });

  /*
   * A conventional name may confirm the data's ordering; it may never contradict it.
   *
   * The word list knows Technology belongs under Application. If the estate has put a band of
   * infrastructure *above* the applications — and estates do, when that is how the connections were
   * drawn — then calling it "Technology" imports a claim the data does not make, and the reader is
   * left with a stack that says one thing and reads as another.
   *
   * All-or-nothing rather than band-by-band, because dropping one name out of the middle leaves a
   * stack that still *looks* conventional and is not. Either the whole reading agrees with the
   * conventional order, in which case the familiar words are a genuine confirmation, or it does
   * not, in which case every band is named after its own largest type: duller, and always true.
   */
  const ranked = layers.map((b) => (b.name ? conventionalRank(b.name) : -1)).filter((r) => r >= 0);
  const agrees = ranked.every((r, i) => i === 0 || r >= ranked[i - 1]!);
  if (!agrees) for (const band of layers) band.name = "";

  /*
   * Two bands must not end up with the same name.
   *
   * The word list can put "Application" on two different heights — a band holding Application and
   * one holding Component — and a stack with the same word twice is both unreadable and, since a
   * layer name is unique per workspace, unwritable. The band with more of the estate in it keeps
   * the word; the other is named after its own largest type, which is duller and always true.
   */
  const claimed = new Set<string>();
  for (const band of [...layers].sort((a, b) => b.instances - a.instances)) {
    const key = band.name.toLowerCase();
    if (band.name && !claimed.has(key)) { claimed.add(key); continue; }
    const fallback = band.types[0] ?? "";
    band.name = fallback && !claimed.has(fallback.toLowerCase()) ? fallback : `Layer ${layers.indexOf(band) + 1}`;
    claimed.add(band.name.toLowerCase());
  }

  const confident = layers.length >= 2 && observed >= 6;
  const verdict = layers.length === 0
    ? "Nothing in this estate connects one kind to another, so there is no stack to read."
    : !confident
      ? `Only ${observed} connection${observed === 1 ? "" : "s"} between kinds — too few to read a stack from. Draw more of the estate first.`
      : `${layers.length} bands, read from ${observed} connections between kinds.`;

  return { layers, unplaced, ambiguous, dropped, observed, confident, verdict };
}

/** Any directed cycle, as the nodes around it, or null. */
function findCycle(above: Map<string, Map<string, number>>, nodes: string[]): string[] | null {
  const state = new Map<string, 0 | 1 | 2>(); // unseen | on the stack | done
  const stack: string[] = [];
  let found: string[] | null = null;

  const walk = (n: string) => {
    if (found) return;
    state.set(n, 1);
    stack.push(n);
    for (const [to] of above.get(n) ?? []) {
      if (found) break;
      if (state.get(to) === 1) { found = stack.slice(stack.indexOf(to)); break; }
      if (!state.get(to)) walk(to);
    }
    stack.pop();
    if (!found) state.set(n, 2);
  };

  for (const n of nodes) if (!state.get(n) && !found) walk(n);
  return found;
}

/**
 * Where a layering somebody declared disagrees with the estate (§5.58).
 *
 * The mirror of the proposal, and the more useful half once a stack exists: a layered model claims
 * that dependencies run downward, and a connection that runs *up* is either a mistake in the
 * drawing or a type in the wrong band. Same rule as conformance (§5.56) — it names the pair and
 * leaves the decision to somebody.
 */
export interface UpwardFlow {
  from: string;
  to: string;
  fromLayer: string;
  toLayer: string;
  count: number;
  detail: string;
}

export function upwardFlows(
  layerOf: Map<string, { name: string; position: number }>,
  edges: ObservedEdge[],
): UpwardFlow[] {
  const sums = new Map<string, number>();
  for (const e of edges) {
    const from = norm(e.from), to = norm(e.to);
    if (from === to) continue;
    const a = layerOf.get(from), b = layerOf.get(to);
    if (!a || !b || a.position <= b.position) continue; // same band or downward: fine
    sums.set(`${e.from}|${e.to}`, (sums.get(`${e.from}|${e.to}`) ?? 0) + e.count);
  }
  return [...sums.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split("|") as [string, string];
      const a = layerOf.get(norm(from))!, b = layerOf.get(norm(to))!;
      return {
        from, to, fromLayer: a.name, toLayer: b.name, count,
        detail: `${count} connection${count === 1 ? "" : "s"} run ${from} → ${to}, which is ${a.name} reaching up into ${b.name}.`,
      };
    })
    .sort((x, y) => y.count - x.count || x.from.localeCompare(y.from));
}
