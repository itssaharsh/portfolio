import "server-only";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { getStore, storeReady } from "./store";
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
 * Read paths degrade to empty rather than throwing, so the site builds and serves before any
 * backend exists. Write paths still throw, because a silent failed save is worse than an error.
 */
export const listPublished = async (q?: string) => (storeReady() ? getStore().listPublished(q) : []);
export const getPost = async (slug: string) => (storeReady() ? getStore().getBySlug(slug) : null);
export const listAll = async () => (storeReady() ? getStore().listAll() : []);
