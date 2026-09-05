import { describe, expect, it } from "vitest";
import { detectSourceKind, looksLikeTranscript, parsePassages, speakersOf } from "./transcript";
import { extractCandidates, extractRelations, extractViewpoints, type Vocabulary } from "./extract";
import { runPipeline } from "./pipeline";

const VOCAB: Vocabulary = {
  entities: [
    { id: "ent_maximo", name: "Maximo", kind: "Application" },
    { id: "ent_scada", name: "SCADA", kind: "Application" },
  ],
  kinds: ["Application", "IT Component", "Business Capability"],
  relationKinds: ["depends on", "owns"],
};

const TEAMS = `Jesper Solberg   0:12
So the topic today is the target architecture for metering. Maximo depends on SCADA for the outage data.

Mette Lund   1:04
My concern is that Maximo is out of support next year. That is a real risk for us.

Jesper Solberg   1:40
Agreed. We decided to replace Maximo with the Nexus platform.
I will prepare a migration plan before the next meeting.

Mette Lund   2:10
Who owns the billing capability today?
`;

describe("transcript parsing", () => {
  it("reads a Teams-style export into speaker turns", () => {
    const passages = parsePassages(TEAMS);
    expect(looksLikeTranscript(TEAMS)).toBe(true);
    expect(detectSourceKind(TEAMS)).toBe("transcript");
    expect(speakersOf(passages)).toEqual(["Jesper Solberg", "Mette Lund"]);
    expect(passages).toHaveLength(4);
    expect(passages[0]!.at).toBe("0:12");
    // consecutive lines by one speaker are one contribution
    expect(passages[2]!.text).toContain("migration plan");
    expect(passages[2]!.text).toContain("We decided");
  });

  it("reads WEBVTT with voice tags", () => {
    const vtt = `WEBVTT

1
00:00:04.000 --> 00:00:08.000
<v Anna Berg>Maximo talks to the billing system.</v>

2
00:00:09.000 --> 00:00:12.000
<v Anna Berg>We need to map that integration.</v>
`;
    const passages = parsePassages(vtt);
    expect(passages).toHaveLength(1); // same speaker, merged
    expect(passages[0]!.speaker).toBe("Anna Berg");
    expect(passages[0]!.text).toContain("billing system");
  });

  it("falls back to paragraphs when there are no speakers", () => {
    const doc = "The portfolio review is annual.\n\nEvery application has an owner.";
    expect(looksLikeTranscript(doc)).toBe(false);
    const passages = parsePassages(doc);
    expect(passages).toHaveLength(2);
    expect(passages[0]!.speaker).toBe("");
  });

  it("reads two people talking as a conversation, and labels as prose", () => {
    expect(looksLikeTranscript("Anna: we should map it.\nBo: agreed.\n")).toBe(true);
    expect(looksLikeTranscript("Agenda: portfolio\nNote: bring the roadmap\nSummary: short\n")).toBe(false);
  });

  it("does not read a label as a person", () => {
    const passages = parsePassages("Agenda: portfolio\nNote: bring the roadmap\n");
    expect(speakersOf(passages)).toEqual([]);
  });
});

describe("extraction", () => {
  const passages = parsePassages(TEAMS);
  const candidates = extractCandidates(passages, VOCAB);
  const find = (name: string) => candidates.find((c) => c.name.toLowerCase() === name.toLowerCase());

  it("links names the graph already knows", () => {
    expect(find("Maximo")?.existingEntityId).toBe("ent_maximo");
    expect(find("Maximo")?.confidence).toBe("high");
    expect(find("Maximo")?.mentions.length).toBeGreaterThan(1);
  });

  it("types a name from the phrase around it", () => {
    expect(find("Nexus")?.kind).toBe("Platform");
    expect(find("Nexus")?.confidence).toBe("medium");
    expect(find("billing")?.kind).toBe("Business Capability");
  });

  it("does not sweep a capitalised determiner into the name", () => {
    const passages2 = parsePassages("Anna Berg: The Kamstrup platform is new. Kamstrup replaces Maximo.");
    const found = extractCandidates(passages2, VOCAB);
    expect(found.map((c) => c.name)).toContain("Kamstrup");
    expect(found.map((c) => c.name)).not.toContain("The Kamstrup");
  });

  it("does not recognise a whole sentence stored as an entity name", () => {
    const wordy: Vocabulary = {
      ...VOCAB,
      entities: [...VOCAB.entities, { id: "ent_risk", kind: "Risk", name: "My concern is that Maximo is out of support from next year", }],
    };
    const found = extractCandidates(parsePassages(TEAMS), wordy);
    expect(found.some((c) => c.kind === "Risk")).toBe(false);
  });

  it("recognises what the source is about, not only what it names", () => {
    const topics = candidates.filter((c) => c.kind === "Topic").map((c) => c.name);
    expect(topics).toContain("Target Architecture");
  });

  it("makes the speakers people", () => {
    expect(find("Jesper Solberg")?.kind).toBe("Person");
    expect(find("Mette Lund")?.kind).toBe("Person");
  });

  it("carries the quote that produced every candidate", () => {
    for (const c of candidates) {
      expect(c.mentions.length).toBeGreaterThan(0);
      expect(c.mentions[0]!.quote.length).toBeGreaterThan(0);
      expect(c.reason).not.toBe("");
    }
  });

  it("reads relations from the verb between two names", () => {
    const relations = extractRelations(passages, candidates, VOCAB);
    const dep = relations.find((r) => r.kind === "depends on");
    expect(dep).toBeDefined();
    expect(dep!.from).toBe("application|maximo");
    expect(dep!.to).toBe("application|scada");
    expect(dep!.mentions[0]!.speaker).toBe("Jesper Solberg");
  });

  it("keeps what people decided, feared, owed and asked", () => {
    const views = extractViewpoints(passages, candidates);
    const typed = (t: string) => views.filter((v) => v.type === t);
    expect(typed("decision")[0]!.text).toContain("replace Maximo");
    expect(typed("decision")[0]!.speaker).toBe("Jesper Solberg");
    expect(typed("risk")[0]!.speaker).toBe("Mette Lund");
    expect(typed("action").length).toBeGreaterThan(0);
    expect(typed("question")[0]!.text).toContain("owns the billing capability");
    // a viewpoint knows what it is about
    expect(typed("risk")[0]!.about).toContain("application|maximo");
  });
});

describe("pipeline", () => {
  it("reports every stage with its counts", () => {
    let t = 0;
    const run = runPipeline({ name: "Architecture sync", text: TEAMS, vocabulary: VOCAB, clock: () => (t += 5) });
    expect(run.stages.map((s) => s.id)).toEqual(["read", "segment", "recognise", "resolve", "relate", "viewpoints", "stage"]);
    expect(run.stages.every((s) => s.status !== "error")).toBe(true);
    expect(run.stages.find((s) => s.id === "segment")!.detail).toContain("2 speakers");
    expect(run.stages.find((s) => s.id === "resolve")!.out).toBe(2); // Maximo and SCADA
    expect(run.stages.find((s) => s.id === "stage")!.out).toBe(run.candidates.length + run.relations.length + run.viewpoints.length);
    expect(run.sourceKind).toBe("transcript");
    expect(run.speakers).toHaveLength(2);
  });

  it("marks a stage empty rather than failing when a source yields nothing", () => {
    const run = runPipeline({ name: "empty", text: "   ", vocabulary: { entities: [], kinds: [], relationKinds: [] } });
    expect(run.stages.find((s) => s.id === "segment")!.status).toBe("empty");
    expect(run.candidates).toEqual([]);
  });
});
