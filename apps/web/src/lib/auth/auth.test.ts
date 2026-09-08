import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from "./password";
import { sessionId } from "./session-store";

/**
 * The password hash, held to what a password hash has to promise.
 *
 * Written by hand rather than taken from a library, so it is tested like something written by
 * hand: that the same password verifies, that a different one does not, that two people who
 * choose the same password do not get the same row, and that nothing here can be made to throw by
 * a malformed value — a sign-in page that 500s on a broken stored hash locks out the workspace.
 */

describe("hashing a password", () => {
  it("verifies the password it was made from, and nothing else", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("correct horse battery stapl", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts, so the same password twice is two different rows", async () => {
    const a = await hashPassword("the same password");
    const b = await hashPassword("the same password");
    expect(a).not.toBe(b);
    // …and both still verify, which is the point of the salt being stored with the hash.
    expect(await verifyPassword("the same password", a)).toBe(true);
    expect(await verifyPassword("the same password", b)).toBe(true);
  });

  it("carries its own parameters, so the cost can be raised later", async () => {
    const stored = await hashPassword("whatever");
    const [scheme, n, r, p, salt, hash] = stored.split("$");
    expect(scheme).toBe("scrypt");
    expect(Number(n)).toBeGreaterThanOrEqual(16384);
    expect([r, p].map(Number)).toEqual([8, 1]);
    expect(salt!.length).toBeGreaterThan(10);
    expect(hash!.length).toBeGreaterThan(20);
  });

  it("treats the same password written two ways as the same password", async () => {
    // "é" composed vs decomposed: two byte sequences, one thing a person typed.
    const stored = await hashPassword("café-password");
    expect(await verifyPassword("café-password", stored)).toBe(true);
  });

  it("says no to a user with no password rather than throwing", async () => {
    // A row that will sign in through an identity provider later, or one not yet given a password.
    for (const stored of [null, undefined, "", "not-a-hash", "scrypt$x$y$z$q", "scrypt$0$0$0$$", "$$$$$"]) {
      expect(await verifyPassword("anything", stored)).toBe(false);
    }
  });

  it("knows when a stored hash is behind the current cost", async () => {
    expect(needsRehash(await hashPassword("x"))).toBe(false);
    expect(needsRehash("scrypt$1024$8$1$c2FsdA$aGFzaA")).toBe(true);
    expect(needsRehash("bcrypt$whatever")).toBe(true);
    // Nothing to rehash for somebody who has no password at all.
    expect(needsRehash(null)).toBe(false);
  });
});

describe("what we refuse", () => {
  it("asks for length and nothing else", () => {
    expect(passwordProblem("short")).toMatch(/10 characters/);
    expect(passwordProblem("          ")).toBeTruthy();
    expect(passwordProblem("x".repeat(201))).toMatch(/200/);
    // No composition rules: this is a fine password and the product should say so.
    expect(passwordProblem("the quiet grid operator")).toBeNull();
  });
});

describe("session tokens", () => {
  it("stores a hash of the token, never the token", () => {
    const token = "a-token-that-would-work-in-a-cookie";
    const id = sessionId(token);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).not.toContain(token);
    // Deterministic, so a cookie can be looked up; one-way, so a stolen backup is not a key.
    expect(sessionId(token)).toBe(id);
    expect(sessionId(token + "!")).not.toBe(id);
  });
});
