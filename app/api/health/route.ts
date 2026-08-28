import { NextResponse } from "next/server";
import { getStore, storeReady } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Says whether the site can reach its database, and why not if it cannot.
 * Never returns the connection string, only whether it parses and what the driver said.
 */
export async function GET() {
  const store = getStore();
  const raw = process.env.DATABASE_URL ?? "";

  let shape = "missing";
  if (raw) {
    try {
      const u = new URL(raw);
      shape = `${u.protocol}//${u.username ? "user" : "NO USER"}:${u.password ? "***" : "NO PASSWORD"}@${u.hostname}${u.pathname}`;
    } catch {
      shape = "set, but does not parse as a URL";
    }
  }

  const body: Record<string, unknown> = {
    store: store.name,
    configured: storeReady(),
    blogStoreEnv: process.env.BLOG_STORE ?? "(unset, defaulting to neon)",
    databaseUrl: shape,
    pooled: raw.includes("-pooler"),
  };

  if (!storeReady()) {
    body.ok = false;
    body.reason = "The store reports it is not configured. Check DATABASE_URL is set for Production.";
    return NextResponse.json(body, { status: 200 });
  }

  try {
    const posts = await store.listAll();
    body.ok = true;
    body.posts = posts.length;
    body.published = posts.filter((p) => p.published).length;
  } catch (e) {
    body.ok = false;
    body.error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json(body, { status: 200 });
}
