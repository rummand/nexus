import { describe, expect, it } from "vitest";
import { mergeGate, refusalWords } from "./gate";
import type { Finding } from "./suite";

const finding = (checkId: Finding["checkId"], subjectId: string, subjectName: string, detail: string): Finding =>
  ({ checkId, subjectId, subjectName, detail });

describe("the merge gate", () => {
  it("opens when the ref adds nothing", () => {
    expect(mergeGate([])).toEqual({ ok: true, advisory: 0 });
  });

  it("opens on advisory findings and counts them", () => {
    const gate = mergeGate([finding("types-declared", "e1", "Maximo", "is a Widget, which nobody has declared")]);
    expect(gate).toEqual({ ok: true, advisory: 1 });
  });

  it("closes on one blocking finding and names it", () => {
    const gate = mergeGate([finding("no-cycles", "e1", "Maximo", "sits inside something it contains")]);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.refusal.blocking).toBe(1);
    expect(gate.refusal.named).toHaveLength(1);
    expect(gate.refusal.more).toBe(0);
    expect(refusalWords(gate.refusal)).toBe("1 new blocking finding. “Maximo” sits inside something it contains.");
  });

  it("names three and counts the rest", () => {
    const gate = mergeGate(
      ["a", "b", "c", "d", "e"].map((id) => finding("required-fields", id, id.toUpperCase(), "has no owner")),
    );
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.refusal.named).toHaveLength(3);
    expect(gate.refusal.more).toBe(2);
    expect(refusalWords(gate.refusal)).toContain("and 2 more.");
  });

  it("counts the advisory findings alongside a refusal without letting them cause it", () => {
    const gate = mergeGate([
      finding("required-fields", "a", "A", "has no owner"),
      finding("types-declared", "b", "B", "is a Widget, which nobody has declared"),
    ]);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.refusal.blocking).toBe(1);
    expect(gate.refusal.advisory).toBe(1);
    expect(gate.refusal.named).toHaveLength(1);
  });

  it("reads without a name when the object has none", () => {
    const gate = mergeGate([finding("required-fields", "x", "", "has no owner")]);
    if (gate.ok) return;
    expect(refusalWords(gate.refusal)).toContain("“(unnamed)” has no owner");
  });
});
