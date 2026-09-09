import { describe, expect, it } from "vitest";
import { emptyDocument, migrateDocument, parseDocument, serializeDocument, type AgentElement } from "./document";

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

describe("an agent that was left thinking", () => {
  const agent = (over: Partial<AgentElement> = {}): AgentElement => ({
    id: "ag", type: "agent", x: 0, y: 0, w: 260, h: 200, z: 1,
    name: "Watcher", purpose: "watch", scope: "board", color: "#4f46e5", ...over,
  });

  it("is not thinking when the document is read again", () => {
    /*
     * `thinking` is written into the document on purpose, so a live board shows everybody that
     * somebody has woken an agent. The cost was that a tab closed mid-run left it true for ever:
     * the agent said "Reading…" with its Wake button disabled and the only way out was to delete
     * it. A run cannot outlive the page that started it, so loading is when the flag is known false.
     */
    const doc = parseDocument(JSON.stringify({ version: 2, elements: { ag: agent({ thinking: true }) } }));
    const el = doc.elements.ag!;
    expect(el.type === "agent" && el.thinking).toBe(false);
  });

  it("cannot be stored as thinking either, because saving migrates too", () => {
    /*
     * `migrateDocument` is on both sides of the wire: the board `PUT` runs it on the way in and
     * `parseDocument` runs it on the way out. So the flag is in-memory and broadcast-only in
     * practice, and the stuck state is unreachable in two independent places rather than one.
     */
    const saved = serializeDocument(migrateDocument({ version: 2, elements: { ag: agent({ thinking: true }) } }));
    expect(saved).not.toContain('"thinking":true');
  });

  it("keeps everything else it was carrying", () => {
    const doc = parseDocument(JSON.stringify({
      version: 2,
      elements: { ag: agent({ thinking: true, read: 14, discarded: 2, note: "said this", remarks: [{ id: "r", about: "x", text: "t", quote: "q" }] }) },
    }));
    const el = doc.elements.ag!;
    expect(el.type === "agent" && el.read).toBe(14);
    expect(el.type === "agent" && el.discarded).toBe(2);
    expect(el.type === "agent" && el.remarks?.length).toBe(1);
    expect(el.type === "agent" && el.note).toBe("said this");
  });
});
