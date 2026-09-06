import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import * as s from "@/db/schema";
import type { Db } from "@/db/client";
import { serializeDocument, type AgentElement, type CanvasElement } from "@/canvas/document";
import { acceptance, fleetOf, verdict } from "./fleet";

/**
 * Whether an agent is worth having.
 *
 * The measure that matters is not runs or remarks made: it is how often a person kept what an
 * agent said. These tests pin that down, and pin down the thing it would be easy to get wrong —
 * that deleting an agent must not quietly erase the record of how it did, because the useful
 * moment for that record is when somebody is about to write the same agent again.
 */

let db: Db;

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }), { schema: s });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
  await db.insert(s.workspaces).values({ id: "ws", slug: "acme", name: "Acme" });
  await db.insert(s.spaces).values({ id: "sp", workspaceId: "ws", name: "Landscape" });
});

const agent = (id: string, over: Partial<AgentElement> = {}): AgentElement =>
  ({ id, type: "agent", x: 0, y: 0, w: 300, h: 240, name: `Agent ${id}`, purpose: "Watch for gaps.", scope: "board", color: "#4f46e5", z: 1, remarks: [], ...over });

const board = (id: string, name: string, els: CanvasElement[]) =>
  db.insert(s.boards).values({
    id, workspaceId: "ws", spaceId: "sp", name, description: "", createdById: null,
    document: serializeDocument({ version: 2, elements: Object.fromEntries(els.map((e) => [e.id, e])) }),
  });

const outcome = (agentElementId: string, o: "kept" | "dismissed", name = "Agent a") =>
  db.insert(s.agentRemarkOutcomes).values({ id: `aro_${Math.random()}`, workspaceId: "ws", boardId: "b1", agentElementId, agentName: name, outcome: o });

describe("the fleet", () => {
  it("finds every agent on every board, and what it watches", async () => {
    await board("b1", "Landscape", [agent("a", { name: "Succession watch", scope: "frame" })]);
    await board("b2", "Integrations", [agent("b"), agent("c", { scope: "connected" })]);

    const fleet = await fleetOf(db, "ws");
    expect(fleet.totals.agents).toBe(3);
    const first = fleet.agents.find((x) => x.id === "a")!;
    expect(first).toMatchObject({ name: "Succession watch", scope: "frame", boardName: "Landscape", spaceName: "Landscape" });
  });

  it("counts remarks still waiting on the board", async () => {
    await board("b1", "Landscape", [agent("a", { remarks: [
      { id: "r1", about: "c1", text: "x", quote: "q" },
      { id: "r2", about: "c2", text: "y", quote: "q" },
    ] })]);
    expect((await fleetOf(db, "ws")).totals.open).toBe(2);
  });

  it("scores an agent by what people kept, not by how much it said", async () => {
    await board("b1", "Landscape", [agent("a")]);
    for (let i = 0; i < 3; i++) await outcome("a", "kept");
    await outcome("a", "dismissed");

    const fleet = await fleetOf(db, "ws");
    const a = fleet.agents[0]!;
    expect(a).toMatchObject({ kept: 3, dismissed: 1 });
    expect(acceptance(a)).toBe(75);
  });

  it("keeps the record of an agent somebody deleted", async () => {
    await board("b1", "Landscape", [agent("a")]);
    await outcome("gone", "dismissed", "Ownership nag");
    await outcome("gone", "dismissed", "Ownership nag");

    const fleet = await fleetOf(db, "ws");
    expect(fleet.agents.map((x) => x.id)).toEqual(["a"]);
    expect(fleet.gone).toEqual([{ agentElementId: "gone", name: "Ownership nag", kept: 0, dismissed: 2 }]);
    // and a deleted agent's answers still count towards the workspace total
    expect(fleet.totals.dismissed).toBe(2);
  });

  it("says nothing rather than something confident about an agent nobody has answered", async () => {
    await board("b1", "Landscape", [agent("a")]);
    const a = (await fleetOf(db, "ws")).agents[0]!;
    expect(acceptance(a)).toBeNull();
    expect(verdict(null, 0)).toMatch(/Nobody has answered it yet/);
  });

  it("is empty, not broken, in a workspace with no agents", async () => {
    await board("b1", "Landscape", []);
    const fleet = await fleetOf(db, "ws");
    expect(fleet.agents).toEqual([]);
    expect(fleet.totals).toEqual({ agents: 0, open: 0, kept: 0, dismissed: 0 });
  });
});

describe("what the score is allowed to claim", () => {
  it("refuses to judge on too little evidence", () => {
    expect(verdict(100, 1)).toMatch(/Too early/);
    expect(verdict(0, 3)).toMatch(/Too early/);
  });

  it("says plainly when an agent is not earning its place", () => {
    expect(verdict(10, 20)).toMatch(/waved away/);
    expect(verdict(40, 20)).toMatch(/Mixed/);
    expect(verdict(80, 20)).toMatch(/keep most of what it says/);
  });
});
