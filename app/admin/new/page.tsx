import Link from "next/link";
import Editor from "../Editor";
import { currentUser } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/supabase/config";
import { redirect } from "next/navigation";

export const metadata = { title: "Write something" };
export const dynamic = "force-dynamic";

export default async function New() {
  const user = await currentUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/admin/login");
  return (
    <main className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <Link href="/admin" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">back to the desk</Link>
      <h1 className="text-[1.6rem] mt-4">Write something</h1>
      <Editor />
    </main>
  );
}
