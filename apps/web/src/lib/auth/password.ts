import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/*
 * `promisify` picks the three-argument overload, which drops the cost parameters on the floor.
 * Naming the shape we actually call keeps them.
 */
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Passwords, hashed properly and by hand.
 *
 * No dependency: `scrypt` has been in Node's standard library for years, it is memory-hard by
 * design, and the whole of what a password hash has to do fits in forty lines. Adding argon2 or
 * bcrypt here would mean a native module in the Docker image and a supply-chain surface, in
 * exchange for a difference nobody in this product can measure.
 *
 * The stored form carries its own parameters — `scrypt$N$r$p$salt$hash` — so the cost can be
 * raised later without invalidating everybody's password: an old hash still says how to check
 * itself, and `needsRehash` says when to write a new one on the next successful sign-in.
 */

/** Cost, chosen so a check takes a few hundred milliseconds on a small container. */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  // maxmem must be raised for these parameters or Node refuses with a bare "Invalid params".
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/**
 * Is this the password behind that hash?
 *
 * Never throws on a malformed or empty stored hash — a user row with no password (one that will
 * sign in through an identity provider later, or one that has not been given a password yet) must
 * simply fail to sign in, not crash the sign-in page for everybody.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, expected] = parts as [string, string, string, string, string, string];
  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  // Positive, not merely numeric: `scrypt$0$0$0$$` parses fine and is not a hash of anything.
  if (![cost.N, cost.r, cost.p].every((v) => Number.isInteger(v) && v > 0)) return false;

  try {
    const want = Buffer.from(expected, "base64url");
    /*
     * A stored digest must be long enough to mean something. Without this, an empty one compares
     * equal to an empty derived key and every password "matches" — the kind of hole that only
     * ever appears through a truncated column or a hand-edited row, and exactly the kind that
     * would never be noticed.
     */
    if (want.length < 16) return false;
    const got = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64url"), want.length, {
      ...cost,
      maxmem: 256 * 1024 * 1024,
    });
    // Constant time: a length-sensitive compare leaks how much of a guess was right.
    return want.length === got.length && timingSafeEqual(want, got);
  } catch {
    return false;
  }
}

/** True when a stored hash was made with weaker parameters than we use now. */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < N || Number(parts[2]) < R || Number(parts[3]) < P;
}

/**
 * What we refuse to accept, and why each one.
 *
 * Deliberately short. Composition rules ("one capital, one digit, one symbol") are known to push
 * people towards `Password1!` and away from length, which is the only thing that reliably helps.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters. Length is the part that matters.";
  if (password.length > 200) return "That is longer than 200 characters.";
  if (!password.trim()) return "That is only whitespace.";
  return null;
}
