import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * One person signs in. Not a user system.
 *
 * A password in an environment variable, checked in a Server Action, issued as a signed
 * httpOnly cookie. This is what the Next.js authentication guide recommends for exactly this,
 * and Server Actions compare Origin against Host, so cross site request forgery is handled.
 *
 * Deliberately independent of where the posts are stored, so swapping the store later does
 * not touch any of this.
 *
 * To sign every session out everywhere, change SESSION_SECRET.
 */

const COOKIE = "desk";
const DAYS = 7;

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
export const authConfigured = () => Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET);

/** hash both sides first so the buffers are the same length and the compare cannot leak it */
export function passwordMatches(given: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function startSession() {
  const token = await new SignJWT({ desk: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function signedIn(): Promise<boolean> {
  if (!authConfigured()) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.desk === true;
  } catch {
    return false;
  }
}

/**
 * Server Actions are POSTs to the page they live on, so the proxy matcher does not cover them.
 * Every action calls this itself rather than trusting the proxy.
 */
export async function requireDesk() {
  if (!(await signedIn())) throw new Error("Not signed in.");
}
