import { SITE_URL } from "@/content/data";

/**
 * The address the site is served from, for the sitemap, robots.txt and link previews.
 *
 * NEXT_PUBLIC_SITE_URL wins only when it holds a real address. In production it has been set
 * but EMPTY since launch, and `process.env.X ?? fallback` lets an empty string straight through:
 * the live sitemap went out with relative addresses, and `new URL("")` would have failed the
 * build outright. So this checks the value instead of trusting that it is there.
 */
export function siteBase(): string {
  const given = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (given) {
    try {
      const u = new URL(given);
      // "localhost:3000" parses, with "localhost:" as its scheme and the text "null" as its origin
      if (u.protocol === "https:" || u.protocol === "http:") return u.origin;
    } catch { /* not an address. fall through. */ }
  }
  return SITE_URL;
}
