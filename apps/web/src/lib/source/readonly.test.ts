import { describe, expect, it } from "vitest";
import {
  assertReadQuery,
  assertReadRequest,
  CONTRACTS,
  contractFor,
  operationsIn,
  readWords,
  stripNoise,
  WriteRefused,
} from "./readonly";
import { FALLBACK_PAGE_FOR_AUDIT, INTROSPECT_FOR_AUDIT, pageQuery, relationsQuery } from "@/lib/leanix/client";

describe("the read-only guard (#111)", () => {
  it("lets an ordinary named query with variables through", () => {
    expect(operationsIn(`query Page($first: Int!, $after: String) { allFactSheets(first: $first) { totalCount } }`))
      .toEqual(["query"]);
    expect(() => assertReadQuery(`query Page($first: Int!) { allFactSheets { totalCount } }`)).not.toThrow();
  });

  it("lets the anonymous shorthand through", () => {
    expect(operationsIn(`{ me { id } }`)).toEqual(["query"]);
  });

  it("refuses a mutation — the whole point", () => {
    expect(() => assertReadQuery(`mutation Kill($id: ID!) { deleteFactSheet(id: $id) { id } }`))
      .toThrow(WriteRefused);
    expect(() => assertReadQuery(`mutation { updateFactSheet(id: "x", patches: []) { id } }`))
      .toThrow(/only ever reads/);
  });

  it("refuses a subscription, which holds a socket open against production", () => {
    expect(() => assertReadQuery(`subscription Watch { factSheetChanged { id } }`)).toThrow(WriteRefused);
  });

  it("refuses a mutation smuggled in behind a legitimate query", () => {
    const smuggled = `
      query Page($first: Int!) { allFactSheets(first: $first) { totalCount } }
      mutation Sneak { deleteFactSheet(id: "1") { id } }`;
    expect(operationsIn(smuggled)).toEqual(["query", "mutation"]);
    expect(() => assertReadQuery(smuggled)).toThrow(WriteRefused);
  });

  it("is not fooled by the word mutation inside a string or a comment", () => {
    const innocent = `
      # this used to be a mutation, before we knew better
      query Search { search(term: "mutation") { id } }`;
    expect(operationsIn(innocent)).toEqual(["query"]);
    expect(() => assertReadQuery(innocent)).not.toThrow();
  });

  it("is not fooled by a query keyword hidden inside a block string", () => {
    const block = `mutation Go { annotate(note: """ query Page { id } """) { id } }`;
    expect(operationsIn(block)).toEqual(["mutation"]);
    expect(() => assertReadQuery(block)).toThrow(WriteRefused);
  });

  it("keeps fragments, which are neither reads nor writes on their own", () => {
    const withFragment = `
      fragment Common on BaseFactSheet { id name }
      query Page { allFactSheets { edges { node { ...Common } } } }`;
    expect(operationsIn(withFragment)).toEqual(["fragment", "query"]);
    expect(() => assertReadQuery(withFragment)).not.toThrow();
  });

  it("refuses what it cannot classify rather than forwarding it", () => {
    expect(() => assertReadQuery("")).toThrow(/no operation at all/);
    expect(() => assertReadQuery("nonsense Page { id }")).toThrow(/cannot recognise/);
    // Unbalanced braces are the shape a truncated or hand-built document arrives in.
    expect(() => assertReadQuery("query Page { allFactSheets { id }")).toThrow(WriteRefused);
  });

  it("blanks noise rather than deleting it, so nothing joins into a new word", () => {
    const src = `a"mutation"b`;
    expect(stripNoise(src)).toHaveLength(src.length);
    expect(stripNoise(src)).toBe(`a${" ".repeat('"mutation"'.length)}b`);
  });
});

describe("the guard over HTTP", () => {
  it("lets reads through", () => {
    for (const verb of ["GET", "HEAD", "OPTIONS", "get"]) {
      expect(() => assertReadRequest(verb)).not.toThrow();
    }
  });

  it("refuses every verb that changes something", () => {
    for (const verb of ["PUT", "PATCH", "DELETE"]) {
      expect(() => assertReadRequest(verb)).toThrow(WriteRefused);
    }
  });

  it("makes a POST say which of the two allowed kinds it is", () => {
    expect(() => assertReadRequest("POST")).toThrow(/said neither/);
    expect(() => assertReadRequest("POST", { post: "token-exchange" })).not.toThrow();
    expect(() => assertReadRequest("POST", { post: "graphql-read", query: "query X { id }" })).not.toThrow();
  });

  it("checks the document of a POST that claims to be a GraphQL read", () => {
    expect(() => assertReadRequest("POST", { post: "graphql-read", query: "mutation X { del { id } }" }))
      .toThrow(WriteRefused);
    expect(() => assertReadRequest("POST", { post: "graphql-read" })).toThrow(/carries no document/);
  });
});

describe("every query the LeanIX client can send is a read", () => {
  /*
   * The guard proves the door is locked; this proves nothing inside the house wants out. Both are
   * needed — a guard that is never exercised by the real queries is a guard nobody has tested
   * against the thing it guards.
   */
  const shapes = [
    { name: "Application", fields: ["lifecycle", "businessCriticality"], relations: ["relApplicationToITComponent"] },
    { name: "ITComponent", fields: ["category"], relations: ["relITComponentToApplication"] },
  ];

  it("passes the introspection, page, relation and fallback queries", () => {
    for (const q of [INTROSPECT_FOR_AUDIT, FALLBACK_PAGE_FOR_AUDIT, pageQuery(shapes), relationsQuery(shapes)]) {
      expect(q.trim()).not.toBe("");
      expect(() => assertReadQuery(q)).not.toThrow();
    }
  });
});

describe("the contract, said out loud", () => {
  it("names LeanIX, because that is the one that reaches a production estate", () => {
    expect(contractFor("leanix")?.label).toBe("LeanIX");
    expect(contractFor("leanix")?.enforcement).toMatch(/refused/);
  });

  it("says plainly where Nexus makes no promise on somebody else's behalf", () => {
    expect(contractFor("mcp")?.guaranteed).toBe(false);
    expect(contractFor("leanix")?.guaranteed).toBe(true);
  });

  it("has nothing to say about a connector nobody has declared", () => {
    expect(contractFor("sap")).toBeNull();
    expect(CONTRACTS.every((c) => c.connector && c.label && c.enforcement.length > 40)).toBe(true);
  });

  it("puts a read into words with its age", () => {
    const now = new Date();
    expect(readWords({ objects: 455, relations: 1203, at: now })).toBe("455 objects and 1,203 relations, read just now.");
    expect(readWords({ objects: 1, relations: 0, at: new Date(now.getTime() - 90 * 60_000) }))
      .toBe("1 object, read 2 hours ago.");
  });
});
