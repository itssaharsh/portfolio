import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Editor from "../../Editor";
import { supabaseServer, currentUser } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/supabase/config";
import type { Post } from "@/lib/posts";

export const metadata = { title: "Edit" };
export const dynamic = "force-dynamic";

export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/admin/login");
  const { id } = await params;
  const sb = await supabaseServer();
  const { data } = await sb!.from("posts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <Link href="/admin" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">back to the desk</Link>
      <h1 className="text-[1.6rem] mt-4">Edit</h1>
      <Editor post={data as Post} />
    </main>
  );
}
