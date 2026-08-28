import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, renderMarkdown } from "@/lib/posts";
import { me } from "@/content/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: `Not found · ${me.name}` };
  return {
    title: `${post.title} · ${me.name}`,
    description: post.excerpt ?? undefined,
    openGraph: { title: post.title, description: post.excerpt ?? undefined, images: post.cover_url ? [post.cover_url] : undefined },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-[44rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2.5rem,6vw,4.5rem)]">
      <Link href="/blog" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">all writing</Link>
      <article className="mt-6">
        <div className="font-mono text-[11px] tracking-[.07em] uppercase text-ink-3">
          {post.published_at ? new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "draft"}
          {" · "}{post.reading_time} minute{post.reading_time === 1 ? "" : "s"}
        </div>
        <h1 className="text-[clamp(1.7rem,1.2rem+2.2vw,2.6rem)] mt-3">{post.title}</h1>
        {post.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={post.cover_url} alt="" className="w-full mt-6 border border-[#8F8C7E]" />
        ) : null}
        <div className="post-body mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }} />
      </article>

      <style>{`
        .post-body { font-size: 1.02rem; line-height: 1.66; }
        .post-body > * + * { margin-top: 1.1rem; }
        .post-body h2 { font-family: var(--font-mono); font-size: 1.2rem; margin-top: 2.4rem; }
        .post-body h3 { font-family: var(--font-mono); font-size: 1.02rem; margin-top: 1.8rem; }
        .post-body a { color: var(--color-ultra-deep); }
        .post-body img { max-width: 100%; height: auto; border: 1px solid #8F8C7E; }
        .post-body pre { background: var(--color-inkpanel); color: #D8D3C2; padding: 1rem; overflow-x: auto;
          font-family: var(--font-mono); font-size: 12.5px; line-height: 19px; }
        .post-body code { font-family: var(--font-mono); font-size: .92em; }
        .post-body :not(pre) > code { background: var(--color-chalk); padding: .1rem .3rem; }
        .post-body blockquote { border-left: 3px solid var(--color-hair); padding-left: 1rem; color: var(--color-ink-2); }
        .post-body ul, .post-body ol { padding-left: 1.3rem; }
        .post-body li + li { margin-top: .4rem; }
        .post-body table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: .85rem; display: block; overflow-x: auto; }
        .post-body th, .post-body td { border-bottom: 1px solid var(--color-hair); padding: .4rem .6rem; text-align: left; }
      `}</style>
    </main>
  );
}
