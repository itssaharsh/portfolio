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

/*
 * A brake on guessing, counted for each caller. Once one caller has sent twenty wrong passwords
 * inside a minute, nothing more from that caller is checked until the minute has passed, not
 * even the right one, so a flood of guesses cannot be tested as fast as it arrives.
 *
 * It is counted per caller because the first version was one count for everybody, and twenty
 * requests from anyone at all, with no password in them, shut the owner out for a minute.
 * Someone else's wrong guesses now close the door only on themselves.
 *
 * It lives in memory, so there is one count per server instance, and one per door: the sign
 * in form and /api/posts are built separately and each holds its own. That makes it a brake
 * and not a wall. The wall is a long random password.
 */
const WINDOW_MS = 60_000;
const WRONG_ALLOWED = 20;
const CALLERS_KEPT = 5000;
const wrong = new Map<string, number[]>();

/**
 * Who is asking. Vercel writes x-forwarded-for itself, so a caller cannot choose it there.
 * Anything that arrives without one, such as a request on localhost, shares a single count.
 */
export function callerOf(headers: { get(name: string): string | null }): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooManyWrongGuesses(caller: string, now = Date.now()): boolean {
  const recent = (wrong.get(caller) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length) wrong.set(caller, recent);
  else wrong.delete(caller);
  return recent.length >= WRONG_ALLOWED;
}

export function noteWrongGuess(caller: string, now = Date.now()) {
  wrong.set(caller, [...(wrong.get(caller) ?? []), now]);
  // a flood from many addresses must not grow this without end. the oldest callers go first.
  for (const key of wrong.keys()) {
    if (wrong.size <= CALLERS_KEPT) break;
    wrong.delete(key);
  }
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
 * Server Actions are POSTs to the page they live on, and the proxy lets every POST through, so
 * nothing stands in front of them. Every action that reads or changes a post calls this itself.
 */
export async function requireDesk() {
  if (!(await signedIn())) throw new Error("Not signed in.");
}
