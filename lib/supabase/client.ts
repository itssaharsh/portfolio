"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON, isConfigured } from "./config";

export function supabaseBrowser() {
  if (!isConfigured) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
}
