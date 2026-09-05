import { describe, expect, it } from "vitest";
import { buildAdjacency, components, shortestPath, withinHops } from "./graph-algo";

//  a — b — c — d        x — y      z (isolated)
//      \_______/  (b—d shortcut)
const links = [
  { id: "ab", from: "a", to: "b" },
  { id: "bc", from: "b", to: "c" },
  { id: "cd", from: "c", to: "d" },
  { id: "bd", from: "b", to: "d" },
  { id: "xy", from: "x", to: "y" },
];
const adj = buildAdjacency(links);

describe("shortestPath", () => {
  it("finds the fewest-hops route and the edges along it", () => {
    const p = shortestPath(adj, "a", "d");
    expect(p?.nodes).toEqual(["a", "b", "d"]); // via the shortcut, not a-b-c-d
    expect(p?.edges).toEqual(["ab", "bd"]);
    expect(p!.edges.length).toBe(p!.nodes.length - 1);
  });
  it("ignores relation direction", () => {
    expect(shortestPath(adj, "d", "a")?.nodes).toEqual(["d", "b", "a"]);
  });
  it("handles the trivial and impossible cases", () => {
    expect(shortestPath(adj, "a", "a")).toEqual({ nodes: ["a"], edges: [] });
    expect(shortestPath(adj, "a", "x")).toBeNull();
    expect(shortestPath(adj, "a", "nope")).toBeNull();
  });
});

describe("withinHops", () => {
  it("returns hop distance per node up to the depth", () => {
    expect([...withinHops(adj, ["a"], 1).entries()].sort()).toEqual([["a", 0], ["b", 1]]);
    const two = withinHops(adj, ["a"], 2);
    expect(two.get("c")).toBe(2);
    expect(two.get("d")).toBe(2);
    expect(two.has("x")).toBe(false);
  });
  it("takes the shortest distance when several roots are given", () => {
    expect(withinHops(adj, ["a", "d"], 1).get("d")).toBe(0);
  });
});

describe("components", () => {
  it("groups connected nodes, largest first, including isolated ones", () => {
    const groups = components(adj, ["a", "b", "c", "d", "x", "y", "z"]);
    expect(groups.map((g) => g.length)).toEqual([4, 2, 1]);
    expect(groups[0]!.sort()).toEqual(["a", "b", "c", "d"]);
    expect(groups[2]).toEqual(["z"]);
  });
});

describe("buildAdjacency", () => {
  it("drops self-links, which would otherwise loop the walk", () => {
    const a = buildAdjacency([{ id: "self", from: "a", to: "a" }]);
    expect(a.neighbours.get("a")).toBeUndefined();
  });
});
