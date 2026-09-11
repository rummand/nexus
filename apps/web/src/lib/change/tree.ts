import { foldMoments, type GraphEvent } from "@/lib/history/events";
import type { Change, ChangeSet } from "./types";

/**
 * The tree: every branch and every commit, drawn (§5.84).
 *
 * Nexus has had all the pieces of a version-controlled model and no picture of it. The history
 * page is a list, the roadmap is a timeline of plans, and nothing showed the *shape* — which
 * branches exist, where each was cut, what is on it, and which ones have landed. A branching
 * model you cannot see is a branching model people guess at.
 *
 * This is the layout, kept pure so it can be tested without a database or a browser. Three
 * things it decides, and each one is a judgement about honesty rather than about drawing:
 *
 * - **A commit on `main` is a *moment*, not an event.** The history already folds edits by the
 *   same hand in the same place within two minutes into one moment (§5.43); renaming three
 *   fields on one object is one commit, not three, exactly as it would be in a repository.
 * - **A lane is a ref, for the whole height of the drawing.** Reusing a column once a branch
 *   ends is how git graphs save space and how readers lose the thread. Nexus has tens of change
 *   sets, not thousands of commits; clarity is affordable.
 * - **Time runs down the page, newest first.** The same direction as the history page, and the
 *   direction people read. Being consistent with the product beats being consistent with `git
 *   log --graph`, which runs the same way anyway.
 */

export type TreeKind = "commit" | "open" | "cut" | "merge" | "tag";

export interface TreeNode {
  id: string;
  /** Column. 0 is always `main`. */
  lane: number;
  /** Row, top to bottom, newest first. */
  row: number;
  at: string;
  kind: TreeKind;
  /** The ref this node belongs to: "main" or a change set id. */
  ref: string;
  title: string;
  detail: string;
  /** How many changes or events it carries. */
  size: number;
  /** What it touched, so a node is somewhere you can go from. */
  entityIds: string[];
}

export interface TreeEdge {
  from: string;
  to: string;
  /** A line down one lane, a branch leaving main, or a merge arriving back. */
  kind: "line" | "cut" | "merge";
}

export interface TreeLane {
  lane: number;
  ref: string;
  name: string;
  /** Open branches can be stood on; landed and abandoned ones are history. */
  status: "main" | "open" | "landed" | "abandoned";
  commits: number;
}

export interface BranchTree {
  nodes: TreeNode[];
  edges: TreeEdge[];
  lanes: TreeLane[];
  rows: number;
}

export interface TreeInput {
  /** In any order; the layout sorts them newest-first itself. */
  events: GraphEvent[];
  changeSets: ChangeSet[];
  plateaus?: Array<{ id: string; name: string; targetDate: string }>;
  /** Cap on trunk commits, so one busy afternoon does not become the whole picture. */
  limit?: number;
}

const ms = (iso: string) => Date.parse(iso) || 0;
const entityIdsOf = (changes: Change[]) => [...new Set(changes.map((c) => c.entityId).filter((v): v is string => Boolean(v)))];

/** The words on a change-set commit: one change reads as itself, several read as a count. */
function describeChanges(changes: Change[]): string {
  if (changes.length === 1) return changes[0]!.note || "one change";
  const notes = changes.map((c) => c.note).filter(Boolean);
  return notes.length ? notes[0]! : `${changes.length} changes`;
}

export function branchTree({ events, changeSets, plateaus = [], limit = 60 }: TreeInput): BranchTree {
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  /* ---- lane 0: main, from the history's own moments ------------------------------------- */
  /*
   * Sorted here rather than trusted from the caller. `foldMoments` compares adjacent events, so
   * it only folds correctly on a newest-first list — and a drawing that silently comes out wrong
   * when its input arrives the other way round is worse than one that refuses.
   */
  const newestFirst = [...events].sort((a, b) => ms(b.at) - ms(a.at));
  const moments = foldMoments(newestFirst).slice(0, limit);
  const trunk: TreeNode[] = moments.map((m, i) => ({
    id: `main:${m.at}:${i}`,
    lane: 0,
    row: 0,
    at: m.at,
    kind: "commit" as const,
    ref: "main",
    title: m.actor.name || m.actor.kind,
    detail: m.context || `${m.events.length} change${m.events.length === 1 ? "" : "s"}`,
    size: m.events.length,
    entityIds: [...new Set(m.events.map((e) => e.entityId))],
  }));

  /* ---- one lane per change set ------------------------------------------------------------ */
  const lanes: TreeLane[] = [{ lane: 0, ref: "main", name: "main", status: "main", commits: trunk.length }];
  const branchNodes: TreeNode[] = [];

  const ordered = [...changeSets].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  ordered.forEach((set, i) => {
    const lane = i + 1;
    const status: TreeLane["status"] =
      set.status === "delivered" ? "landed" : set.status === "abandoned" ? "abandoned" : "open";
    lanes.push({ lane, ref: set.id, name: set.name || "(unnamed change set)", status, commits: set.changes.length });

    /*
     * Where the branch was cut. Change sets carry no base commit today — nothing records which
     * state of main they were written against — so the cut is placed at the moment the change
     * set was created, which is the truthful approximation and the thing #138's storage decision
     * would make exact.
     */
    const cut: TreeNode = {
      id: `cut:${set.id}`, lane, row: 0, at: set.createdAt, kind: "cut", ref: set.id,
      title: set.name || "(unnamed change set)", detail: "cut from main", size: 0, entityIds: [],
    };
    branchNodes.push(cut);

    /* Commits on the branch: the changes, folded by the minute they were written in. */
    const byMinute = new Map<string, Change[]>();
    for (const change of [...set.changes].sort((a, b) => ms(b.createdAt) - ms(a.createdAt))) {
      const key = change.createdAt.slice(0, 16);
      byMinute.set(key, [...(byMinute.get(key) ?? []), change]);
    }
    for (const [key, changes] of byMinute) {
      branchNodes.push({
        id: `c:${set.id}:${key}`, lane, row: 0, at: changes[0]!.createdAt,
        kind: "commit", ref: set.id,
        title: describeChanges(changes),
        detail: `${changes.length} change${changes.length === 1 ? "" : "s"}`,
        size: changes.length,
        entityIds: entityIdsOf(changes),
      });
    }

    /* The head: where the branch is now, or where it landed. */
    if (set.status === "delivered" && set.deliveredAt) {
      branchNodes.push({
        id: `merge:${set.id}`, lane, row: 0, at: set.deliveredAt, kind: "merge", ref: set.id,
        title: `${set.name || "A change set"} landed`, detail: "merged into main",
        size: set.changes.length, entityIds: entityIdsOf(set.changes),
      });
    } else if (set.status !== "abandoned") {
      branchNodes.push({
        id: `head:${set.id}`, lane, row: 0, at: set.updatedAt || set.createdAt, kind: "open", ref: set.id,
        title: set.name || "(unnamed change set)",
        detail: set.targetDate ? `open · for ${set.targetDate}` : "open",
        size: set.changes.length, entityIds: entityIdsOf(set.changes),
      });
    }
  });

  /* ---- plateaus are tags on the trunk ----------------------------------------------------- */
  for (const p of plateaus) {
    if (!p.targetDate) continue;
    nodes.push({
      id: `tag:${p.id}`, lane: 0, row: 0, at: `${p.targetDate}T00:00:00.000Z`, kind: "tag", ref: "main",
      title: p.name, detail: "plateau", size: 0, entityIds: [],
    });
  }

  /* ---- one ordering for everything -------------------------------------------------------- */
  /*
   * Time first, then the lane, then the kind. The kind matters because a seeded workspace writes
   * a change set and all its changes in the same millisecond: without it the cut sorted above
   * its own commits, and a branch appeared to start after the work on it. Newest is at the top,
   * so the cut — the oldest thing on a branch — sorts last.
   */
  const rank: Record<TreeKind, number> = { tag: 0, open: 1, merge: 1, commit: 2, cut: 3 };
  const all = [...trunk, ...branchNodes, ...nodes].sort(
    (a, b) => ms(b.at) - ms(a.at) || a.lane - b.lane || rank[a.kind] - rank[b.kind],
  );
  all.forEach((n, i) => { n.row = i; });

  /* Down each lane, newest to oldest. */
  const byLane = new Map<number, TreeNode[]>();
  for (const n of all) byLane.set(n.lane, [...(byLane.get(n.lane) ?? []), n]);
  for (const [, chain] of byLane) {
    for (let i = 0; i < chain.length - 1; i++) edges.push({ from: chain[i]!.id, to: chain[i + 1]!.id, kind: "line" });
  }

  /*
   * And the two edges that make it a tree rather than a set of columns: the cut reaches back to
   * the trunk commit it was taken from, and a merge reaches back to main at the moment it landed.
   * "The trunk commit it was taken from" is the newest one no later than the cut — the state of
   * main as it stood when somebody started writing.
   */
  const trunkAt = (at: string) => trunk.find((t) => ms(t.at) <= ms(at)) ?? trunk[trunk.length - 1];
  for (const n of all) {
    if (n.kind === "cut") {
      const base = trunkAt(n.at);
      if (base) edges.push({ from: n.id, to: base.id, kind: "cut" });
    }
    if (n.kind === "merge") {
      const landed = trunkAt(n.at);
      if (landed) edges.push({ from: n.id, to: landed.id, kind: "merge" });
    }
  }

  return { nodes: all, edges, lanes, rows: all.length };
}
