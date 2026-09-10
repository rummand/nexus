import { describe, expect, it } from "vitest";
import {
  DORMANT_DAYS, deletionCost, mayDropOperator, slugProblem, slugify, stateWhy, tenantState, totals,
  type Account, type Tenant,
} from "./platform";

const NOW = new Date("2026-09-10T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const tenant = (over: Partial<Tenant> = {}): Tenant => ({
  id: "ws_1", slug: "acme", name: "Acme", createdAt: daysAgo(400),
  people: 4, owners: 1, boards: 6, entities: 120, relations: 90, lastActivityAt: daysAgo(1),
  ...over,
});

const account = (over: Partial<Account> = {}): Account => ({
  id: "usr_1", name: "Jesper", email: "jesper@acme.example", platformRole: null,
  signsIn: true, sessions: 1, createdAt: daysAgo(300), memberships: [],
  ...over,
});

describe("what a tenant is doing", () => {
  it("calls a tenant with nothing in it empty, however recently it was touched", () => {
    // The state that matters most to an operator: somebody was set up and never got started.
    expect(tenantState(tenant({ boards: 0, entities: 0, lastActivityAt: daysAgo(0) }), NOW)).toBe("empty");
  });

  it("calls a tenant that has stopped being touched dormant", () => {
    expect(tenantState(tenant({ lastActivityAt: daysAgo(DORMANT_DAYS + 1) }), NOW)).toBe("dormant");
  });

  it("leaves a tenant inside the threshold alone, so a fortnight's holiday is not an alarm", () => {
    expect(tenantState(tenant({ lastActivityAt: daysAgo(DORMANT_DAYS - 1) }), NOW)).toBe("active");
  });

  it("treats content with no date at all as dormant rather than active", () => {
    expect(tenantState(tenant({ lastActivityAt: null }), NOW)).toBe("dormant");
  });

  it("says why in words, with the number a person would ask for", () => {
    expect(stateWhy(tenant({ lastActivityAt: daysAgo(45) }), NOW)).toMatch(/45 days/);
    expect(stateWhy(tenant({ boards: 0, entities: 0 }), NOW)).toMatch(/nothing has been put in it/i);
    expect(stateWhy(tenant(), NOW)).toBe("In use.");
  });
});

describe("the platform in one line", () => {
  it("adds the tenants up and counts the people once, not once per membership", () => {
    const t = totals(
      [tenant({ boards: 6, entities: 120, relations: 90 }), tenant({ id: "ws_2", boards: 2, entities: 8, relations: 3 })],
      [
        account({ memberships: [{ workspaceId: "ws_1", slug: "acme", name: "Acme", role: "owner" }, { workspaceId: "ws_2", slug: "b", name: "B", role: "admin" }] }),
        account({ id: "usr_2", platformRole: "operator", sessions: 3 }),
      ],
    );
    expect(t.tenants).toBe(2);
    expect(t.people).toBe(2);
    expect(t.operators).toBe(1);
    expect(t.boards).toBe(8);
    expect(t.entities).toBe(128);
    expect(t.relations).toBe(93);
    expect(t.sessions).toBe(4);
  });

  it("counts the accounts that cannot sign in, because that is the one an operator has to act on", () => {
    const t = totals([], [account(), account({ id: "usr_2", signsIn: false }), account({ id: "usr_3", signsIn: false })]);
    expect(t.cannotSignIn).toBe(2);
  });
});

describe("addresses", () => {
  it("makes a usable address out of a company name, accents and punctuation included", () => {
    expect(slugify("Energinet Ådalen A/S")).toBe("energinet-adalen-a-s");
    expect(slugify("  Nordic Grid  ")).toBe("nordic-grid");
  });

  it("never produces something the router would swallow", () => {
    for (const name of ["", "///", "—", "..."]) expect(slugProblem(slugify(name))).not.toBeNull();
  });

  it("refuses the addresses the application itself uses", () => {
    expect(slugProblem("admin")).toMatch(/reserved/);
    expect(slugProblem("api")).toMatch(/reserved/);
    expect(slugProblem("acme-energy")).toBeNull();
  });

  it("refuses shapes a URL cannot carry", () => {
    expect(slugProblem("Acme")).toMatch(/lower-case/);
    expect(slugProblem("-acme")).toMatch(/lower-case/);
    expect(slugProblem("acme-")).toMatch(/lower-case/);
    expect(slugProblem("a")).toMatch(/too short/);
  });
});

describe("the last operator", () => {
  it("cannot be demoted, because nobody could put them back", () => {
    const only = [account({ id: "op", platformRole: "operator" }), account({ id: "usr_2" })];
    expect(mayDropOperator(only, "op")).toMatch(/only operator/i);
  });

  it("can once there is a second one", () => {
    const two = [account({ id: "op", platformRole: "operator" }), account({ id: "op2", platformRole: "operator" })];
    expect(mayDropOperator(two, "op")).toBeNull();
  });

  it("says nothing about somebody who is not an operator at all", () => {
    expect(mayDropOperator([account({ id: "op", platformRole: "operator" })], "someone-else")).toBeNull();
  });
});

describe("deleting a tenant", () => {
  it("says what would go with it, singular and plural, because the operator cannot look inside", () => {
    expect(deletionCost(tenant())).toBe("4 people, 6 boards, 120 objects, 90 relations");
    expect(deletionCost(tenant({ people: 1, boards: 1, entities: 1, relations: 1 })))
      .toBe("1 person, 1 board, 1 object, 1 relation");
  });
});
