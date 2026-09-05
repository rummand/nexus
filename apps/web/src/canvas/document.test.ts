import { describe, expect, it } from "vitest";
import { emptyDocument, parseDocument, serializeDocument } from "./document";

describe("the script a board was written from", () => {
  it("survives a round trip through the document", () => {
    const doc = { ...emptyDocument(), script: "add all applications\nconnect them" };
    const back = parseDocument(serializeDocument(doc));
    expect(back.script).toBe("add all applications\nconnect them");
  });

  it("is dropped when it is empty, so a board that was drawn does not grow a field", () => {
    expect(parseDocument(JSON.stringify({ version: 2, elements: {}, script: "   " })).script).toBeUndefined();
    expect("script" in parseDocument(serializeDocument(emptyDocument()))).toBe(false);
  });

  it("ignores a script that is not text, and caps a huge one", () => {
    expect(parseDocument(JSON.stringify({ version: 2, elements: {}, script: { evil: true } })).script).toBeUndefined();
    expect(parseDocument(JSON.stringify({ version: 2, elements: {}, script: "x".repeat(20000) })).script).toHaveLength(8000);
  });

  it("keeps viewpoints and the script side by side", () => {
    const doc = {
      ...emptyDocument(),
      script: "add all applications",
      viewpoints: [{ id: "vp_1", name: "Overview", hiddenKinds: [], camera: null, createdAt: "now" }],
    };
    const back = parseDocument(serializeDocument(doc));
    expect(back.script).toBe("add all applications");
    expect(back.viewpoints).toHaveLength(1);
  });
});
