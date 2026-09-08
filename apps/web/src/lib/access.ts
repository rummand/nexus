/**
 * Optional shared-password gate for a deployed instance.
 *
 * Since rev 76 every person signs in as themselves (§5.41), so this is no longer what keeps a
 * deployment private — it is a second door in front of the first. It still earns its place: an
 * instance on the open internet with a shared password in front of it is not enumerable at all,
 * which is a different and useful property from "you need an account". Setting
 * NEXUS_ACCESS_PASSWORD turns it on; leaving it unset changes nothing.
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
    pathname === "/signin" ||
    pathname === "/signout" ||
    pathname === "/api/health" || // the platform health check must never be redirected
    /*
     * The MCP endpoint carries its own key (§5.33) and is called by machines, which cannot follow
     * a redirect to a login form. The shared password is a gate for browsers; this one is bearer
     * authentication, and it is stricter — no key, no answer, whatever the password is set to.
     */
    pathname === "/api/mcp" ||
    pathname.startsWith("/_next/") ||
    /*
     * Static files under `public/`.
     *
     * Not a convenience — a correctness fix. Next's image optimiser fetches the *source* image
     * over HTTP, so with `/docs/board.png` behind the gate the optimiser's own request was
     * redirected to the sign-in page and every screenshot in the documentation failed to render.
     * Static files are files: they carry no user data, they are baked into the image, and they
     * are exactly what `public/` means. Pages and API routes have no extension, so this cannot
     * open one by accident.
     */
    STATIC_FILE.test(pathname)
  );
}

const STATIC_FILE = /\.(png|jpe?g|gif|svg|webp|avif|ico|txt|xml|webmanifest|woff2?|ttf|otf|map)$/i;
