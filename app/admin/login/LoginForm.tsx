"use client";
import { useActionState } from "react";
import { signIn } from "../actions";

export default function LoginForm() {
  const [error, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="mt-6">
      <p className="text-[.9rem] text-ink-2 mb-3">One password. It is not stored in a database anywhere.</p>
      <input
        type="password" name="password" required autoFocus autoComplete="current-password"
        aria-label="Password"
        className="w-full bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[13px] text-ink"
      />
      <button disabled={pending}
        className="mt-3 bg-inkpanel text-chalk font-mono text-[11px] tracking-[.1em] uppercase px-4 py-2 disabled:opacity-50">
        {pending ? "checking" : "sign in"}
      </button>
      {error && <p className="mt-3 text-[.85rem] text-ink font-bold">{error}</p>}
    </form>
  );
}
