import "server-only";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { getStore, storeReady } from "./store";
import type { Post } from "./store/types";
export type { Post } from "./store/types";

marked.setOptions({ gfm: true, breaks: false });

/**
 * marked does not sanitize. Today the only author is Saharsh, so this is self inflicted only,
 * but the moment anything renders text he did not type it is live. Sanitize regardless.
 */
export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string, {
    ADD_ATTR: ["target", "rel"],
  });
}

export function readingTime(text: string): number {
  return Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 220));
}

export function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

/**
 * Read paths never throw. A portfolio blog that answers 500 because a database was asleep or a
 * connection string was mistyped is worse than one that quietly shows nothing. Write paths still
 * throw, because a save that silently does nothing is worse than an error.
 *
 * The reason is logged, so it is visible in the Vercel function logs, and exposed through
 * /api/health without ever revealing the credential.
 */
export let lastReadError: string | null = null;

async function safe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  if (!storeReady()) return fallback;
  try {
    const out = await run();
    lastReadError = null;
    return out;
  } catch (e) {
    lastReadError = e instanceof Error ? e.message : String(e);
    console.error("[blog] read failed:", lastReadError);
    return fallback;
  }
}

export const listPublished = (q?: string) => safe<Post[]>([], () => getStore().listPublished(q));
export const getPost = (slug: string) => safe<Post | null>(null, () => getStore().getBySlug(slug));
export const listAll = () => safe<Post[]>([], () => getStore().listAll());
