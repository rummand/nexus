import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { commitExtraction } from "./commit";
import { runPipeline } from "./pipeline";
import { parseAttributes } from "../graph";

let db: Db;

const TEXT = `Jesper Solberg   0:04
Maximo depends on SCADA for the outage data.

Mette Lund   0:40
We decided to replace Maximo with the Kamstrup platform.
`;

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "ws", name: "WS" });
  await db.insert(s.entities).values({ id: "ent_maximo", workspaceId: "ws", kind: "Application", name: "Maximo" });
  await db.insert(s.sources).values({ id: "src1", workspaceId: "ws", name: "Architecture sync", kind: "transcript", connector: "transcript", text: TEXT, characters: TEXT.length });
});

const source = async () => (await db.select().from(s.sources).where(eq(s.sources.id, "src1")))[0]!;

describe("committing an extraction", () => {
  it("makes the meeting a node, linked to who attended and what was discussed", async () => {
    const extraction = runPipeline({
      name: "Architecture sync",
      text: TEXT,
      vocabulary: { entities: [{ id: "ent_maximo", name: "Maximo", kind: "Application" }], kinds: ["Application"], relationKinds: [] },
    });
    const result = await commitExtraction(db, "ws", await source(), extraction, {
      candidates: extraction.candidates.map((c) => c.key),
      relations: extraction.relations.map((r) => r.key),
      viewpoints: extraction.viewpoints.map((v) => v.key),
    });

    const entities = await db.select().from(s.entities).where(eq(s.entities.workspaceId, "ws"));
    const byName = new Map(entities.map((e) => [e.name, e]));
    const meeting = entities.find((e) => e.kind === "Meeting")!;
    expect(meeting.name).toBe("Architecture sync");
    expect(result.sourceEntityId).toBe(meeting.id);

    // the entity that already existed was linked, not duplicated
    expect(entities.filter((e) => e.name === "Maximo")).toHaveLength(1);
    expect(byName.get("Maximo")!.id).toBe("ent_maximo");
    expect(result.entitiesLinked).toBe(1);

    const relations = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, "ws"));
    const from = (id: string, kind: string) => relations.filter((r) => r.fromEntityId === id && r.kind === kind);
    // a person attended the meeting; the meeting mentions the systems
    expect(from(byName.get("Jesper Solberg")!.id, "attended").map((r) => r.toEntityId)).toEqual([meeting.id]);
    expect(from(meeting.id, "mentions").map((r) => entities.find((e) => e.id === r.toEntityId)!.name)).toContain("Maximo");

    // every mention carries the sentence that justified it
    const mention = from(meeting.id, "mentions")[0]!;
    expect((parseAttributes(mention.attributes).quote ?? "").length).toBeGreaterThan(10);

    // the decision became an object of its own, owned by whoever made it
    const decision = entities.find((e) => e.kind === "Decision")!;
    expect(decision.description).toContain("replace Maximo");
    expect(parseAttributes(decision.attributes).raised_by).toBe("Mette Lund");
    expect(from(byName.get("Mette Lund")!.id, "raised").map((r) => r.toEntityId)).toContain(decision.id);
    expect(from(decision.id, "about").length).toBeGreaterThan(0);

    const after = await source();
    expect(after.status).toBe("committed");
    expect(after.entityId).toBe(meeting.id);
  });

  it("writes only what was accepted, and drops a connection whose ends were not", async () => {
    const extraction = runPipeline({
      name: "Architecture sync",
      text: TEXT,
      vocabulary: { entities: [], kinds: ["Application"], relationKinds: [] },
    });
    const only = extraction.candidates.filter((c) => c.kind === "Person").map((c) => c.key);
    const result = await commitExtraction(db, "ws", await source(), extraction, {
      candidates: only,
      relations: extraction.relations.map((r) => r.key),
      viewpoints: [],
    });
    const entities = await db.select().from(s.entities).where(eq(s.entities.workspaceId, "ws"));
    expect(entities.filter((e) => e.kind === "Person")).toHaveLength(2);
    // Maximo was in the source but not accepted, so it is not in the graph (beyond the seeded one)
    expect(entities.filter((e) => e.name === "SCADA")).toHaveLength(0);
    expect(result.viewpointsCreated).toBe(0);
    // the "depends on" relation had no accepted ends
    const relations = await db.select().from(s.relations_).where(eq(s.relations_.workspaceId, "ws"));
    expect(relations.some((r) => r.kind === "depends on")).toBe(false);
  });

  it("is idempotent: committing the same run twice does not double the graph", async () => {
    const extraction = runPipeline({ name: "Architecture sync", text: TEXT, vocabulary: { entities: [], kinds: [], relationKinds: [] } });
    const selection = {
      candidates: extraction.candidates.map((c) => c.key),
      relations: extraction.relations.map((r) => r.key),
      viewpoints: extraction.viewpoints.map((v) => v.key),
    };
    await commitExtraction(db, "ws", await source(), extraction, selection);
    const first = await db.select().from(s.entities).where(eq(s.entities.workspaceId, "ws"));
    await commitExtraction(db, "ws", await source(), extraction, selection);
    const second = await db.select().from(s.entities).where(eq(s.entities.workspaceId, "ws"));
    expect(second).toHaveLength(first.length);
  });
});
