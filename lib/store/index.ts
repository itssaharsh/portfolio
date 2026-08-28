import "server-only";
import type { PostStore } from "./types";
import { neonStore } from "./neon";
import { supabaseStore } from "./supabase";

/**
 * BLOG_STORE picks the backend. Nothing else in the app knows which one is in use.
 *   neon      Neon Postgres plus Vercel Blob   (the default while Supabase is busy)
 *   supabase  Supabase Postgres plus Storage
 */
export function getStore(): PostStore {
  const want = (process.env.BLOG_STORE ?? "neon").toLowerCase();
  return want === "supabase" ? supabaseStore : neonStore;
}

export const storeReady = () => getStore().ready;
export type { Post, PostInput, PostStore } from "./types";
