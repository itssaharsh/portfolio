import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/posts";
import { siteBase } from "@/lib/site";

const base = siteBase();

/** refreshed hourly, so a post published after a deploy still gets listed */
export const revalidate = 3600;

/**
 * The database is asleep most of the time, and a deploy must never fail because it was slow
 * to wake or briefly unreachable. The fixed routes always ship; the posts are a bonus.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: base, priority: 1 },
    { url: `${base}/resume`, priority: 0.9 },
    { url: `${base}/blog`, priority: 0.8 },
  ];
  try {
    const posts = await listPublished();
    return [...fixed, ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: new Date(p.updated_at) }))];
  } catch {
    return fixed;
  }
}
