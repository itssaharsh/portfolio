import type { Metadata } from "next";
import Link from "next/link";
import { listPublished } from "@/lib/posts";
import { isConfigured } from "@/lib/supabase/config";
import { me } from "@/content/data";

export const metadata: Metadata = { title: `Writing · ${me.name}` };
export const dynamic = "force-dynamic"; // search runs on the request

export default async function Blog({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const posts = await listPublished(q);

  return (
    <main className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2.5rem,6vw,4.5rem)]">
      <Link href="/" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">back to the floor</Link>
      <h1 className="text-[clamp(1.8rem,1.3rem+2vw,2.6rem)] mt-6">Writing</h1>
      <p className="max-w-[54ch] mt-4 text-ink-2">Notes on what I broke and what I learned putting it back.</p>

      <form className="mt-8 flex gap-2" role="search">
        <input
          name="q" defaultValue={q ?? ""} placeholder="search the words inside the posts"
          aria-label="Search posts"
          className="flex-1 bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[13px] text-ink"
        />
        <button className="bg-inkpanel text-chalk font-mono text-[11px] tracking-[.1em] uppercase px-4">search</button>
      </form>

      {!isConfigured ? (
        <p className="mt-10 bg-chalk border border-[#C9C4B2] p-5 text-[.9rem] text-ink-2">
          The writing is not wired up yet. Add the Supabase keys and the posts appear here.
        </p>
      ) : posts.length === 0 ? (
        <p className="mt-10 bg-chalk border border-[#C9C4B2] p-5 text-[.9rem] text-ink-2">
          {q ? <>Nothing matches <b>{q}</b>. The search looks inside the whole post, but it matches whole words rather than parts of them.</> : <>Nothing published yet.</>}
        </p>
      ) : (
        <ul className="list-none p-0 mt-10">
          {posts.map((p) => (
            <li key={p.id} className="border-t border-[#8F8C7E] py-5">
              <Link href={`/blog/${p.slug}`} className="no-underline block group">
                <div className="font-mono text-[11px] tracking-[.07em] uppercase text-ink-3">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "draft"}
                  {" · "}{p.reading_time} minute{p.reading_time === 1 ? "" : "s"}
                </div>
                <h2 className="text-[1.25rem] mt-2 group-hover:text-ultra-deep">{p.title}</h2>
                {p.excerpt ? <p className="mt-2 text-[.92rem] text-ink-2 max-w-[62ch]">{p.excerpt}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
