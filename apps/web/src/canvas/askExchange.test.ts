import { describe, expect, it } from "vitest";
import { asComment, type Exchange } from "./askExchange";

/**
 * An exchange written down as a comment (§5.53).
 *
 * The property that matters is not the formatting: it is that a reader three months later can tell
 * what was asked, that a model answered, and what it was resting on.
 */

const turn = (question: string, answer: string, cites: Array<[string, string]> = []): Exchange => ({
  question,
  answer: { answer, cites: cites.map(([label, quote]) => ({ about: label, label, quote })), rejected: [] },
});

describe("keeping an exchange", () => {
  it("carries the question, the answer and what it read", () => {
    const body = asComment([turn("Who owns this?", "Customer Ops owns it.", [["CRM Cloud", "owner Customer Ops"]])]);
    expect(body).toContain("Q: Who owns this?");
    expect(body).toContain("Customer Ops owns it.");
    expect(body).toContain("— CRM Cloud: “owner Customer Ops”");
  });

  it("says a model wrote it, once", () => {
    // The worst outcome of this feature would be an agent's prose read as a colleague's.
    const body = asComment([turn("a", "one"), turn("b", "two")]);
    expect(body.match(/the prose is the model's/g)).toHaveLength(1);
    expect(body.trimEnd().endsWith("checked against the objects named.")).toBe(true);
  });

  it("keeps a follow-up in the order it was asked", () => {
    const body = asComment([turn("What would break?", "These two."), turn("Which are customer-facing?", "Only the first.")]);
    expect(body.indexOf("What would break?")).toBeLessThan(body.indexOf("Which are customer-facing?"));
  });

  it("says so when nothing was quoted, rather than looking well-sourced", () => {
    expect(asComment([turn("a", "an opinion")])).toContain("nothing on the board was quoted");
  });

  it("does not pretend an empty answer was an answer", () => {
    expect(asComment([turn("a", "")])).toContain("(it had nothing to say about that)");
  });

  it("fits inside a comment body", () => {
    const long = asComment(Array.from({ length: 40 }, (_, i) => turn(`question ${i} `.repeat(20), "x".repeat(1200))));
    expect(long.length).toBeLessThanOrEqual(4000);
  });
});
