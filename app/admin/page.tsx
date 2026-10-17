import Link from "next/link";
import { listForDesk } from "@/lib/posts";
import { signedIn } from "@/lib/auth";
import { storeReady } from "@/lib/store";
import { signOutAction } from "./actions";

export const metadata = { title: "Writing desk" };
export const dynamic = "force-dynamic";

export default async function Admin() {
  if (!storeReady()) {
    return (
      <main id="main" className="mx-auto max-w-[40rem] px-6 py-16">
        <h1 className="text-[1.5rem]">Not connected yet</h1>
        <p className="mt-4 text-ink-2 text-[.92rem]">Set <code>DATABASE_URL</code> and run <code>db/schema.sql</code>, then this becomes your writing desk.</p>
      </main>
    );
  }
  if (!(await signedIn())) {
    return (
      <main id="main" className="mx-auto max-w-[40rem] px-6 py-16">
        <h1 className="text-[1.5rem]">Not you</h1>
        <p className="mt-4 text-ink-2 text-[.92rem]">This desk takes one password. <Link href="/admin/login">Sign in</Link>.</p>
      </main>
    );
  }
  // the read hands back its own error, so a database that did not answer is not shown as an empty desk
  const { got: posts, error } = await listForDesk();

  return (
    <main id="main" className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="text-[1.6rem]">Writing desk</h1>
        <div className="flex gap-3 items-center font-mono text-[11px] tracking-[.08em] uppercase">
          <Link href="/admin/new" className="bg-inkpanel text-chalk px-3 py-2 no-underline">write something</Link>
          <form action={signOutAction}><button className="text-ink-2 underline">sign out</button></form>
        </div>
      </div>

      {error !== null ? (
        <p role="alert" className="mt-8 bg-chalk border border-ink p-5 text-[.9rem] text-ink font-bold">The database did not answer, so the posts cannot be listed. Load the page again in a moment. ({error})</p>
      ) : posts.length === 0 ? (
        <p className="mt-8 bg-chalk border border-[#C9C4B2] p-5 text-[.9rem] text-ink-2">Nothing here yet.</p>
      ) : (
        <ul className="list-none p-0 mt-8">
          {posts.map((p) => (
            <li key={p.id} className="border-t border-[#8F8C7E] py-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="font-mono text-[10px] tracking-[.09em] uppercase">
                  <span className={p.published ? "text-ink" : "text-ink font-bold"}>{p.published ? "published" : "draft"}</span>
                  <span className="text-ink-2"> · {new Date(p.updated_at).toLocaleDateString("en-GB")} · {p.reading_time} min</span>
                </div>
                <div className="mt-1 text-[1.02rem] font-mono">{p.title}</div>
                <div className="text-[11px] font-mono text-ink-2">/blog/{p.slug}</div>
              </div>
              <div className="flex gap-3 items-center font-mono text-[11px] tracking-[.08em] uppercase shrink-0">
                <Link href={`/admin/edit/${p.id}`} className="underline">edit</Link>
                {/* a link to the page that asks first. one click here used to remove the post for good. */}
                <Link href={`/admin/delete/${p.id}`} className="underline">delete</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
