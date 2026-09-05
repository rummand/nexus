import { describe, expect, it } from "vitest";
import { scanForSources, type DiscoveryInput } from "./discovery";
import { expandScopes, flattenScopes, isGranted, toggleScope } from "./types";
import { PROVIDERS, providerById } from "./providers";
import { extractHosts, rootDomain } from "./signals";

const input = (over: Partial<DiscoveryInput> = {}): DiscoveryInput => ({
  entities: [],
  texts: [],
  ...over,
});

const texts = [
  {
    id: "src1", name: "Metering sync", channel: "intake" as const,
    text: "Pull the equipment list out of SAP PM before the migration — EQUI and IFLOT. The tickets are in https://energinet.service-now.com/nav_to.do and the tags come from opc.tcp://pi-prd.energinet.dk:4840.",
  },
  {
    id: "b1", name: "Landscape board", channel: "board" as const,
    text: "Kamstrup head-end at kamstrup-hes.energinet.dk feeds settlement. Docs on internal-wiki.energinet.dk.",
  },
];

describe("the estate scan", () => {
  it("recognises a system from a fingerprint, not only from its name", () => {
    // no text anywhere says "ServiceNow" — only the instance host and a table name do
    const report = scanForSources(input({
      texts: [{ id: "t", name: "Ops note", channel: "intake", text: "CI data lives in cmdb_ci on https://acme.service-now.com" }],
    }));
    const snow = report.discoveries.find((d) => d.providerId === "servicenow")!;
    expect(snow).toBeDefined();
    expect(snow.confidence).toBe("high");
    expect(snow.signals.some((sig) => sig.kind === "hostname")).toBe(true);
    expect(snow.signals[0]!.match).toBeTruthy();
    expect(snow.reason).toContain("strongest");
  });

  it("reads every channel and says how much of each it read", () => {
    const report = scanForSources(input({
      entities: [{ id: "e1", name: "SAP S/4", kind: "Application", attributes: { vendor: "SAP" } }],
      texts,
      typeNames: ["Application"],
    }));
    const by = Object.fromEntries(report.channels.map((c) => [c.channel, c]));
    expect(by.graph!.scanned).toBe(1);
    expect(by.attributes!.scanned).toBe(1);
    expect(by.intake!.scanned).toBe(1);
    expect(by.board!.scanned).toBe(1);
    expect(by.model!.scanned).toBe(1);
    expect(report.scannedRecords).toBe(5);
    expect(report.totalSignals).toBeGreaterThan(3);
  });

  it("finds the systems nobody's catalogue knows, grouped by domain", () => {
    const report = scanForSources(input({ texts }));
    const domains = report.unknown.map((u) => u.domain);
    expect(domains).toContain("energinet.dk");
    const energinet = report.unknown.find((u) => u.domain === "energinet.dk")!;
    expect(energinet.hosts).toContain("kamstrup-hes.energinet.dk");
    // the historian endpoint resolves to its machine, not to a scheme or a port
    expect(energinet.hosts).toContain("pi-prd.energinet.dk");
    expect(domains).not.toContain("opc.tcp");
    expect(domains.some((d) => d.includes(":"))).toBe(false);
    expect(energinet.sightings[0]!.context.length).toBeGreaterThan(0);
    // a host a provider claimed is not offered as unknown
    expect(domains).not.toContain("service-now.com");
  });

  it("recognises a workspace-registered source on the next scan", () => {
    const registered = {
      ...providerById("servicenow")!,
      id: "custom:1", name: "Kamstrup HES", signals: ["kamstrup-hes.energinet.dk"],
      fingerprints: [{ kind: "hostname" as const, pattern: "\\bkamstrup-hes\\.energinet\\.dk\\b", weight: 4, note: "a host registered for this source" }],
      scopes: [],
    };
    const report = scanForSources(input({ texts, extraProviders: [registered] }));
    expect(report.discoveries.some((d) => d.providerId === "custom:1")).toBe(true);
  });

  it("flags model that nothing explains", () => {
    const report = scanForSources(input({
      entities: [
        { id: "a", name: "Billing", kind: "Application", sourced: false },
        { id: "b", name: "Metering", kind: "Application", sourced: true },
        { id: "c", name: "Jes", kind: "Person", sourced: false },
      ],
    }));
    expect(report.unsourced.map((u) => u.name)).toEqual(["Billing"]); // a Person is not a system
  });

  it("does not raise a settled question, or a single passing mention", () => {
    expect(scanForSources(input({ texts, decided: ["sap"] })).discoveries.some((d) => d.providerId === "sap")).toBe(false);
    // one bare product name scores 1 and stays below the floor
    const weak = scanForSources(input({ texts: [{ id: "t", name: "n", channel: "intake", text: "someone mentioned jira once" }] }));
    expect(weak.discoveries).toEqual([]);
  });

  it("folds identical signals together instead of listing them again", () => {
    const report = scanForSources(input({
      entities: [
        { id: "1", name: "SCADA / EMS", kind: "Application" },
        { id: "2", name: "SCADA / EMS", kind: "Application" },
        { id: "3", name: "SCADA / EMS", kind: "Application" },
      ],
      texts: [{ id: "t", name: "note", channel: "intake", text: "the network model and CGMES export come from SCADA" }],
    }));
    const scada = report.discoveries.find((d) => d.providerId === "scada-ems")!;
    const scadaName = scada.signals.filter((sig) => sig.match.toLowerCase() === "scada");
    expect(scadaName).toHaveLength(1);
    expect(scadaName[0]!.occurrences).toBeGreaterThan(1);
  });

  it("asks for named scopes it can justify, not for the whole system", () => {
    const [first] = scanForSources(input({ texts })).discoveries;
    expect(first!.wants.length).toBeGreaterThan(0);
    expect(first!.wants.length).toBeLessThanOrEqual(3);
    const provider = providerById(first!.providerId)!;
    const paths = new Set(flattenScopes(provider.scopes).map((sc) => sc.path));
    for (const w of first!.wants) expect(paths.has(w)).toBe(true);
    expect(flattenScopes(provider.scopes).find((sc) => sc.path === first!.wants[0])!.sensitivity).not.toBe("personal");
  });
});

describe("host extraction", () => {
  it("finds hosts and endpoints, and ignores what is not one", () => {
    const found = extractHosts("see https://acme.service-now.com/x and opc.tcp://pi.acme.dk:4840, version 1.2.3, e.g. nothing, package.json, diagram.drawio");
    expect(found).toContain("acme.service-now.com");
    // an endpoint is normalised to the machine, not kept as a scheme
    expect(found).toContain("pi.acme.dk");
    expect(found).not.toContain("opc.tcp");
    // filenames are not hosts
    expect(found).not.toContain("package.json");
    expect(found).not.toContain("diagram.drawio");
    expect(found).not.toContain("1.2.3");
    expect(found.some((h) => h === "e.g")).toBe(false);
  });

  it("groups hosts by their registrable domain", () => {
    expect(rootDomain("kamstrup-hes.energinet.dk")).toBe("energinet.dk");
    expect(rootDomain("https://acme.service-now.com/nav")).toBe("service-now.com");
    expect(rootDomain("pi-prd.energinet.dk:4840")).toBe("energinet.dk");
    expect(rootDomain("wiki.acme.co.uk")).toBe("acme.co.uk");
  });
});

describe("scope grants", () => {
  it("covers children of a granted parent, and can be granted a leaf on its own", () => {
    const granted = new Set(["sap/pm"]);
    expect(isGranted(granted, "sap/pm/equi")).toBe(true);
    expect(isGranted(granted, "sap/mm")).toBe(false);
    expect(isGranted(new Set(["sap/mm/lfa1"]), "sap/mm")).toBe(false);
  });

  it("takes the objects with the module, and drops the module when one is taken back", () => {
    const sap = providerById("sap")!;
    let picked = toggleScope(sap.scopes, new Set(), "sap/pm", true);
    expect([...picked].sort()).toEqual(["sap/pm", "sap/pm/aufk", "sap/pm/equi", "sap/pm/iflot"]);
    picked = toggleScope(sap.scopes, picked, "sap/pm/equi", false);
    expect(picked.has("sap/pm")).toBe(false);
    expect(picked.has("sap/pm/iflot")).toBe(true);
    picked = toggleScope(sap.scopes, picked, "sap/pm", false);
    expect([...picked]).toEqual([]);
  });

  it("materialises a stored parent grant so the tree shows what it really covers", () => {
    const sap = providerById("sap")!;
    expect([...expandScopes(sap.scopes, ["sap/mm"])].sort()).toEqual(["sap/mm", "sap/mm/lfa1", "sap/mm/mara"]);
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
