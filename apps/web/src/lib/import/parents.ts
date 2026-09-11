import { reparentProblem } from "@/lib/hierarchy";

/**
 * Where each imported object will sit (§5.74).
 *
 * The half of the containment pass with judgement in it, kept pure so it can be tested without a
 * database. Approving resolves names to ids and writes rows; this decides which moves are moves
 * at all.
 *
 * Three rules, and each one is a way a real export goes wrong:
 *
 * - **A name that resolves to nothing is not a move.** The object still arrives; it arrives at the
 *   top, which is what an unknown parent honestly means. The review has already asked about it.
 * - **A move that is already made is not a move.** Re-importing the same export should write
 *   nothing, or every import looks like the estate changed.
 * - **A move that closes a ring is refused.** A cycle in the hierarchy is not a wrong answer, it
 *   is an unreadable tree: everything that walks it either hangs or silently truncates. The batch
 *   is checked against the tree *as it stands, including this batch's earlier moves*, because two
 *   rows that each name the other are exactly how a cycle arrives.
 */

export interface ParentMove {
  id: string;
  parentId: string;
  /** The parent it had before, for the rollback record. Empty when it had none. */
  from: string;
}

export function planParents(
  wanted: Array<{ id: string; parent: string }>,
  resolve: (name: string) => string | undefined,
  items: Array<{ id: string; parentId: string | null }>,
): ParentMove[] {
  // A working copy: each accepted move has to be visible to the cycle check for the next one.
  const tree = items.map((i) => ({ id: i.id, parentId: i.parentId }));
  const at = new Map(tree.map((i) => [i.id, i.parentId]));
  const moves: ParentMove[] = [];

  for (const want of wanted) {
    const name = want.parent.trim();
    if (!want.id || !name) continue;
    const parentId = resolve(name);
    if (!parentId || parentId === want.id) continue;
    if ((at.get(want.id) ?? null) === parentId) continue;
    if (reparentProblem(tree, want.id, parentId)) continue;

    moves.push({ id: want.id, parentId, from: at.get(want.id) ?? "" });
    const item = tree.find((i) => i.id === want.id);
    if (item) item.parentId = parentId;
    at.set(want.id, parentId);
  }
  return moves;
}
