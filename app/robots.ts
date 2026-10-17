import type { MetadataRoute } from "next";
import { siteBase } from "@/lib/site";
const base = siteBase();
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/auth"] }], sitemap: `${base}/sitemap.xml` };
}
