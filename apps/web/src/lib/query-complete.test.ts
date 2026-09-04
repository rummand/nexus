import { describe, expect, it } from "vitest";
import type { GraphSnapshot } from "./graph-types";
import { completeQuery } from "./query-complete";

const vocab: GraphSnapshot = {
  entities: [
    { id: "1", kind: "Application", name: "SAP S/4", description: "", attributes: { lifecycle: "active", owner: "Corporate IT" }, source: "", updatedAt: "", boardCount: 0, relationCount: 0, boards: [] },
    { id: "2", kind: "Application", name: "CRM Cloud", description: "", attributes: { lifecycle: "end of life" }, source: "", updatedAt: "", boardCount: 0, relationCount: 0, boards: [] },
    { id: "3", kind: "Interface", name: "Customer API", description: "", attributes: {}, source: "", updatedAt: "", boardCount: 0, relationCount: 0, boards: [] },
  ],
  kinds: [
    { kind: "Application", count: 2, color: "#000", attributeKeys: [{ key: "lifecycle", count: 2, sample: "active" }, { key: "owner", count: 1, sample: "Corporate IT" }] },
    { kind: "Interface", count: 1, color: "#000", attributeKeys: [] },
  ],
  relationKinds: [{ kind: "uses", count: 3 }, { kind: "depends on", count: 1 }],
};

describe("completeQuery", () => {
  it("suggests clauses and attribute keys for a bare word", () => {
    expect(completeQuery("li", vocab).map((c) => c.label)).toEqual(["lifecycle:"]);
    expect(completeQuery("", vocab).map((c) => c.label).slice(0, 3)).toEqual(["kind:", "related:", "from:"]);
  });
  it("completes kinds, relation types, names and attribute values, quoting spaces", () => {
    expect(completeQuery("kind:Ap", vocab)[0]).toEqual({ label: "kind:Application", query: "kind:Application " });
    expect(completeQuery("kind:Application rel:dep", vocab)[0]?.query).toBe('kind:Application rel:"depends on" ');
    expect(completeQuery("related:cust", vocab)[0]?.label).toBe('related:"Customer API"');
    expect(completeQuery("lifecycle:", vocab).map((c) => c.label)).toEqual(["lifecycle:active", 'lifecycle:"end of life"']);
    expect(completeQuery("missing:ow", vocab)[0]?.label).toBe("missing:owner");
  });
  it("returns nothing for an unknown key without vocabulary", () => {
    expect(completeQuery("kind:Ap", null)).toEqual([]);
  });
});
