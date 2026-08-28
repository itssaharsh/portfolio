export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** The one address allowed to write. Enforced again in the database by row level security. */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "saharsh7002@gmail.com";
/** Until the project exists the blog shows an empty state instead of crashing the build. */
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);
