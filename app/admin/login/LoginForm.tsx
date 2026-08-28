"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm({ adminEmail }: { adminEmail: string }) {
  const [email, setEmail] = useState(adminEmail);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) return;
    setState("sending");
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) { setState("error"); setMsg(error.message); return; }
    setState("sent");
  }

  return (
    <form onSubmit={send} className="mt-6">
      <p className="text-[.9rem] text-ink-2 mb-3">
        There is no password. You get a link by email and it signs you in.
      </p>
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        aria-label="Email address"
        className="w-full bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[13px] text-ink"
      />
      <button
        disabled={state === "sending" || state === "sent"}
        className="mt-3 bg-inkpanel text-chalk font-mono text-[11px] tracking-[.1em] uppercase px-4 py-2 disabled:opacity-50"
      >
        {state === "sending" ? "sending" : state === "sent" ? "check your email" : "send me a link"}
      </button>
      {state === "sent" && <p className="mt-3 text-[.85rem] text-moss">Sent. The link lands in {email} and works once.</p>}
      {state === "error" && <p className="mt-3 text-[.85rem] text-rust">That did not work. {msg}</p>}
    </form>
  );
}
