import { authConfigured } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function Login() {
  return (
    <main className="mx-auto max-w-[30rem] px-6 py-[clamp(3rem,10vw,7rem)]">
      <h1 className="text-[1.6rem]">Sign in</h1>
      {!authConfigured() ? (
        <div className="bg-chalk border border-[#C9C4B2] p-5 mt-6 text-[.9rem] text-ink-2">
          <p className="m-0">Not set up yet. Add these two, then come back.</p>
          <pre className="font-mono text-[11.5px] leading-[18px] mt-3 overflow-x-auto">{`ADMIN_PASSWORD
SESSION_SECRET`}</pre>
          <p className="mt-3 mb-0">Make both with <code>openssl rand -base64 24</code>.</p>
        </div>
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
