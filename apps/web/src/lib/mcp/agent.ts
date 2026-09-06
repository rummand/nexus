import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { getDefinition, insertDefinition } from "@/lib/agent/definitions";
import type { AgentDefinition } from "@/lib/agent/definition";

/**
 * The agent an outside key speaks as.
 *
 * Something proposing through MCP is an agent in this workspace like any other, so it gets a
 * definition: an owner, a scope, verbs, a budget, and a row in the fleet where its acceptance rate
 * can be read. Without that, "an outside system suggested this" would be the one kind of proposal
 * nobody could hold to account — and the fleet page would be quietly lying about how many agents
 * are working here.
 *
 * It is created without `merge`. Folding two objects into one is the change that is hardest to
 * unpick, and an outside caller has not seen the boards, the history or the argument that put both
 * there; a person can always add the verb afterwards.
 */
export async function ensureTokenAgent(db: Db, workspaceId: string, tokenId: string, tokenName: string): Promise<AgentDefinition | null> {
  const token = await db.query.mcpTokens.findFirst({ where: eq(s.mcpTokens.id, tokenId) });
  if (token?.agentId) {
    const existing = await getDefinition(db, token.agentId);
    if (existing) return existing;
  }
  const teams = await db.select().from(s.teams).where(eq(s.teams.workspaceId, workspaceId));
  const id = await insertDefinition(db, workspaceId, {
    name: `Outside · ${tokenName}`.slice(0, 80),
    purpose: `Suggestions that arrive through MCP under the key “${tokenName}”. Whatever is on the other end wrote them; this workspace still decides.`,
    ownerTeamId: teams[0]?.id ?? null,
    scope: "*",
    verbs: ["setKind", "renameKind", "setAttribute", "addRelation"],
    grounding: "",
    providerId: null,
    model: "",
    budget: { runsPerDay: 48, maxProposals: 10 },
    status: "active",
  });
  await db.update(s.mcpTokens).set({ agentId: id }).where(eq(s.mcpTokens.id, tokenId));
  return getDefinition(db, id);
}
