import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken, isPublicPath, safeEqual } from "@/lib/access";

/**
 * Shared-password gate (Next 16 `proxy` convention, formerly `middleware`). Inactive unless
 * NEXUS_ACCESS_PASSWORD is set, so development and the seeded demo are unaffected.
 * See src/lib/access.ts.
 */
export default async function proxy(req: NextRequest) {
  const password = process.env.NEXUS_ACCESS_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await accessToken(password))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets; the finer-grained allowances live in isPublicPath.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
