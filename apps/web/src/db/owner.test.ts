import { describe, expect, it } from "vitest";
import { ownerFromEnv, ownerLine } from "./owner";

/**
 * Bootstrapping the first real account (§5.61).
 *
 * The two properties worth holding: it does nothing unless it is asked, and it never resets a
 * password by accident — a stale variable in a deployment's configuration must not quietly undo
 * every password change anybody has made.
 */

describe("what the environment asks for", () => {
  it("asks for nothing when the variables are absent", () => {
    expect(ownerFromEnv({})).toBeNull();
    expect(ownerFromEnv({ NEXUS_OWNER_EMAIL: "a@b.test" })).toBeNull();
    expect(ownerFromEnv({ NEXUS_OWNER_PASSWORD: "long enough" })).toBeNull();
  });

  it("ignores an email that is not one, rather than making an account nobody can reach", () => {
    expect(ownerFromEnv({ NEXUS_OWNER_EMAIL: "not-an-email", NEXUS_OWNER_PASSWORD: "long enough" })).toBeNull();
  });

  it("lower-cases and trims the address, because sign-in does too", () => {
    expect(ownerFromEnv({ NEXUS_OWNER_EMAIL: "  Jes@Acme.TEST ", NEXUS_OWNER_PASSWORD: "long enough" })?.email)
      .toBe("jes@acme.test");
  });

  it("makes a readable name from the address when none is given", () => {
    expect(ownerFromEnv({ NEXUS_OWNER_EMAIL: "jesper.olesen@acme.test", NEXUS_OWNER_PASSWORD: "long enough" })?.name)
      .toBe("Jesper Olesen");
  });

  it("prefers the name it was given", () => {
    expect(ownerFromEnv({ NEXUS_OWNER_EMAIL: "a@b.test", NEXUS_OWNER_PASSWORD: "long enough", NEXUS_OWNER_NAME: "Ada" })?.name)
      .toBe("Ada");
  });

  it("does not reset an existing password unless it is told to, twice over", () => {
    const base = { NEXUS_OWNER_EMAIL: "a@b.test", NEXUS_OWNER_PASSWORD: "long enough" };
    expect(ownerFromEnv(base)?.reset).toBe(false);
    expect(ownerFromEnv({ ...base, NEXUS_OWNER_PASSWORD_RESET: "true" })?.reset).toBe(false);
    expect(ownerFromEnv({ ...base, NEXUS_OWNER_PASSWORD_RESET: "1" })?.reset).toBe(true);
  });
});

describe("what it writes to the log", () => {
  it("says nothing when it did nothing", () => {
    expect(ownerLine({ status: "off" })).toBeNull();
    expect(ownerLine({ status: "present", email: "a@b.test", workspaces: 1 })).toBeNull();
  });

  it("says what it did, and never what the password was", () => {
    const lines = [
      ownerLine({ status: "created", email: "a@b.test", workspaces: 2 }),
      ownerLine({ status: "reset", email: "a@b.test", workspaces: 2 }),
      ownerLine({ status: "joined", email: "a@b.test", workspaces: 2 }),
      ownerLine({ status: "refused", why: "NEXUS_OWNER_PASSWORD must be at least 8 characters." }),
    ];
    for (const l of lines) expect(l).toBeTruthy();
    expect(lines[0]).toMatch(/created owner a@b\.test/);
    expect(lines[3]).toMatch(/not applied/);
    // The password never appears in any of them: these carry an email and a count, nothing else.
    for (const l of lines) expect(l).not.toMatch(/password[^ ]/i);
  });
});
