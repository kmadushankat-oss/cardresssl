import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Bounces signed-out visitors away from the dashboard before the page renders,
 * preserving where they were heading so they land there after signing in.
 *
 * This is a convenience, not the security boundary: it only checks that a
 * session cookie is *present*. The real checks are `requireStaff()` and
 * `requirePermission()` in the layout, pages and server actions, which verify
 * the session against the database and test the user's role.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (getSessionCookie(request)) return NextResponse.next();

  const signIn = new URL("/admin/sign-in", request.url);
  signIn.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    // Everything under /admin except the sign-in page itself and static assets.
    "/admin",
    "/admin/((?!sign-in).*)",
  ],
};
