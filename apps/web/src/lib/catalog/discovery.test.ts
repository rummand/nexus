import { describe, expect, it } from "vitest";
import { discoverProviders } from "./discovery";
import { expandScopes, flattenScopes, isGranted, toggleScope } from "./types";
import { PROVIDERS, providerById } from "./providers";

const sources = [
  { id: "src1", name: "Metering sync", text: "We should pull the equipment list out of SAP PM before the migration." },
  { id: "src2", name: "Ops review", text: "ServiceNow has the CI relationships already, and SAP is the master for assets." },
];

describe("the discovery agent", () => {
  it("proposes a system it can show evidence for, and never one it cannot", () => {
    const found = discoverProviders({ entities: [{ id: "ent_sap", name: "SAP", kind: "Application" }], sources });
    const sap = found.find((d) => d.providerId === "sap")!;
    expect(sap).toBeDefined();
    expect(sap.confidence).toBe("high"); // in the graph and in two sources
    expect(sap.evidence.some((e) => e.origin === "graph")).toBe(true);
    expect(sap.evidence.some((e) => e.origin === "intake")).toBe(true);
    // every proposal quotes something
    for (const d of found) expect(d.evidence.length).toBeGreaterThan(0);
    // nothing was proposed without a signal in the input
    expect(found.some((d) => d.providerId === "databricks")).toBe(false);
  });

  it("asks for named scopes it can justify, not for the whole system", () => {
    const [first] = discoverProviders({ entities: [], sources });
    expect(first!.wants.length).toBeGreaterThan(0);
    expect(first!.wants.length).toBeLessThanOrEqual(3);
    const provider = providerById(first!.providerId)!;
    const paths = new Set(flattenScopes(provider.scopes).map((s) => s.path));
    for (const w of first!.wants) expect(paths.has(w)).toBe(true);
    // it does not open with the most sensitive thing it could ask for
    const sensitivities = first!.wants.map((w) => flattenScopes(provider.scopes).find((s) => s.path === w)!.sensitivity);
    expect(sensitivities[0]).not.toBe("personal");
  });

  it("does not re-propose a settled question", () => {
    const found = discoverProviders({ entities: [], sources, decided: ["sap"] });
    expect(found.some((d) => d.providerId === "sap")).toBe(false);
  });

  it("matches whole words only", () => {
    const found = discoverProviders({ entities: [], sources: [{ id: "s", name: "n", text: "we need this asap, and the snowmobile broke" }] });
    expect(found).toEqual([]);
  });
});

describe("scope grants", () => {
  it("covers children of a granted parent, and can be granted a leaf on its own", () => {
    const granted = new Set(["sap/pm"]);
    expect(isGranted(granted, "sap/pm")).toBe(true);
    expect(isGranted(granted, "sap/pm/equi")).toBe(true);
    expect(isGranted(granted, "sap/mm")).toBe(false);
    expect(isGranted(new Set(["sap/mm/lfa1"]), "sap/mm/lfa1")).toBe(true);
    expect(isGranted(new Set(["sap/mm/lfa1"]), "sap/mm")).toBe(false);
  });

  it("takes the objects with the module, and drops the module when one is taken back", () => {
    const sap = providerById("sap")!;
    let picked = toggleScope(sap.scopes, new Set(), "sap/pm", true);
    expect([...picked].sort()).toEqual(["sap/pm", "sap/pm/aufk", "sap/pm/equi", "sap/pm/iflot"]);

    // taking one object back means the module is no longer granted, but its siblings still are
    picked = toggleScope(sap.scopes, picked, "sap/pm/equi", false);
    expect(picked.has("sap/pm")).toBe(false);
    expect(picked.has("sap/pm/equi")).toBe(false);
    expect(picked.has("sap/pm/iflot")).toBe(true);

    // and unticking the module clears whatever is left of it
    picked = toggleScope(sap.scopes, picked, "sap/pm", false);
    expect([...picked]).toEqual([]);
  });

  it("materialises a stored parent grant so the tree shows what it really covers", () => {
    const sap = providerById("sap")!;
    expect([...expandScopes(sap.scopes, ["sap/mm"])].sort()).toEqual(["sap/mm", "sap/mm/lfa1", "sap/mm/mara"]);
    expect([...expandScopes(sap.scopes, ["sap/landscape"])]).toEqual(["sap/landscape"]);
  });

  it("gives every grantable scope a purpose and a sensitivity", () => {
    for (const p of PROVIDERS) {
      for (const scope of flattenScopes(p.scopes)) {
        expect(scope.description.length, `${scope.path} needs a description`).toBeGreaterThan(10);
        expect(scope.yields.length, `${scope.path} must say what it yields`).toBeGreaterThan(0);
        expect(scope.sensitivity).toBeTruthy();
      }
    }
  });
});
