import { describe, expect, it } from "vitest";
import { buildAdjacency } from "./graph-algo";
import {
  allShortestPaths, connectionsOf, groupConnections, isolated, packComponents, placeLabels,
  radialLayout, reachable, ringLabelAngle, walkTo, type DirectedEdge,
} from "./explorer-views";

const edge = (id: string, from: string, to: string, kind = "uses"): DirectedEdge => ({ id, from, to, kind });
const adjOf = (edges: DirectedEdge[]) => buildAdjacency(edges.map((e) => ({ id: e.id, from: e.from, to: e.to })));

describe("what is attached to one thing", () => {
  const edges = [
    edge("e1", "crm", "db", "reads"),
    edge("e2", "portal", "crm", "calls"),
    edge("e3", "billing", "crm", "calls"),
    edge("e4", "crm", "crm", "calls"),
  ];

  it("keeps the direction, because it is the whole question", () => {
    // "What depends on the CRM" and "what the CRM depends on" are different answers, and the
    // old explorer gave the same one to both.
    const list = connectionsOf(edges, "crm");
    expect(list.filter((c) => c.direction === "out").map((c) => c.other)).toEqual(["db"]);
    expect(list.filter((c) => c.direction === "in").map((c) => c.other)).toEqual(["portal", "billing"]);
  });

  it("drops a relation from a thing to itself rather than showing it twice", () => {
    expect(connectionsOf(edges, "crm").some((c) => c.other === "crm")).toBe(false);
  });

  it("groups by relationship type, heaviest group first", () => {
    const groups = groupConnections(connectionsOf(edges, "crm"));
    expect(groups.map((g) => [g.kind, g.total])).toEqual([["calls", 2], ["reads", 1]]);
    expect(groups[0]!.in.map((c) => c.other)).toEqual(["portal", "billing"]);
    expect(groups[0]!.out).toEqual([]);
  });
});

describe("the neighbourhood, laid out", () => {
  it("puts the subject at the centre and each hop on its own ring", () => {
    const adj = adjOf([edge("e1", "a", "b"), edge("e2", "b", "c"), edge("e3", "c", "d")]);
    const placed = radialLayout(adj, "a", 2);
    expect(placed.map((p) => [p.id, p.ring])).toEqual([["a", 0], ["b", 1], ["c", 2]]);
    expect(placed[0]).toMatchObject({ x: 0, y: 0 });
    // "d" is three hops out and the caller asked for two: distance is the filter.
    expect(placed.some((p) => p.id === "d")).toBe(false);
  });

  it("never places two nodes on top of each other, however crowded the ring", () => {
    // A force layout at this density produces a solid disc. A ring grows instead.
    const edges = Array.from({ length: 60 }, (_, i) => edge(`e${i}`, "hub", `n${i}`));
    const placed = radialLayout(adjOf(edges), "hub", 1, { minArc: 100 });
    const ring = placed.filter((p) => p.ring === 1);
    expect(ring).toHaveLength(60);
    let closest = Infinity;
    for (let i = 0; i < ring.length; i++) {
      for (let j = i + 1; j < ring.length; j++) {
        closest = Math.min(closest, Math.hypot(ring[i]!.x - ring[j]!.x, ring[i]!.y - ring[j]!.y));
      }
    }
    expect(closest).toBeGreaterThan(60);
  });

  it("is deterministic, so the same subject always draws the same picture", () => {
    const adj = adjOf([edge("e1", "a", "b"), edge("e2", "a", "c"), edge("e3", "b", "d")]);
    expect(radialLayout(adj, "a", 2)).toEqual(radialLayout(adj, "a", 2));
  });

  it("seats a node next to the neighbour it was reached through, so edges stop crossing", () => {
    /*
     * Two hubs on ring 1, three children each on ring 2. Ordering ring 2 by the parent's angle
     * keeps each family together; without it they interleave and every edge crosses another.
     */
    const edges = [
      edge("h1", "root", "left"), edge("h2", "root", "right"),
      edge("l1", "left", "la"), edge("l2", "left", "lb"), edge("l3", "left", "lc"),
      edge("r1", "right", "ra"), edge("r2", "right", "rb"), edge("r3", "right", "rc"),
    ];
    const ring2 = radialLayout(adjOf(edges), "root", 2).filter((p) => p.ring === 2).map((p) => p.id);
    const lefts = ring2.map((id, i) => (id.startsWith("l") ? i : -1)).filter((i) => i >= 0);
    expect(Math.max(...lefts) - Math.min(...lefts)).toBe(lefts.length - 1); // contiguous
  });

  it("caps a crowded ring by importance rather than by traversal order", () => {
    const edges = Array.from({ length: 10 }, (_, i) => edge(`e${i}`, "hub", `n${i}`));
    const rank = (id: string) => (id === "n7" ? -100 : 0); // n7 matters most
    const ring = radialLayout(adjOf(edges), "hub", 1, { maxPerRing: 3, rank })
      .filter((p) => p.ring === 1).map((p) => p.id);
    expect(ring).toHaveLength(3);
    expect(ring).toContain("n7");
  });

  it("never re-places a capped node further out than it really is", () => {
    /*
     * A node dropped from ring 1 is still one hop away. Letting the traversal find it again on
     * ring 2 would draw a lie, in a layout whose entire claim is that radius means hops.
     */
    const edges = [
      edge("e1", "hub", "a"), edge("e2", "hub", "b"),
      edge("e3", "a", "b"), // b is reachable via a as well
    ];
    const placed = radialLayout(adjOf(edges), "hub", 3, { maxPerRing: 1, rank: (id) => (id === "a" ? -1 : 0) });
    expect(placed.map((p) => p.id)).toEqual(["hub", "a"]);
  });

  it("stops early rather than drawing empty rings when the neighbourhood runs out", () => {
    const placed = radialLayout(adjOf([edge("e1", "a", "b")]), "a", 5);
    expect(placed.map((p) => p.ring)).toEqual([0, 1]);
  });
});

describe("the ring caption", () => {
  it("goes in the widest gap, not on top of a node", () => {
    // Four nodes sit at 0°, 90°, 180°, 270°, so "the top" is occupied. Every gap is equal here,
    // and the answer must still be a midpoint between two of them rather than one of them.
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    const a = ringLabelAngle(angles);
    for (const node of angles) expect(Math.abs(a - node)).toBeGreaterThan(0.3);
  });

  it("finds the one real gap when the ring is lopsided", () => {
    const a = ringLabelAngle([0, 0.2, 0.4]);
    expect(a).toBeGreaterThan(0.4);
  });

  it("has an answer for an empty ring", () => {
    expect(ringLabelAngle([])).toBeCloseTo(-Math.PI / 2);
  });
});

describe("packing what the physics flings apart", () => {
  it("gathers separate clusters instead of leaving an ocean between them", () => {
    /*
     * A force simulation has no attraction between components, so two clusters that share no
     * edge repel each other forever and "fit" then frames mostly empty space.
     */
    const positions = [
      { id: "a", x: 0, y: 0 }, { id: "b", x: 50, y: 0 },
      { id: "y", x: 9000, y: 9000 }, { id: "z", x: 9050, y: 9000 },
    ];
    const offsets = packComponents(positions, [["a", "b"], ["y", "z"]], 100);
    const moved = positions.map((p) => {
      const o = offsets.get(p.id) ?? { dx: 0, dy: 0 };
      return { id: p.id, x: p.x + o.dx, y: p.y + o.dy };
    });
    const spanX = Math.max(...moved.map((p) => p.x)) - Math.min(...moved.map((p) => p.x));
    expect(spanX).toBeLessThan(400);
  });

  it("moves whole clusters only, so the shape the simulation found survives", () => {
    const positions = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 50, y: 30 }, { id: "z", x: 5000, y: 0 }];
    const offsets = packComponents(positions, [["a", "b"], ["z"]]);
    const a = offsets.get("a")!, b = offsets.get("b")!;
    expect(a).toEqual(b);
  });

  it("does nothing when the graph is one piece", () => {
    expect(packComponents([{ id: "a", x: 0, y: 0 }], [["a"]]).size).toBe(0);
  });
});

describe("blast radius", () => {
  const edges = [edge("e1", "db", "crm"), edge("e2", "crm", "portal"), edge("e3", "crm", "billing")];

  it("follows the arrows downstream and counts the hops", () => {
    expect([...reachable(edges, ["db"], "out")]).toEqual([["crm", 1], ["portal", 2], ["billing", 2]]);
  });

  it("answers the opposite question upstream, and gets a different answer", () => {
    // The distinction the old undirected explorer erased.
    expect([...reachable(edges, ["portal"], "out")]).toEqual([]);
    expect([...reachable(edges, ["portal"], "in").keys()]).toEqual(["crm", "db"]);
  });

  it("leaves the root out of its own impact", () => {
    expect(reachable(edges, ["db"], "both").has("db")).toBe(false);
  });

  it("honours a hop limit", () => {
    expect([...reachable(edges, ["db"], "out", 1).keys()]).toEqual(["crm"]);
  });

  it("terminates on a cycle", () => {
    const loop = [edge("e1", "a", "b"), edge("e2", "b", "c"), edge("e3", "c", "a")];
    expect([...reachable(loop, ["a"], "out").keys()].sort()).toEqual(["b", "c"]);
  });
});

describe("what is connected to nothing", () => {
  it("lists the entities no relation touches", () => {
    const edges = [edge("e1", "a", "b")];
    expect(isolated(["a", "b", "c", "d"], edges)).toEqual(["c", "d"]);
  });

  it("does not let a self-relation rescue an entity from the list", () => {
    // "Depends on itself" is a modelling accident, not a connection to the estate.
    expect(isolated(["a"], [edge("e1", "a", "a")])).toEqual(["a"]);
  });
});

describe("every shortest route, not just one", () => {
  it("finds all the equally short ways through, which is a different finding from one way", () => {
    /*
     * Two parallel routes of the same length. Reporting one implies it is *the* route, and
     * somebody retires the other in the belief that nothing runs over it.
     */
    const adj = adjOf([
      edge("e1", "a", "m1"), edge("e2", "m1", "b"),
      edge("e3", "a", "m2"), edge("e4", "m2", "b"),
    ]);
    const paths = allShortestPaths(adj, "a", "b");
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.nodes[1]).sort()).toEqual(["m1", "m2"]);
    for (const p of paths) expect(p.edges).toHaveLength(2);
  });

  it("returns the shortest ones only, never a longer detour", () => {
    const adj = adjOf([
      edge("e1", "a", "b"),
      edge("e2", "a", "c"), edge("e3", "c", "d"), edge("e4", "d", "b"),
    ]);
    const paths = allShortestPaths(adj, "a", "b");
    expect(paths).toHaveLength(1);
    expect(paths[0]!.nodes).toEqual(["a", "b"]);
  });

  it("says nothing rather than guessing when the two are in different components", () => {
    expect(allShortestPaths(adjOf([edge("e1", "a", "b")]), "a", "z")).toEqual([]);
  });

  it("caps the enumeration, because a dense graph has combinatorially many", () => {
    const edges = Array.from({ length: 20 }, (_, i) => [
      edge(`x${i}`, "a", `m${i}`), edge(`y${i}`, `m${i}`, "b"),
    ]).flat();
    expect(allShortestPaths(adjOf(edges), "a", "b", 3)).toHaveLength(3);
  });
});

describe("labels that do not collide", () => {
  it("drops the loser of an overlap instead of printing both on top of each other", () => {
    // Overprinting produced "CustomerCRMCloud" — text that reads as a name of something that
    // does not exist. A missing label is honest; that is not.
    const kept = placeLabels([
      { id: "big", x: 0, y: 0, w: 80, h: 14, priority: 9 },
      { id: "small", x: 10, y: 4, w: 80, h: 14, priority: 1 },
    ]);
    expect([...kept]).toEqual(["big"]);
  });

  it("keeps both when they clear each other", () => {
    const kept = placeLabels([
      { id: "a", x: 0, y: 0, w: 40, h: 14, priority: 1 },
      { id: "b", x: 200, y: 0, w: 40, h: 14, priority: 1 },
    ]);
    expect(kept.size).toBe(2);
  });

  it("lets the more important label win regardless of the order it was offered in", () => {
    const low = { id: "low", x: 0, y: 0, w: 80, h: 14, priority: 1 };
    const high = { id: "high", x: 5, y: 0, w: 80, h: 14, priority: 5 };
    expect([...placeLabels([low, high])]).toEqual(["high"]);
    expect([...placeLabels([high, low])]).toEqual(["high"]);
  });
});

describe("where you have been", () => {
  it("records each new step", () => {
    expect(walkTo(walkTo([], "a"), "b")).toEqual(["a", "b"]);
  });

  it("truncates rather than appending when you go back to somewhere you have been", () => {
    // Otherwise stepping back two and branching leaves a trail describing a journey nobody took.
    expect(walkTo(["a", "b", "c", "d"], "b")).toEqual(["a", "b"]);
  });

  it("forgets the oldest steps once the trail would be clutter itself", () => {
    const long = Array.from({ length: 8 }, (_, i) => `n${i}`);
    const next = walkTo(long, "new");
    expect(next).toHaveLength(8);
    expect(next[0]).toBe("n1");
    expect(next.at(-1)).toBe("new");
  });
});
