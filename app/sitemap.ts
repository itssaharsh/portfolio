import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/posts";
const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saharsh.vercel.app";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublished();
  return [
    { url: base, priority: 1 },
    { url: `${base}/blog`, priority: 0.8 },
    { url: `${base}/resume`, priority: 0.9 },
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: new Date(p.updated_at) })),
  ];
}
