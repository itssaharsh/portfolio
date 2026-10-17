import Link from "next/link";
import Editor from "../../Editor";
import Login from "../../login/page";
import { signedIn } from "@/lib/auth";
import { getForDesk } from "@/lib/posts";

export const metadata = { title: "Edit" };
export const dynamic = "force-dynamic";

/**
 * This page never hands the editor a post it did not read. When the read fails, or finds
 * nothing, the editor gets the id and the reason and no post, and it decides what to draw:
 * only it can see what a refused save handed back. Empty boxes with the post's id in the form
 * would be one press of save away from writing an empty post over the real one.
 *
 * A post that is not there is not answered with the not found page, for the same reason. Next
 * draws this page again after a save. A save refused because the post was deleted has to be
 * drawn here with the text still in its boxes, and once that text has been saved as a new
 * post, the editor has to be here still to say so, where the not found page would say that
 * whatever was here got swept.
 */
export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  // signed out, this page is the sign in, drawn here and not reached by a redirect: see app/admin/new/page.tsx
  if (!(await signedIn())) return <Login />;
  const { id } = await params;
  const { got: post, error } = await getForDesk(id);

  return (
    <main id="main" className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <Link href="/admin" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">back to the desk</Link>
      <h1 className="text-[1.6rem] mt-4">Edit</h1>
      {post ? <Editor post={post} /> : <Editor lost={error === null ? { id } : { id, reason: error }} />}
    </main>
  );
}
