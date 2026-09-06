/**
 * Optional shared-password gate for a deployed instance.
 *
 * Brief 1 has no per-user authentication (see docs/BRIEF.md §7); until it does, a public
 * deployment is world-editable. Setting NEXUS_ACCESS_PASSWORD puts a single shared password in
 * front of the whole app. Leaving it unset changes nothing — local development and the seeded
 * demo keep working with no login.
 *
 * The cookie holds an HMAC of a fixed message keyed by the password, so it can be verified
 * without any session storage, and the password itself never leaves the server.
 */

export const ACCESS_COOKIE = "nexus_access";
const MESSAGE = "nexus-access-v1";

/** Web Crypto (not node:crypto) so this also runs in the edge middleware runtime. */
export async function accessToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(MESSAGE));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-independent comparison so a wrong cookie cannot be probed byte by byte. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Paths that must stay reachable without the cookie, or the gate locks out its own login page. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/health" || // the platform health check must never be redirected
    /*
     * The MCP endpoint carries its own key (§5.33) and is called by machines, which cannot follow
     * a redirect to a login form. The shared password is a gate for browsers; this one is bearer
     * authentication, and it is stricter — no key, no answer, whatever the password is set to.
     */
    pathname === "/api/mcp" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}
