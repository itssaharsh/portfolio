import { isConfigured, ADMIN_EMAIL } from "@/lib/supabase/config";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default function Login() {
  return (
    <main className="mx-auto max-w-[30rem] px-6 py-[clamp(3rem,10vw,7rem)]">
      <h1 className="text-[1.6rem]">Sign in</h1>
      {!isConfigured ? (
        <div className="bg-chalk border border-[#C9C4B2] p-5 mt-6 text-[.9rem] text-ink-2">
          <p className="m-0">Supabase is not connected yet. Set these three values, then come back.</p>
          <pre className="font-mono text-[11.5px] leading-[18px] mt-3 overflow-x-auto">{`NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ADMIN_EMAIL`}</pre>
          <p className="mt-3 mb-0">Run <code>supabase/schema.sql</code> in the SQL editor first. It creates the table, the search index, the rules about who can write, and the image bucket.</p>
        </div>
      ) : (
        <LoginForm adminEmail={ADMIN_EMAIL} />
      )}
    </main>
  );
}
