import { describe, expect, it } from "vitest";
import type * as s from "@/db/schema";
import { changedWords, diffEstates, diffWords } from "./diff";

/**
 * Two observed states of the estate (#112, §5.98) — what actually happened, as opposed to what a
 * plan intends. The cases that matter are the quiet ones: a value that disappeared, a rename
 * that hides a retype, an object that went.
 */

const entity = (id: string, name: string, kind = "Application", attributes: Record<string, string> = {}): s.Entity =>
  ({ id, workspaceId: "ws", kind, name, description: "", attributes: JSON.stringify(attributes), parentId: null, source: "canvas", createdAt: "", updatedAt: "" }) as s.Entity;

describe("comparing the estate with itself", () => {
  it("says nothing happened when nothing did", () => {
    const estate = [entity("a", "Maximo", "Application", { owner: "IT" })];
    const diff = diffEstates(estate, estate);
    expect(diff.untouched).toBe(1);
    expect(diffWords(diff)).toBe("Nothing changed between these two moments.");
  });

  it("notices what arrived and what went", () => {
    const diff = diffEstates([entity("a", "Maximo"), entity("b", "Historian")], [entity("a", "Maximo"), entity("c", "Asset Hub")]);
    expect(diff.added.map((e) => e.name)).toEqual(["Asset Hub"]);
    expect(diff.removed.map((e) => e.name)).toEqual(["Historian"]);
    expect(diffWords(diff)).toBe("1 arrived, 1 went. 1 untouched.");
  });

  it("notices a rename and keeps the old name", () => {
    const diff = diffEstates([entity("a", "Maximo")], [entity("a", "Maximo EAM")]);
    expect(diff.changed[0]!.renamedFrom).toBe("Maximo");
  });

  it("notices a retype, which a rename would otherwise hide", () => {
    const diff = diffEstates([entity("a", "Maximo", "Application")], [entity("a", "Maximo EAM", "Platform")]);
    expect(diff.changed[0]).toMatchObject({ renamedFrom: "Maximo", retypedFrom: "Application" });
  });

  it("notices a field that changed", () => {
    const diff = diffEstates(
      [entity("a", "Maximo", "Application", { owner: "IT" })],
      [entity("a", "Maximo", "Application", { owner: "Grid Operations" })],
    );
    expect(diff.changed[0]!.fields).toEqual([{ key: "owner", from: "IT", to: "Grid Operations" }]);
  });

  it("notices a value that quietly disappeared — the harder thing to see", () => {
    const diff = diffEstates(
      [entity("a", "Maximo", "Application", { owner: "IT", criticality: "high" })],
      [entity("a", "Maximo", "Application", { owner: "IT" })],
    );
    expect(diff.changed[0]!.fields).toEqual([{ key: "criticality", from: "high", to: "" }]);
  });

  it("notices a field that was filled in", () => {
    const diff = diffEstates([entity("a", "Maximo")], [entity("a", "Maximo", "Application", { owner: "IT" })]);
    expect(diff.changed[0]!.fields).toEqual([{ key: "owner", from: "", to: "IT" }]);
  });

  it("orders by name, so two runs of the same comparison read the same", () => {
    const diff = diffEstates([], [entity("b", "Zebra"), entity("a", "Alpha")]);
    expect(diff.added.map((e) => e.name)).toEqual(["Alpha", "Zebra"]);
  });
});

describe("saying what happened to one object", () => {
  it("reads as a sentence", () => {
    const diff = diffEstates(
      [entity("a", "Maximo", "Application", { owner: "IT" })],
      [entity("a", "Maximo EAM", "Platform", { owner: "Grid Operations" })],
    );
    expect(changedWords(diff.changed[0]!)).toBe('renamed from “Maximo”, was a Application, owner “IT” → “Grid Operations”');
  });

  it("says a field was cleared rather than set to nothing", () => {
    const diff = diffEstates([entity("a", "M", "Application", { owner: "IT" })], [entity("a", "M")]);
    expect(changedWords(diff.changed[0]!)).toBe("owner cleared");
  });

  it("stops at three fields and counts the rest", () => {
    const before = entity("a", "M", "Application", { one: "1", two: "2", three: "3", four: "4", five: "5" });
    const diff = diffEstates([before], [entity("a", "M")]);
    expect(changedWords(diff.changed[0]!)).toContain("and 2 more fields");
  });
});
