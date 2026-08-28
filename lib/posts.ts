import { marked } from "marked";
import { supabaseServer } from "./supabase/server";

export type Post = {
  id: string; slug: string; title: string; excerpt: string | null;
  body_md: string; body_text: string; cover_url: string | null;
  tags: string[]; published: boolean; reading_time: number;
  created_at: string; updated_at: string; published_at: string | null;
};

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

/** words per minute is a convention, not a measurement, so it is rounded honestly */
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

export async function listPublished(query?: string): Promise<Post[]> {
  const sb = await supabaseServer();
  if (!sb) return [];
  let q = sb.from("posts").select("*").eq("published", true).order("published_at", { ascending: false });
  if (query && query.trim()) q = q.textSearch("fts", query.trim(), { type: "websearch" });
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as Post[];
}

export async function getPost(slug: string): Promise<Post | null> {
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.from("posts").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  return (data as Post) ?? null;
}

export async function listAll(): Promise<Post[]> {
  const sb = await supabaseServer();
  if (!sb) return [];
  const { data } = await sb.from("posts").select("*").order("updated_at", { ascending: false });
  return (data ?? []) as Post[];
}
