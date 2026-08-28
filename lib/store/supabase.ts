import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Post, PostInput, PostStore } from "./types";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Sign in is a password and a signed cookie, so there is no Supabase session for row level
 * security to read. This adapter therefore holds the service role key and never leaves the
 * server. Reads are still filtered to published in the queries below.
 */
const db = () => {
  if (!URL_ || !KEY) throw new Error("Supabase is not configured.");
  return createClient(URL_, KEY, { auth: { persistSession: false } });
};

export const supabaseStore: PostStore = {
  name: "supabase",
  ready: Boolean(URL_ && KEY),

  async listPublished(query) {
    let q = db().from("posts").select("*").eq("published", true).order("published_at", { ascending: false });
    if (query?.trim()) q = q.textSearch("fts", query.trim(), { type: "websearch" });
    const { data } = await q;
    return (data ?? []) as Post[];
  },
  async getBySlug(slug) {
    const { data } = await db().from("posts").select("*").eq("slug", slug).eq("published", true).maybeSingle();
    return (data as Post) ?? null;
  },
  async listAll() {
    const { data } = await db().from("posts").select("*").order("updated_at", { ascending: false });
    return (data ?? []) as Post[];
  },
  async getById(id) {
    const { data } = await db().from("posts").select("*").eq("id", id).maybeSingle();
    return (data as Post) ?? null;
  },
  async upsert(input: PostInput) {
    const { id, ...row } = input;
    const res = id
      ? await db().from("posts").update(row).eq("id", id).select().single()
      : await db().from("posts").insert(row).select().single();
    if (res.error) throw new Error(res.error.message);
    return res.data as Post;
  },
  async remove(id) {
    const { error } = await db().from("posts").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
  async putImage(name, body, contentType) {
    const c = db();
    const { error } = await c.storage.from("post-images").upload(name, body, { contentType, cacheControl: "31536000", upsert: true });
    if (error) throw new Error(error.message);
    return c.storage.from("post-images").getPublicUrl(name).data.publicUrl;
  },
};
