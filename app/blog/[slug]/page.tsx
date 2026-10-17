import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, listPublished, renderMarkdown, lastReadError } from "@/lib/posts";
import { SiteHeader, btn, textLink } from "@/components/ui";
import { me, merged, mergedOrgs, sentenceList, inWords } from "@/content/data";

export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: `Not found · ${me.name}` };
  return {
    title: `${post.title} · ${me.name}`,
    description: post.excerpt ?? undefined,
    openGraph: { title: post.title, description: post.excerpt ?? undefined, type: "article", images: post.cover_url ? [post.cover_url] : undefined },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post && lastReadError) {
    // The database did not answer, which is not the same as the post not existing. Saying
    // "nothing points at it" about a post the homepage links to would be untrue.
    return (
      <div className="mx-auto max-w-[46rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
        <SiteHeader current="writing" />
        <main id="main">
          <h1 className="text-[clamp(1.6rem,1.2rem+1.6vw,2.2rem)] mt-10">This post is not loading right now.</h1>
          <p className="m-0 mt-4 text-ink-2 max-w-[46ch]">The place the writing is kept did not answer. Try again in a moment.</p>
        </main>
      </div>
    );
  }
  if (!post) notFound();
  const others = (await listPublished()).filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-[46rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <SiteHeader current="writing" />
      <main id="main">

      <article className="mt-10">
        <div className="font-mono text-[11px] leading-[1.7] tracking-[.07em] uppercase text-ink-2">
          {post.published_at ? day(post.published_at) : "draft"}
          {" · "}{post.reading_time} minute{post.reading_time === 1 ? "" : "s"}
          {post.tags.length > 0 ? <>{" · "}{post.tags.join(", ")}</> : null}
        </div>
        <h1 className="text-[clamp(1.8rem,1.25rem+2.4vw,2.8rem)] leading-[1.04] mt-3">{post.title}</h1>
        {post.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={post.cover_url} alt="" className="w-full mt-7 border border-hair" />
        ) : null}
        <div className="post-body mt-8 pt-8 border-t border-hair" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }} />
        {/* one block to say it is over. the same blue as the two on the floor that never sleep. */}
        <div aria-hidden="true" className="mt-10 size-[14px] bg-ultra" />
      </article>

      <aside aria-label="About the author" className="mt-12 bg-chalk border border-[#C9C4B2] p-5">
        <p className="m-0 font-mono text-[10px] tracking-[.1em] uppercase text-ink-3">written by</p>
        <p className="m-0 mt-2 font-mono text-[1.05rem] tracking-[-.02em]">{me.name}</p>
        <p className="m-0 mt-2 text-[.92rem] text-ink-2 max-w-[58ch]">
          I take things out of other people&apos;s hot paths. {inWords(merged.length)[0].toUpperCase() + inWords(merged.length).slice(1)} of
          my changes are merged into {sentenceList(mergedOrgs)}.
        </p>
        <p className="m-0 mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 font-mono text-[11px] tracking-[.1em] uppercase">
          <Link href="/#work" className={btn}>see the work</Link>
          <Link href="/resume" className={textLink}>resume</Link>
          <a href={`mailto:${me.email}`} className={textLink}>email</a>
        </p>
      </aside>

      {others.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-mono text-[11px] leading-[1.6] tracking-[.11em] uppercase text-ink-2">more writing</h2>
          <ul className="list-none p-0 m-0 mt-3">
            {others.map((p) => (
              <li key={p.id} className="border-t border-hair py-4">
                <Link href={`/blog/${p.slug}`} className="no-underline block group">
                  <h3 className="text-[1.1rem] leading-[1.2] group-hover:text-ultra-deep">{p.title}</h3>
                  {p.excerpt ? <p className="m-0 mt-1 text-[.9rem] text-ink-2 max-w-[62ch]">{p.excerpt}</p> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="m-0 mt-8 font-mono text-[11px] tracking-[.06em] uppercase">
        <Link href="/blog" className={textLink}>all the writing</Link>
      </p>
      </main>
    </div>
  );
}
