import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { getStore, storeReady } from "./store";
import type { Post } from "./store/types";
export type { Post } from "./store/types";

marked.setOptions({ gfm: true, breaks: false });

/**
 * marked does not sanitize. Today the only author is Saharsh, so this is self inflicted only,
 * but the moment anything renders text he did not type it is live. Sanitize regardless.
 *
 * sanitize-html rather than DOMPurify: DOMPurify needs a DOM, so the isomorphic wrapper drags in
 * 11MB of jsdom, which failed to load in the serverless function and took the whole blog down with
 * it. This parses with htmlparser2 and needs no DOM at all.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  // The page already has its one h1, the title. If the writer used a single # for sections,
  // every level moves down one, so a section and its parts do not land on the same level.
  const down: Record<string, string> = /<h1[\s>]/.test(html) ? { h1: "h2", h2: "h3", h3: "h4", h4: "h5", h5: "h6" } : {};
  return sanitizeHtml(html, {
    // del matters most: without it the tag is dropped and the words stay, so text the writer
    // crossed out is published as if it were meant
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "h1", "h2", "del", "ins"]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      // without this, numbered steps with a code block between them all come out as step 1
      ol: ["start"],
      th: ["align"],
      td: ["align"],
      code: ["class"],
      span: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      ...down,
      a: (tag, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, ...(attribs.href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {}) },
      }),
    },
  });
}

export function readingTime(text: string): number {
  return Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 220));
}

export function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    // the label and the address are bounded. without a bound, a long run of open brackets takes minutes.
    // scripts/post-text.mjs has the same two lines, and they have to stay the same.
    .replace(/!\[[^\]]{0,500}\]\([^)]{0,2000}\)/g, " ")
    .replace(/\[([^\]]{0,500})\]\([^)]{0,2000}\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(title: string): string {
  // the dash is trimmed again after the cut, so making an address from an address changes nothing
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
}

export let lastReadError: string | null = null;

async function safe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  if (!storeReady()) return fallback;
  // One more try before giving up. The database sleeps, and the homepage keeps whatever this
  // returns for a day, so a first request that only caught it waking should not blank the writing.
  for (let attempt = 1; ; attempt++) {
    try {
      const out = await run();
      lastReadError = null;
      return out;
    } catch (e) {
      lastReadError = e instanceof Error ? e.message : String(e);
      console.error(`[blog] read failed, attempt ${attempt}:`, lastReadError);
      if (attempt >= 2) return fallback;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
}

export const listPublished = (q?: string) => safe<Post[]>([], () => getStore().listPublished(q));
export const getPost = (slug: string) => safe<Post | null>(null, () => getStore().getBySlug(slug));

/**
 * The writing desk's reads. They do not throw either, and they hand back their own error
 * beside what they read. lastReadError is one variable for the whole server, so another
 * request's read can set or clear it between a page's read and its look at it, and the desk
 * must never show an empty list or an empty editor when the truth is that nothing was read.
 * `error` is null when the database answered, with a post or with none.
 */
async function forDesk<T>(nothing: T, run: () => Promise<T>): Promise<{ got: T; error: string | null }> {
  // the same second try as above, for the same reason: the database sleeps
  for (let attempt = 1; ; attempt++) {
    try {
      return { got: await run(), error: null };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`[desk] read failed, attempt ${attempt}:`, error);
      if (attempt >= 2) return { got: nothing, error };
      await new Promise((r) => setTimeout(r, 700));
    }
  }
}

export const listForDesk = () => forDesk<Post[]>([], () => getStore().listAll());
export const getForDesk = (id: string) => forDesk<Post | null>(null, () => getStore().getById(id));
