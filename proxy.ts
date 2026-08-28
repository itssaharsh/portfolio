import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Covers /admin only. The Supabase example redirects every unauthenticated request to a login
 * page, which on a public portfolio would send the homepage and the whole blog there too.
 *
 * This is a convenience, not the security boundary. Server Actions are POSTs to the page they
 * live on and are not separate routes in this chain, so every action checks for itself.
 */
export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/admin/login")) return NextResponse.next();

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
