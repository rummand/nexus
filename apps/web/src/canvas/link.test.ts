import { describe, expect, it } from "vitest";
import { findLinkCandidate } from "./link";

const entities = [
  { id: "ent_1", name: "CRM Cloud", kind: "Application" },
  { id: "ent_2", name: "CRM Cloud", kind: "Interface" },
  { id: "ent_3", name: "Billing", kind: "Business Capability" },
];

describe("findLinkCandidate", () => {
  it("matches names case- and whitespace-insensitively, preferring the same kind", () => {
    expect(findLinkCandidate("crm  cloud", "ent_new", "Interface", entities)?.id).toBe("ent_2");
    expect(findLinkCandidate("CRM Cloud", "ent_new", "Server", entities)?.id).toBe("ent_1");
  });
  it("never offers the card's own entity and ignores empty or unknown titles", () => {
    expect(findLinkCandidate("Billing", "ent_3", "Business Capability", entities)).toBeNull();
    expect(findLinkCandidate("", "x", "", entities)).toBeNull();
    expect(findLinkCandidate("Nothing here", "x", "", entities)).toBeNull();
  });
});
