/**
 * Containment: the one relationship that is not a relation (§5.70).
 *
 * Until now the Nexus graph was flat. Anything that wanted a tree — a capability map, C4's
 * levels, an organisation, ArchiMate composition — had to express it as an ordinary relation,
 * which loses the two things containment is actually for:
 *
 * - **Counts roll up through it.** A capability's weight is its own plus everything beneath it.
 *   No ordinary relation implies that, because no ordinary relation means *part of*.
 * - **A thing has exactly one parent**, so the structure is a tree and can be walked, indented,
 *   collapsed and summed. A relation kind called "contains" is a graph edge with none of those
 *   guarantees: nothing stops two parents, and nothing stops a cycle.
 *
 * So containment is a column, not an edge, and this module is the arithmetic over it. Pure: a
 * tree that lies about depth or loops forever is a corrupt tree, and the rules that prevent it
 * belong somewhere they can be tested.
 */

export interface Nested {
  id: string;
  parentId: string | null;
}

export interface TreeNode<T extends Nested> {
  item: T;
  /** 0 for a root. */
  depth: number;
  children: Array<TreeNode<T>>;
  /** Everything beneath it, at any depth. Excludes itself. */
  descendants: number;
}

/**
 * Build the forest, roots first, children ordered by `compare`.
 *
 * Anything whose parent is missing from the input is treated as a root rather than dropped. A
 * child of something outside the current filter is still a real thing, and silently losing it
 * would make a filtered tree quietly under-report — the failure mode nobody notices.
 */
export function forest<T extends Nested>(items: T[], compare?: (a: T, b: T) => number): Array<TreeNode<T>> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const childrenOf = new Map<string | null, T[]>();
  for (const item of items) {
    const parent = item.parentId && byId.has(item.parentId) ? item.parentId : null;
    const list = childrenOf.get(parent);
    if (list) list.push(item);
    else childrenOf.set(parent, [item]);
  }

  const seen = new Set<string>();
  const build = (item: T, depth: number): TreeNode<T> => {
    // A cycle that reached the reader would hang the renderer; stop and let it read as a leaf.
    if (seen.has(item.id)) return { item, depth, children: [], descendants: 0 };
    seen.add(item.id);
    const kids = [...(childrenOf.get(item.id) ?? [])];
    if (compare) kids.sort(compare);
    const children = kids.map((k) => build(k, depth + 1));
    return {
      item,
      depth,
      children,
      descendants: children.reduce((n, c) => n + 1 + c.descendants, 0),
    };
  };

  const roots = [...(childrenOf.get(null) ?? [])];
  if (compare) roots.sort(compare);
  return roots.map((r) => build(r, 0));
}

/** The forest flattened back to a list in reading order, each row carrying its depth. */
export function flatten<T extends Nested>(nodes: Array<TreeNode<T>>): Array<TreeNode<T>> {
  const out: Array<TreeNode<T>> = [];
  const walk = (list: Array<TreeNode<T>>) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** The chain from a root down to this item, inclusive. Empty when the id is unknown. */
export function ancestry<T extends Nested>(items: T[], id: string): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = id;
  while (cursor) {
    if (seen.has(cursor)) break; // a cycle; report what is reachable rather than spinning
    seen.add(cursor);
    const item: T | undefined = byId.get(cursor);
    if (!item) break;
    out.unshift(item);
    cursor = item.parentId;
  }
  return out;
}

/** Every id beneath this one, at any depth. Excludes the id itself. */
export function descendants<T extends Nested>(items: T[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const i of items) {
    if (!i.parentId) continue;
    const list = childrenOf.get(i.parentId);
    if (list) list.push(i.id);
    else childrenOf.set(i.parentId, [i.id]);
  }
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const stack = [...(childrenOf.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    stack.push(...(childrenOf.get(next) ?? []));
  }
  return out;
}

/**
 * Why a move is not allowed, or null when it is.
 *
 * Three rules, and each of them is a real corruption rather than a matter of taste: a thing
 * cannot contain itself; a thing cannot contain something it is already inside, because that
 * makes a ring with no root; and a parent must exist. A tree that breaks any of them cannot be
 * walked, and every reader of it either hangs or silently truncates.
 */
export function reparentProblem<T extends Nested>(items: T[], id: string, parentId: string | null): string | null {
  if (parentId === null) return null;
  if (id === parentId) return "Nothing can contain itself.";
  const byId = new Map(items.map((i) => [i.id, i]));
  if (!byId.has(id)) return "That object is not here.";
  if (!byId.has(parentId)) return "That parent is not here.";
  if (descendants(items, id).includes(parentId)) {
    return "That would put this inside something it already contains, which makes a loop with no top.";
  }
  return null;
}

/**
 * Roots that lost their parent — the survivable failure when a parent is deleted.
 *
 * Deleting a capability should not delete the estate underneath it, so there is no cascade on
 * the column; the children are re-pointed at the grandparent instead, which keeps the tree
 * connected and loses only the level that was actually removed.
 */
export function reparentOrphans<T extends Nested>(items: T[], removedId: string): Array<{ id: string; parentId: string | null }> {
  const removed = items.find((i) => i.id === removedId);
  const grandparent = removed?.parentId ?? null;
  return items.filter((i) => i.parentId === removedId).map((i) => ({ id: i.id, parentId: grandparent }));
}

/**
 * A count for each item that includes everything beneath it.
 *
 * `own` is what the item itself carries — relations, instances, cost, whatever the caller is
 * counting. `rolled` is that plus every descendant's. This is the number a capability map is
 * for: a parent with nothing of its own and forty applications underneath is not empty.
 */
export function rollUp<T extends Nested>(items: T[], own: (item: T) => number): Map<string, { own: number; rolled: number }> {
  const out = new Map<string, { own: number; rolled: number }>();
  for (const item of items) out.set(item.id, { own: own(item), rolled: own(item) });
  for (const node of flatten(forest(items))) {
    const at = out.get(node.item.id)!;
    at.rolled = at.own + descendants(items, node.item.id).reduce((n, id) => n + (out.get(id)?.own ?? 0), 0);
  }
  return out;
}

/** How deep the deepest branch goes. 0 for an empty forest, 1 for all roots. */
export function depth<T extends Nested>(items: T[]): number {
  return flatten(forest(items)).reduce((n, node) => Math.max(n, node.depth + 1), 0);
}
