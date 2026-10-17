import Link from "next/link";
import Login from "../../login/page";
import { signedIn } from "@/lib/auth";
import { getForDesk } from "@/lib/posts";
import DeleteForm from "./DeleteForm";

export const metadata = { title: "Delete" };
export const dynamic = "force-dynamic";

/** when the post last changed, on the server's clock, with the clock named so it cannot be read as local time */
const changed = (iso: string) =>
  `${new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;

/**
 * Delete asks first. On the list, delete used to be one click beside edit that removed the
 * post there and then, and the desk keeps no copy. This page names the post, says what
 * deleting it means, and holds the real button, which is a form and works with JavaScript
 * switched off.
 *
 * The proxy does not stand in front of a POST, so this page checks the sign in itself, and so
 * does deletePost.
 */
export default async function Delete({ params }: { params: Promise<{ id: string }> }) {
  // signed out, this page is the sign in, drawn here and not reached by a redirect: see app/admin/new/page.tsx
  if (!(await signedIn())) return <Login />;
  const { id } = await params;
  const { got: post, error } = await getForDesk(id);

  return (
    <main id="main" className="mx-auto max-w-[40rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <Link href="/admin" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">back to the desk</Link>
      {error !== null ? (
        <>
          <h1 className="text-[1.6rem] mt-4">Delete</h1>
          {/* With no post to name there is nothing to ask about, so there is no button. It does not
              say that nothing was deleted: with JavaScript off this page is also what comes back
              after the button was pressed, and it cannot know how far that got. */}
          <p role="alert" className="mt-6 bg-chalk border border-ink p-5 text-[.9rem] text-ink font-bold">The database did not answer, so the desk cannot show which post this is. Load the page again in a moment. ({error})</p>
        </>
      ) : !post ? (
        <>
          <h1 className="text-[1.6rem] mt-4">Delete</h1>
          <p className="mt-6 bg-chalk border border-[#C9C4B2] p-5 text-[.9rem] text-ink-2">This post is not on the site. It may have been deleted already.</p>
        </>
      ) : (
        <>
          <h1 className="text-[1.6rem] mt-4">Delete this post?</h1>
          <div className="mt-6 bg-chalk border border-[#C9C4B2] p-5">
            <div className="font-mono text-[10px] tracking-[.09em] uppercase text-ink-2">
              <span className="text-ink font-bold">{post.published ? "live" : "a draft"}</span> · last changed {changed(post.updated_at)}
            </div>
            <div className="mt-1 text-[1.02rem] font-mono">{post.title}</div>
            <div className="text-[11px] font-mono text-ink-2">/blog/{post.slug}</div>
          </div>
          <p className="mt-5 text-[.92rem]">
            This cannot be undone. The desk keeps no copy of a post it deletes.
            {post.published ? " This one is out, so its page goes with it." : ""}
          </p>
          <div className="mt-6 flex gap-5 items-end flex-wrap font-mono text-[11px] tracking-[.1em] uppercase">
            <DeleteForm id={post.id} opened={post.updated_at} />
            <Link href="/admin" className="underline underline-offset-[3px] py-3">keep it</Link>
          </div>
        </>
      )}
    </main>
  );
}
