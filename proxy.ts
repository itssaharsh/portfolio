import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Covers /admin only. The Supabase example redirects every unauthenticated request to a login
 * page, which on a public portfolio would send the homepage and the whole blog there too.
 *
 * This is a convenience, not the security boundary. It sends a signed out page load to the
 * sign in, and that is all it does. Every page of the desk calls signedIn() itself, and every
 * Server Action that reads or changes a post calls requireDesk() itself, so nothing here is
 * what keeps anyone out.
 *
 * A POST is let through, signed in or not. A Server Action is a POST to the page it lives on.
 * Turned away here with a redirect, a save pressed after the sign in had run out never reached
 * savePost, Next's own script could not read the answer, and the editor was replaced by an
 * error page with everything typed behind it. Let through, savePost answers with its sentence
 * and the text stays where it is.
 */
export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/admin/login")) return NextResponse.next();
  if (request.method === "POST") return NextResponse.next();

  const token = request.cookies.get("desk")?.value;
  const secret = process.env.SESSION_SECRET;
  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
      return NextResponse.next();
    } catch { /* fall through to the sign in page */ }
  }
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*"] };
