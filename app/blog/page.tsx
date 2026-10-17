import type { Metadata } from "next";
import Link from "next/link";
import { listPublished, lastReadError } from "@/lib/posts";
import { storeReady } from "@/lib/store";
import { SiteHeader } from "@/components/ui";
import { me } from "@/content/data";

export const metadata: Metadata = { title: `Writing · ${me.name}` };
export const dynamic = "force-dynamic"; // search runs on the request

export default async function Blog({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const posts = await listPublished(q);

  return (
    <div className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <SiteHeader current="writing" />
      <main id="main">
      <h1 className="text-[clamp(1.8rem,1.3rem+2vw,2.6rem)] mt-10">Writing</h1>
      <p className="m-0 max-w-[54ch] mt-4 text-ink-2">Notes on what I broke and what I learned putting it back.</p>

      <form className="mt-8 flex gap-2" role="search">
        <input
          name="q" defaultValue={q ?? ""} placeholder="search the words inside the posts"
          aria-label="Search posts"
          className="flex-1 bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[13px] text-ink"
        />
        <button className="bg-inkpanel text-chalk font-mono text-[11px] tracking-[.1em] uppercase px-4">search</button>
      </form>

      {!storeReady() ? (
        <p className="m-0 mt-10 bg-chalk border border-[#C9C4B2] p-5 text-[.9rem] text-ink-2">
          The writing is not available right now.
        </p>
      ) : posts.length === 0 ? (
        <p className="m-0 mt-10 bg-chalk border border-[#C9C4B2] p-5 text-[.9rem] text-ink-2 [overflow-wrap:anywhere]">
          {q ? <>Nothing matches <b>{q}</b>. The search looks inside the whole post, but it matches whole words rather than parts of them.</> : lastReadError ? <>Nothing to show right now. Try again in a moment.</> : <>Nothing published yet.</>}
        </p>
      ) : (
        <ul className="list-none p-0 m-0 mt-10">
          {posts.map((p) => (
            <li key={p.id} className="border-t border-hair py-5">
              <Link href={`/blog/${p.slug}`} className="no-underline block group">
                <div className="font-mono text-[11px] tracking-[.07em] uppercase text-ink-2">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "draft"}
                  {" · "}{p.reading_time} minute{p.reading_time === 1 ? "" : "s"}
                </div>
                <h2 className="text-[1.25rem] leading-[1.15] mt-2 group-hover:text-ultra-deep">{p.title}</h2>
                {p.excerpt ? <p className="m-0 mt-2 text-[.92rem] text-ink-2 max-w-[62ch]">{p.excerpt}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      </main>
    </div>
  );
}
