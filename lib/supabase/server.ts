import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON, isConfigured } from "./config";

export async function supabaseServer() {
  if (!isConfigured) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* called from a Server Component; the proxy refreshes the session instead */ }
      },
    },
  });
}

/**
 * Never trust getSession() in server code, it is not guaranteed to revalidate the token.
 * getUser() goes to the auth server.
 */
export async function currentUser() {
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}
