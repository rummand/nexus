import { describe, expect, it } from "vitest";
import { evidenceProposals, lifecycleProposals, ownershipProposals } from "./proposals-evidence";
import type * as s from "@/db/schema";

const entity = (id: string, kind: string, name: string, attributes: Record<string, string> = {}): s.Entity => ({
  id, workspaceId: "ws", kind, name, description: "", attributes: JSON.stringify(attributes),
  source: "intake:src1", createdAt: "", updatedAt: "",
});
const rel = (id: string, from: string, kind: string, to: string): s.Relation => ({
  id, workspaceId: "ws", fromEntityId: from, toEntityId: to, kind, attributes: "{}",
  source: "intake:src1", createdAt: "", updatedAt: "",
});

const graph = (entities: s.Entity[], relations: s.Relation[], decided: string[] = []) => ({
  entities, relations, decided: new Set(decided),
  attributesOf: (id: string) => JSON.parse(entities.find((e) => e.id === id)?.attributes ?? "{}") as Record<string, string>,
});

describe("ownership from what people actually did", () => {
  const base = [
    entity("app", "Application", "Maximo"),
    entity("anders", "Person", "Anders Vig"),
    entity("mette", "Person", "Mette Lund"),
    entity("action", "Action", "I will prepare a migration plan"),
    entity("meeting", "Meeting", "Metering sync"),
  ];

  it("proposes the person who raised an action about the system", () => {
    const [proposal] = ownershipProposals(graph(base, [
      rel("r1", "anders", "raised", "action"),
      rel("r2", "action", "about", "app"),
      rel("r3", "meeting", "mentions", "app"),
    ]));
    expect(proposal).toBeDefined();
    expect(proposal!.action).toEqual({ kind: "setAttribute", entityId: "app", key: "owner", to: "Anders Vig" });
    expect(proposal!.confidence).toBe("medium");
    expect(proposal!.title).toContain("Anders Vig");
    expect(proposal!.evidence?.[0]).toContain("migration plan");
  });

  it("stays quiet when two people acted on the same thing", () => {
    const withSecond = [...base, entity("decision", "Decision", "We decided to replace it")];
    expect(ownershipProposals(graph(withSecond, [
      rel("r1", "anders", "raised", "action"), rel("r2", "action", "about", "app"),
      rel("r3", "mette", "raised", "decision"), rel("r4", "decision", "about", "app"),
    ]))).toEqual([]);
  });

  it("does not treat a question as a claim on the thing", () => {
    const asking = [...base, entity("q", "Question", "Who owns the billing capability?")];
    expect(ownershipProposals(graph(asking, [
      rel("r1", "mette", "raised", "q"), rel("r2", "q", "about", "app"),
    ])).filter((p) => p.confidence === "medium")).toEqual([]);
  });

  it("falls back to lone attendance, and says the evidence is weak", () => {
    const [proposal] = ownershipProposals(graph(base, [
      rel("r1", "mette", "attended", "meeting"),
      rel("r2", "meeting", "mentions", "app"),
    ]));
    expect(proposal!.confidence).toBe("low");
    expect(proposal!.detail).toContain("being present is not owning");
  });

  it("leaves an owned system alone, and a remembered decision alone", () => {
    const owned = [entity("app", "Application", "Maximo", { owner: "Grid Operations" }), ...base.slice(1)];
    expect(ownershipProposals(graph(owned, [rel("r1", "anders", "raised", "action"), rel("r2", "action", "about", "app")]))).toEqual([]);
    expect(ownershipProposals(graph(base, [rel("r1", "anders", "raised", "action"), rel("r2", "action", "about", "app")], ["owner:app=anders vig"]))).toEqual([]);
  });

  it("ignores things that are not part of the estate", () => {
    const person = [entity("p", "Person", "Jes"), entity("a", "Action", "do a thing"), entity("who", "Person", "Someone")];
    expect(ownershipProposals(graph(person, [rel("r1", "who", "raised", "a"), rel("r2", "a", "about", "p")]))).toEqual([]);
  });
});

describe("lifecycle from what was said", () => {
  const app = entity("app", "Application", "Maximo");

  const risk = (text: string): s.Entity => ({ ...entity("risk", "Risk", text), description: text });

  it("reads end of life out of a risk", () => {
    const [proposal] = lifecycleProposals(graph([app, risk("Maximo is out of support from next year")], [rel("r", "risk", "about", "app")]));
    expect(proposal!.action).toMatchObject({ kind: "setAttribute", key: "lifecycle", to: "end of life" });
    expect(proposal!.title).toContain("end of life");
  });

  it("reads a decision to replace as phasing out", () => {
    const decision = { ...entity("risk", "Decision", "We decided to replace Maximo"), description: "We decided to replace Maximo with Kamstrup" };
    const [proposal] = lifecycleProposals(graph([app, decision], [rel("r", "risk", "about", "app")]));
    expect(proposal!.action).toMatchObject({ to: "phasing out" });
  });

  it("says nothing when the words do not state a lifecycle", () => {
    expect(lifecycleProposals(graph([app, risk("Maximo is quite slow on Mondays")], [rel("r", "risk", "about", "app")]))).toEqual([]);
  });

  it("leaves a system that already has one alone", () => {
    const dated = entity("app", "Application", "Maximo", { lifecycle: "live" });
    expect(lifecycleProposals(graph([dated, risk("Maximo is out of support")], [rel("r", "risk", "about", "app")]))).toEqual([]);
  });
});

describe("all of the evidence rules", () => {
  it("puts the strongest first", () => {
    const entities = [
      entity("app", "Application", "Maximo"),
      entity("anders", "Person", "Anders Vig"),
      entity("action", "Action", "I will prepare a migration plan"),
      { ...entity("risk", "Risk", "out of support"), description: "Maximo is out of support from next year" },
    ];
    const proposals = evidenceProposals(graph(entities, [
      rel("r1", "anders", "raised", "action"), rel("r2", "action", "about", "app"), rel("r3", "risk", "about", "app"),
    ]));
    expect(proposals).toHaveLength(2);
    expect(proposals.every((p) => p.confidence === "medium")).toBe(true);
    expect(proposals.every((p) => (p.evidence?.length ?? 0) > 0)).toBe(true);
  });
});
