import { describe, expect, it } from "vitest";
import { parsePassages } from "./transcript";
import { validateExtraction } from "./validate-extraction";
import type { Vocabulary } from "./extract";

const vocab: Vocabulary = {
  entities: [],
  kinds: ["Application", "Business Capability", "Person"],
  relationKinds: ["depends on", "supports"],
};

const TEXT = `Jesper Solberg   0:04
Maximo depends on SCADA for the outage data, and the billing capability sits on top of both.

Mette Lund   0:40
My concern is that Maximo is out of support from next year.
`;
const passages = parsePassages(TEXT);
const validate = (raw: unknown) => validateExtraction(raw, passages, vocab);

describe("what a model may claim about a source", () => {
  it("accepts a claim it can quote, and attributes it to whoever actually spoke", () => {
    const result = validate({
      objects: [
        { name: "Maximo", kind: "Application", why: "named as a system", confidence: "high",
          quotes: [{ passage: "p1", text: "Maximo depends on SCADA for the outage data" }] },
        { name: "SCADA", kind: "Application", quotes: [{ passage: "p1", text: "depends on SCADA for the outage data" }] },
      ],
      connections: [
        { from: "Maximo", to: "SCADA", kind: "depends on", quotes: [{ passage: "p1", text: "Maximo depends on SCADA" }] },
      ],
      viewpoints: [
        // the model names the wrong speaker; the passage decides
        { type: "risk", speaker: "Somebody Else", passage: "p2", text: "My concern is that Maximo is out of support from next year", about: ["Maximo"] },
      ],
    });
    expect(result.candidates.map((c) => c.name)).toEqual(["Maximo", "SCADA"]);
    expect(result.candidates[0]!.mentions[0]!.speaker).toBe("Jesper Solberg");
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]!.from).toBe("application|maximo");
    expect(result.viewpoints[0]!.speaker).toBe("Mette Lund");
    expect(result.viewpoints[0]!.about).toContain("application|maximo");
    expect(result.rejected).toEqual([]);
  });

  it("drops a claim whose quote is not in the source, and says so", () => {
    const result = validate({
      objects: [
        { name: "Salesforce", kind: "Application", quotes: [{ passage: "p1", text: "we are replacing everything with Salesforce" }] },
        { name: "Maximo", kind: "Application", quotes: [{ passage: "p1", text: "Maximo depends on SCADA" }] },
      ],
    });
    expect(result.candidates.map((c) => c.name)).toEqual(["Maximo"]);
    expect(result.rejected.join(" ")).toContain("Salesforce");
    expect(result.rejected.join(" ")).toContain("not in p1");
  });

  it("drops a claim citing a passage that does not exist, and one with no evidence at all", () => {
    const result = validate({
      objects: [
        { name: "Ghost", kind: "Application", quotes: [{ passage: "p99", text: "something plausible about a ghost" }] },
        { name: "Unsupported", kind: "Application", quotes: [] },
      ],
    });
    expect(result.candidates).toEqual([]);
    expect(result.rejected.join(" ")).toContain("does not exist");
    expect(result.rejected.join(" ")).toContain("nothing in the source says so");
  });

  it("allows an elided quote, but not one too short to mean anything", () => {
    const ok = validate({ objects: [{ name: "Maximo", quotes: [{ passage: "p1", text: "Maximo depends on SCADA … billing capability sits on top" }] }] });
    expect(ok.candidates).toHaveLength(1);
    const tooShort = validate({ objects: [{ name: "X", quotes: [{ passage: "p1", text: "the" }] }] });
    expect(tooShort.candidates).toEqual([]);
  });

  it("refuses a connection between things it did not propose", () => {
    const result = validate({
      objects: [{ name: "Maximo", quotes: [{ passage: "p1", text: "Maximo depends on SCADA" }] }],
      connections: [{ from: "Maximo", to: "Never Mentioned", kind: "depends on", quotes: [{ passage: "p1", text: "Maximo depends on SCADA" }] }],
    });
    expect(result.relations).toEqual([]);
    expect(result.rejected.join(" ")).toContain("did not propose");
  });

  it("snaps kinds and relation types onto the workspace's own vocabulary", () => {
    const result = validate({
      objects: [{ name: "Billing", kind: "business capability", quotes: [{ passage: "p1", text: "the billing capability sits on top of both" }] },
                { name: "Maximo", kind: "application", quotes: [{ passage: "p1", text: "Maximo depends on SCADA" }] }],
      connections: [{ from: "Maximo", to: "Billing", kind: "SUPPORTS", quotes: [{ passage: "p1", text: "billing capability sits on top of both" }] }],
    });
    expect(result.candidates.map((c) => c.kind)).toEqual(["Business Capability", "Application"]);
    expect(result.relations[0]!.kind).toBe("supports");
  });

  it("refuses a viewpoint of an invented type", () => {
    const result = validate({
      objects: [],
      viewpoints: [{ type: "prophecy", passage: "p2", text: "My concern is that Maximo is out of support" }],
    });
    expect(result.viewpoints).toEqual([]);
    expect(result.rejected.join(" ")).toContain("type that does not exist");
  });

  it("survives rubbish without throwing", () => {
    expect(validate(null).rejected.length).toBeGreaterThan(0);
    expect(validate({ objects: "not a list" }).candidates).toEqual([]);
    expect(validate({ objects: [null, 3, "x"] }).candidates).toEqual([]);
  });
});
