import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { authConfigured, passwordMatches, tooManyWrongGuesses, noteWrongGuess, callerOf } from "@/lib/auth";
import { getStore, storeReady } from "@/lib/store";
import { slugify, toPlainText, readingTime } from "@/lib/posts";
import type { Post } from "@/lib/store/types";
// The command, the site and the desk have to agree on what a second copy is, what a date is,
// what a cover may be, how long a summary is and what a list of tags is stored as. So there
// is one copy of each rule, in the one module all three can import.
import { secondCopy, likeness, isDay, tidyTags, coverFits, SUMMARY_MAX } from "@/scripts/post-text.mjs";

export const runtime = "nodejs";

/* A long post is about 30KB. This is a ceiling against abuse, not a target, and it sits well
   under the 4.5MB that Vercel allows a request body. */
const MAX = 300 * 1024;

const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

/**
 * The proxy only covers /admin, so this checks the password itself, the way every Server
 * Action does. The password travels in a header rather than a cookie, which is why a page on
 * another site cannot make a signed in browser post here on its behalf.
 *
 * Nothing else happens first: no body is read and no address is looked up, so a refusal says
 * nothing about what exists.
 *
 * A request with no password in it is turned away at once and is not counted as a wrong
 * guess. Any page on any site can make the owner's own browser send such requests by the
 * dozen, an image tag is enough, and if they counted, that page could keep the owner's own
 * command locked out. It cannot add the header: that takes a preflight this route never grants.
 */
async function guard(request: NextRequest): Promise<NextResponse | null> {
  if (!authConfigured()) return refuse(503, "ADMIN_PASSWORD and SESSION_SECRET are not set on the server.");
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S/i.test(header)) return refuse(401, "That is not the password.");
  const caller = callerOf(request.headers);
  if (tooManyWrongGuesses(caller)) return refuse(429, "Too many wrong passwords. Wait a minute and try again.");
  const given = header.replace(/^Bearer\s+/i, "");
  if (!passwordMatches(given)) {
    noteWrongGuess(caller);
    await new Promise((r) => setTimeout(r, 400));
    return refuse(401, "That is not the password.");
  }
  if (!storeReady()) return refuse(503, "The database is not connected. Check DATABASE_URL.");
  return null;
}

/**
 * An address typed at the desk before it tidied them is stored as typed. So look for the
 * address as given, then tidied, then for a stored one that tidies to the same thing.
 */
const findAt = (posts: Post[], wanted: string) =>
  posts.find((p) => p.slug === wanted) ??
  posts.find((p) => p.slug === slugify(wanted)) ??
  (slugify(wanted) ? posts.find((p) => slugify(p.slug) === slugify(wanted)) : undefined);

const outline = (p: Post) => ({
  slug: p.slug, title: p.title, body_md: p.body_md, excerpt: p.excerpt, tags: p.tags, published: p.published,
  published_at: p.published_at, cover_url: p.cover_url,
});

/** a real day, or a moment with its time zone written out. the command checks a date line with the same function. */
const isDate = (v: unknown): v is string => typeof v === "string" && isDay(v);

/**
 * Everything, drafts included. The database sleeps when nobody is reading, and now and then
 * the first knock goes unanswered. Asking twice is safe for a read. A write is never retried.
 */
async function readAll(): Promise<Post[]> {
  const store = getStore();
  try {
    return await store.listAll();
  } catch {
    await new Promise((r) => setTimeout(r, 700));
    return store.listAll();
  }
}

/** the database could not be reached at all, as opposed to it answering with a complaint */
const unreachable = (e: unknown) =>
  e instanceof Error && /fetch failed|error connecting to database|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(e.message);

/**
 * What is at an address right now, drafts included. `npm run post` asks this first, so it can
 * say what it is about to replace and keep a copy before anything changes.
 */
export async function GET(request: NextRequest) {
  const stop = await guard(request);
  if (stop) return stop;
  const wanted = (request.nextUrl.searchParams.get("slug") ?? "").trim();
  if (!wanted) return refuse(400, "Say which address with ?slug=");
  try {
    const found = findAt(await readAll(), wanted);
    return NextResponse.json({ ok: true, post: found ? outline(found) : null });
  } catch (e) {
    if (unreachable(e)) return refuse(503, "The site could not reach its database. Nothing was changed. Try again in a moment.");
    return refuse(500, e instanceof Error ? e.message : "Could not read the posts.");
  }
}

/**
 * What `npm run post` sends a finished post to. It saves through the same store and the same
 * helpers as the writing desk, so there is one way a post gets made.
 *
 * Only the title and the text are required, and the rules lean towards doing less:
 *   A new post is a draft unless the request says published.
 *   Anything left out of an update stays as it is on the site: summary, tags, published,
 *   the day it went out, the cover.
 *   A post already at the address keeps its title unless the request says replace.
 *   A request that would make a new post is stopped when a post with the same title lives at
 *   another address, and when one already holds most of this text or this text holds most of
 *   one, because the likeliest reason for any of these is that someone is about to publish a
 *   second copy. Saying separate lets the second kind through. Neither check is made on a post
 *   that is already at the address.
 *   A replace marked fresh starts clean. It inherits nothing from the old post: not its date
 *   or cover, not its tags or summary, and not whether it was out. Fresh without replace
 *   means nothing.
 */
export async function POST(request: NextRequest) {
  const stop = await guard(request);
  if (stop) return stop;

  const raw = await request.text();
  if (raw.length > MAX) return refuse(413, "That is over 300KB of text, which is not a post.");

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return refuse(400, "The body has to be JSON with a title and a body_md.");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  // plain line endings, whatever sent it, so a post always compares equal to the file it came from
  const body_md = typeof body.body_md === "string" ? body.body_md.replace(/\r\n?/g, "\n") : "";
  if (!title) return refuse(400, "A post needs a title.");
  if (title.length > 200) return refuse(400, "That title is over 200 characters.");
  if (!body_md.trim()) return refuse(400, "A post needs some text under the title.");

  if (body.slug !== undefined && typeof body.slug !== "string") return refuse(400, "slug has to be text.");
  if (body.excerpt !== undefined && typeof body.excerpt !== "string") return refuse(400, "excerpt has to be text.");
  if (body.tags !== undefined && !(Array.isArray(body.tags) && body.tags.every((t) => typeof t === "string"))) {
    return refuse(400, "tags has to be a list of words.");
  }
  if (body.published !== undefined && typeof body.published !== "boolean") return refuse(400, "published has to be true or false.");
  if (body.published_at != null && !isDate(body.published_at)) return refuse(400, "published_at has to be a real day, written like 2026-08-28, or a moment with its time zone.");
  if (body.cover_url != null && body.cover_url !== "" && !(typeof body.cover_url === "string" && coverFits(body.cover_url))) {
    return refuse(400, "cover_url has to be an address that starts with http or https, or a path on this site that starts with a slash.");
  }

  const wanted = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : title;
  if (wanted.length > 200) return refuse(400, "That address is over 200 characters.");

  // a blog this size is a handful of rows, and this has to see drafts, which getBySlug does not
  let all: Post[];
  try {
    all = await readAll();
  } catch (e) {
    if (unreachable(e)) return refuse(503, "The site could not reach its database, so nothing was saved. Try again in a moment.");
    return refuse(500, e instanceof Error ? e.message : "Could not read the posts.");
  }

  try {
    const store = getStore();
    const existing = findAt(all, wanted);

    if (existing && existing.title.trim() !== title && body.replace !== true) {
      return refuse(409, `A different post, "${existing.title}", already lives at /blog/${existing.slug}. Pick another address, or say replace.`, {
        existing: { slug: existing.slug, title: existing.title, published: existing.published },
      });
    }
    if (!existing) {
      if (!slugify(wanted)) {
        return refuse(400, wanted === title
          ? "That title has no letters or numbers to make an address from. Pass a slug."
          : "That address has no letters or numbers in it.");
      }
      const twin = all.find((p) => p.title.trim() === title);
      if (twin) {
        return refuse(409, `A post with this title already lives at /blog/${twin.slug}${twin.published ? "" : ", as a draft"}. Send it to that address to change it, or give this one a different title.`, {
          existing: { slug: twin.slug, title: twin.title, published: twin.published },
        });
      }
      // the same writing under a new title, sent from somewhere that does not know it was posted before
      const near = body.separate === true ? undefined : all.find((p) => secondCopy(p.body_md, body_md));
      if (near) {
        // it fires both ways round, and the sentence has to say which: a long new piece that
        // quotes a short post whole is not mostly on the site already
        const mostOfThis = likeness(near.body_md, body_md).ofNext >= 0.5;
        return refuse(409, mostOfThis
          ? `Most of this text is already on the site, in "${near.title}" at /blog/${near.slug}${near.published ? "" : ", a draft"}.`
          : `Most of "${near.title}", the ${near.published ? "post" : "draft"} at /blog/${near.slug}, is inside this text.`, {
          near: true,
          hint: "Send it to that address to change that post, or send separate: true to post it as well.",
          existing: { slug: near.slug, title: near.title, published: near.published },
        });
      }
    }

    // a genuinely different post taking over an address. it must not wear the old one's date and cover.
    const fresh = Boolean(existing) && body.fresh === true && body.replace === true;
    const keep = fresh ? undefined : existing;

    const body_text = toPlainText(body_md);
    const published = typeof body.published === "boolean" ? body.published : keep?.published ?? false;
    const tags = Array.isArray(body.tags) ? tidyTags(body.tags as string[]) : keep?.tags ?? [];
    const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim().slice(0, SUMMARY_MAX) || null : keep?.excerpt ?? null;

    const saved = await store.upsert({
      id: existing?.id,
      // an existing post keeps the address it has, however it was typed
      slug: existing?.slug ?? slugify(wanted),
      title,
      body_md,
      body_text,
      excerpt,
      cover_url: body.cover_url === undefined ? keep?.cover_url ?? null : (body.cover_url as string | null) || null,
      tags,
      published,
      reading_time: readingTime(body_text),
      // The day it first went out is kept, even while it is taken down, so putting it back
      // does not date it today and push it to the top as if it were new. A date in the
      // request wins, which is how a kept copy goes back on the day it was written.
      published_at:
        (isDate(body.published_at) ? new Date(body.published_at).toISOString() : keep?.published_at) ??
        (published ? new Date().toISOString() : null),
    });

    revalidatePath("/");
    revalidatePath("/blog");
    revalidatePath(`/blog/${saved.slug}`);
    revalidatePath("/admin");
    revalidatePath("/sitemap.xml");

    return NextResponse.json({
      ok: true,
      updated: Boolean(existing),
      id: saved.id,
      slug: saved.slug,
      title: saved.title,
      published: saved.published,
      published_at: saved.published_at,
      reading_time: saved.reading_time,
      url: `${request.nextUrl.origin}/blog/${saved.slug}`,
    });
  } catch (e) {
    // a save that silently does nothing is worse than an error, so say exactly what the store said
    if (unreachable(e)) {
      return refuse(503, "The database stopped answering while the post was being saved, so it may or may not have gone through. Run the command again. It looks at what is there before it writes.");
    }
    return refuse(500, e instanceof Error ? e.message : "The post did not save.");
  }
}
