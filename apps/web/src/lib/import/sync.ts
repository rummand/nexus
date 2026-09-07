import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import type { CanvasDocument } from "@/canvas/document";
import { parseReview, type StoredReview } from "./batch";
import { readBoard } from "./reconcile";

/**
 * Keeping a staged board and its batch in step.
 *
 * Not a server action: it takes a database handle and a document, and it is called from the board
 * save path rather than from a browser. A "use server" module would expose it as something a
 * client could call with anything at all, which is a strange door to leave open on the one thing
 * that decides what an import will write.
 */

/**
 * Read a saved staged board back into its batch.
 *
 * Called from the board save path, so dragging a card into another lane *is* the decision — no
 * "apply" button, no second place to press. Everything it writes is a person's judgement about a
 * claim; nothing here touches the graph, which still waits for the batch to be approved.
 *
 * It is deliberately quiet about failure: a board whose batch has been approved or deleted is an
 * ordinary board with some odd-looking frames, and saving it should not error at somebody who is
 * only moving a card around.
 */
export async function reconcileBoard(db: Db, batchId: string, document: CanvasDocument): Promise<void> {
  const batch = await db.query.importBatches.findFirst({ where: eq(s.importBatches.id, batchId) });
  if (!batch || batch.status !== "staged") return;

  const stored = parseReview(batch.review);
  const reading = readBoard(document, stored.records);

  const decisions = { ...stored.decisions };
  for (const [id, decision] of Object.entries(reading.decisions)) {
    // Only a change is a person's act. Re-saving a board must not turn every default into a
    // decision somebody made, or "nobody has looked at these yet" stops being answerable.
    if (decisions[id]?.decision === decision) continue;
    decisions[id] = { decision, by: "person" };
  }

  await db.update(s.importBatches).set({
    review: JSON.stringify({
      ...stored,
      decisions,
      overrides: reading.overrides,
      drawn: reading.relations,
      removed: reading.removed,
    } satisfies StoredReview),
    updatedAt: new Date().toISOString(),
  }).where(eq(s.importBatches.id, batchId));
  const ws = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, batch.workspaceId) });
  if (ws) {
    revalidatePath(`/w/${ws.slug}/import`);
    revalidatePath(`/w/${ws.slug}/import/${batchId}`);
  }
}
