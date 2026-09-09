import { describe, expect, it } from "vitest";
import { allows, capabilitiesOf, CAPABILITIES, isRole, mayGrant, refusal, ROLES, type Capability } from "./roles";

/**
 * The matrix, argued with.
 *
 * These are not tests of an implementation — `allows` is a lookup — they are the product decision
 * written down where it can be reviewed. If somebody changes what a member may do, one of these
 * fails and the change becomes deliberate rather than incidental.
 */

const admin: Capability[] = ["graph.delete", "agent.manage", "import.approve", "plan.deliver", "settings.manage"];

describe("what each role may do", () => {
  it("lets a guest read, and say something, and nothing else", () => {
    /*
     * The one power a guest has (§5.50). "Reads everything and changes nothing" described the
     * wrong person: the reviewer you invite to look at an architecture is exactly the one with
     * something to say about it, and a comment changes no model data.
     */
    expect(allows("guest", "board.comment")).toBe(true);
    for (const cap of CAPABILITIES.filter((c) => c !== "board.comment")) expect(allows("guest", cap), cap).toBe(false);
  });

  it("lets a member work, and not administer", () => {
    for (const cap of ["board.edit", "board.comment", "graph.edit", "agent.run"] as Capability[]) expect(allows("member", cap), cap).toBe(true);
    // The line is consequence outside the screen you are on: approving an import rewrites the
    // estate everybody else is reading.
    for (const cap of admin) expect(allows("member", cap), cap).toBe(false);
    expect(allows("member", "people.manage")).toBe(false);
  });

  it("lets an admin administer, but not hand out roles", () => {
    for (const cap of admin) expect(allows("admin", cap), cap).toBe(true);
    expect(allows("admin", "people.manage")).toBe(false);
  });

  it("lets an owner do everything there is", () => {
    for (const cap of CAPABILITIES) expect(allows("owner", cap), cap).toBe(true);
  });

  it("lets everybody who is in the workspace comment", () => {
    // The floor: if a role cannot say anything, inviting somebody to review is pointless.
    for (const role of ROLES) expect(allows(role, "board.comment"), role).toBe(true);
  });

  it("refuses somebody who is not a member at all", () => {
    for (const cap of CAPABILITIES) {
      expect(allows(null, cap), cap).toBe(false);
      expect(allows("bystander" as never, cap), cap).toBe(false);
    }
    expect(capabilitiesOf(undefined)).toEqual([]);
  });

  it("names every role in the matrix, so a new one cannot default to permitted", () => {
    for (const role of ROLES) expect(capabilitiesOf(role).every((c) => (CAPABILITIES as readonly string[]).includes(c))).toBe(true);
    expect(isRole("owner")).toBe(true);
    expect(isRole("root")).toBe(false);
  });
});

describe("handing out roles", () => {
  it("only lets an owner make another owner", () => {
    // Otherwise the first administrator can quietly take the workspace.
    expect(mayGrant("owner", "owner")).toBe(true);
    expect(mayGrant("admin", "owner")).toBe(false);
    expect(mayGrant("owner", "admin")).toBe(true);
  });

  it("does not let somebody who cannot manage people hand out anything", () => {
    for (const role of ROLES) expect(mayGrant("member", role), role).toBe(false);
    for (const role of ROLES) expect(mayGrant("guest", role), role).toBe(false);
    for (const role of ROLES) expect(mayGrant(null, role), role).toBe(false);
  });
});

describe("saying no", () => {
  it("says what was refused and who to ask", () => {
    expect(refusal("import.approve", "member")).toBe("A member may not approve or roll back an import. Ask an administrator.");
    expect(refusal("people.manage", "admin")).toBe("An administrator may not manage the people in this workspace. Ask an owner.");
    expect(refusal("graph.edit", null)).toBe("Somebody who is not a member of this workspace may not change the model. Ask an owner.");
    // "A administrator" is the sort of thing nobody notices until a customer screenshots it.
    expect(refusal("plan.deliver", "admin").startsWith("An ")).toBe(true);
  });
});
