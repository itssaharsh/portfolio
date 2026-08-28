import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Editor from "../../Editor";
import { signedIn } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const metadata = { title: "Edit" };
export const dynamic = "force-dynamic";

export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  if (!(await signedIn())) redirect("/admin/login");
  const { id } = await params;
  const post = await getStore().getById(id);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <Link href="/admin" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">back to the desk</Link>
      <h1 className="text-[1.6rem] mt-4">Edit</h1>
      <Editor post={post} />
    </main>
  );
}
