import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, isPublicPath, safeEqual } from "@/lib/access";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Two gates, in order (Next 16 `proxy` convention, formerly `middleware`).
 *
 * 1. The optional shared password (§5.12), if the instance sets one.
 * 2. Being signed in as somebody (§5.41).
 *
 * The second one only checks that a session cookie is **present**. It cannot check that the
 * cookie is *valid*: this runs before the request reaches a route, with no database. That is not
 * a hole — a forged cookie gets past this and then fails at `currentUser()`, which does look the
 * session up and redirects here. The cheap check exists so that the ordinary signed-out visitor
 * is redirected once at the edge instead of rendering a page that immediately redirects.
 *
 * Machine endpoints are excluded by `isPublicPath`: `/api/mcp` carries its own bearer key and
 * `/api/health` must answer a platform probe that has no cookies and cannot follow a redirect.
 */
export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const password = process.env.NEXUS_ACCESS_PASSWORD;
  if (password) {
    const cookie = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
    if (!cookie || !safeEqual(cookie, await accessToken(password))) return to(req, "/login", pathname, search);
  }

  if (!req.cookies.get(SESSION_COOKIE)?.value) return to(req, "/signin", pathname, search);
  return NextResponse.next();
}

function to(req: NextRequest, page: string, pathname: string, search: string) {
  const url = req.nextUrl.clone();
  url.pathname = page;
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets; the finer-grained allowances live in isPublicPath.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
