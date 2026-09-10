/**
 * Who may do what (§5.46).
 *
 * `workspace_members.role` has been in the schema since the first week and nothing read it: anybody
 * who could sign in could issue an MCP key, point the product at a different model, approve an
 * import, deliver a change set and delete an object from the estate. That is the largest gap
 * between what this product looks like it enforces and what it did.
 *
 * The model is capabilities rather than role checks, for one reason: a role check scattered through
 * ninety server actions is ninety places to be inconsistent, and the inconsistency is invisible
 * until somebody finds it. A capability is a sentence about the product — "may approve an import" —
 * and the matrix below is the only place a role turns into one.
 *
 * The line the roles are drawn along is **consequence outside this screen**. Drawing on a board
 * affects a board. Approving an import rewrites the estate everybody else is reading; issuing a key
 * hands a stranger's agent a door; delivering a plan moves the model into the future. Those are the
 * administrative half, and they are what separates a member from an admin.
 *
 * Pure, so the matrix can be argued with in a test rather than discovered in production.
 */

export const ROLES = ["owner", "admin", "member", "guest"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  /** Draw on a board: elements, layout, viewpoints, remarks. */
  "board.edit",
  /**
   * Say something about a board or a thing on it (§5.50).
   *
   * A capability of its own, and the only one a **guest** has. "Reads everything and changes
   * nothing" turned out to describe the wrong person: the reviewer you invite to look at an
   * architecture is exactly the person with something to say about it, and a comment changes no
   * model data. Giving a guest a voice makes the role useful without making it dangerous.
   */
  "board.comment",
  /** Change the model directly — an entity's fields, a relation, an attribute, the meta-model. */
  "graph.edit",
  /** Remove something from the model, or merge two objects into one. Not reversible. */
  "graph.delete",
  /** Ask an agent to run, and accept or dismiss what it proposes. */
  "agent.run",
  /** Write, approve, pause and retire described agents. */
  "agent.manage",
  /** Write a staged batch into the model, or roll one back. */
  "import.approve",
  /** Apply a change set to the graph. */
  "plan.deliver",
  /** Write, move or delete a wiki page (§5.60). */
  "wiki.edit",
  /** Model providers, connected servers, MCP keys, source grants. */
  "settings.manage",
  /** Invite people, change their role, reset a password. */
  "people.manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * What each role may do.
 *
 * Written out in full rather than by inheritance. A reader asking "can a member deliver a change
 * set?" should be able to answer it by looking, not by composing three spread operators in their
 * head — and the day somebody wants an admin who cannot manage people, the table is where they
 * will look.
 */
const MATRIX: Record<Role, readonly Capability[]> = {
  guest: ["board.comment"],
  member: ["board.edit", "board.comment", "graph.edit", "agent.run", "wiki.edit"],
  admin: ["board.edit", "board.comment", "graph.edit", "graph.delete", "agent.run", "agent.manage", "import.approve", "plan.deliver", "wiki.edit", "settings.manage"],
  owner: ["board.edit", "board.comment", "graph.edit", "graph.delete", "agent.run", "agent.manage", "import.approve", "plan.deliver", "wiki.edit", "settings.manage", "people.manage"],
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/** May somebody with this role do this? A role that is not a role may do nothing. */
export function allows(role: Role | null | undefined, capability: Capability): boolean {
  if (!isRole(role)) return false;
  return MATRIX[role].includes(capability);
}

/** Everything this role may do — for hiding what a person cannot use rather than letting them fail. */
export function capabilitiesOf(role: Role | null | undefined): Capability[] {
  return isRole(role) ? [...MATRIX[role]] : [];
}

/** Whether one role can hand out another. Nobody may promote somebody above themselves. */
export function mayGrant(actor: Role | null | undefined, target: Role): boolean {
  if (!allows(actor, "people.manage")) return false;
  // Only an owner may make another owner; otherwise the first admin could take the workspace.
  return actor === "owner" || target !== "owner";
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  member: "Member",
  guest: "Guest",
};

export const ROLE_BLURB: Record<Role, string> = {
  owner: "Everything an administrator can do, and manages the people.",
  admin: "Runs the workspace: imports, plans, agents, models and connections.",
  member: "Draws on boards and edits the model. Cannot approve, deliver or configure.",
  guest: "Reads everything and can comment. Changes nothing else.",
};

/** What to say when somebody is refused, in words rather than a status code. */
export function refusal(capability: Capability, role: Role | null | undefined): string {
  const article = (word: string) => (/^[aeiou]/i.test(word) ? "An" : "A");
  const label = isRole(role) ? ROLE_LABEL[role].toLowerCase() : "";
  const what: Record<Capability, string> = {
    "board.edit": "change a board",
    "board.comment": "comment here",
    "graph.edit": "change the model",
    "graph.delete": "delete from the model",
    "agent.run": "run an agent",
    "agent.manage": "manage agents",
    "import.approve": "approve or roll back an import",
    "plan.deliver": "deliver a change set",
    "wiki.edit": "write in the wiki",
    "settings.manage": "change this workspace's settings",
    "people.manage": "manage the people in this workspace",
  };
  const subject = label ? `${article(label)} ${label}` : "Somebody who is not a member of this workspace";
  const ask = role === "member" ? "an administrator" : "an owner";
  return `${subject} may not ${what[capability]}. Ask ${ask}.`;
}
