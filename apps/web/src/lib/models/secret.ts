import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Keeping an API key.
 *
 * AES-256-GCM under `NEXUS_SECRET_KEY`, and — the part that matters — **no pretending** when that
 * is not set. Deriving a key from something already in the database and storing it beside the
 * ciphertext is encryption theatre: anyone who can read the row can read the key. So without a
 * secret the value is stored as it is, marked as unencrypted in the row, and the settings page says
 * so in plain words with the variable to set.
 *
 * An administrator who knows their keys are in the clear can decide what to do about it. One who
 * has been told they are encrypted when they are not cannot.
 */

const MARKER = "enc.v1.";

export function secretConfigured(): boolean {
  return Boolean(process.env.NEXUS_SECRET_KEY && process.env.NEXUS_SECRET_KEY.length >= 16);
}

function key(): Buffer {
  // A passphrase of any length becomes 32 bytes; the hash is a key-derivation of convenience, not
  // a password hash — the secret is expected to be a generated value, not something memorable.
  return createHash("sha256").update(String(process.env.NEXUS_SECRET_KEY)).digest();
}

/** Encrypt, when we can. Returns the value and whether it is really encrypted. */
export function seal(plain: string): { stored: string; encrypted: boolean } {
  if (!plain) return { stored: "", encrypted: false };
  if (!secretConfigured()) return { stored: plain, encrypted: false };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { stored: `${MARKER}${iv.toString("base64url")}.${tag.toString("base64url")}.${body.toString("base64url")}`, encrypted: true };
}

/**
 * Decrypt, or return what is there.
 *
 * A sealed value that cannot be opened returns empty rather than throwing: the usual cause is
 * `NEXUS_SECRET_KEY` having changed, and the right behaviour then is "this provider has no key,
 * set it again" rather than a page that will not render.
 */
export function open(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith(MARKER)) return stored;
  if (!secretConfigured()) return "";
  const [ivPart, tagPart, bodyPart] = stored.slice(MARKER.length).split(".");
  if (!ivPart || !tagPart || !bodyPart) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(bodyPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** Whether a stored value is really encrypted, for telling somebody the truth about it. */
export const isSealed = (stored: string) => stored.startsWith(MARKER);

/**
 * Enough of a key to recognise it, and never enough to use it.
 *
 * Shown so an administrator can tell which key is in the box without the box being a way to read
 * one back out.
 */
export function hint(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 8) return "•".repeat(plain.length);
  return `${plain.slice(0, 4)}…${plain.slice(-4)}`;
}
