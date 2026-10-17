import Link from "next/link";
import Heap from "@/components/Heap";
import Grain from "@/components/Grain";
import { Marg, Panel, SiteNav, State, WorkEntry, ProjectCard, ProjectRow, btn, textLink } from "@/components/ui";
import {
  me, links, about, skills, proof, prs, merged, stillOpen, mergedInto, mergedOrgs, leadOrg, sentenceList,
  bench, work, projects, featured, moreProjects, ratings, RATINGS_AS_OF, achievements, certifications,
  prUrl, repoName, inWords, HEAP, CNCF_GRADUATED,
} from "@/content/data";
import { listPublished } from "@/lib/posts";

/** rebuilt daily, so the count of days a pull request has been open stays honest without any client JavaScript */
export const revalidate = 86400;

const section = "py-[clamp(3rem,7vw,5rem)]";
const col = (s: string, n: number) => s.padEnd(n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default async function Home() {
  // never throws. an unreachable database means this is empty and the section says where to look.
  const posts = (await listPublished()).slice(0, 3);

  const lead = leadOrg;
  const mergedLead = mergedInto(lead);
  const otherOrgs = mergedOrgs.filter((o) => o !== lead);
  // the rest of the opening, written so it still reads on the day only one is left open
  const elsewhere = merged.length - mergedLead;
  const oneEach = elsewhere > 1 && elsewhere === otherOrgs.length;
  const rest = [
    elsewhere > 0
      ? `${inWords(elsewhere)} more ${elsewhere === 1 ? "is" : "are"} merged${oneEach ? ", one each" : ""} into ${sentenceList(otherOrgs)}`
      : "",
    stillOpen.length > 0 ? `${stillOpen.length === 1 ? "one more is" : `${inWords(stillOpen.length)} more are`} still open` : "",
  ].filter(Boolean).join(", and ");
  const leadRepos = work.filter((g) => g.repo.org === lead && g.merged > 0).length;
  const liveCount = projects.filter((p) => p.live).length;

  return (
    <>
      <Grain />
      <Heap>
        <SiteNav home className="hidden md:block" />
      </Heap>
      {/* on a phone the section links sit here, above main, so skipping to the content skips them too */}
      <div className="md:hidden relative z-5 mx-auto max-w-[60rem] px-[clamp(1.1rem,4vw,2.5rem)] pt-[3.1rem]">
        <SiteNav home />
      </div>
      <main id="main">
        <div className="mx-auto max-w-[60rem] px-[clamp(1.1rem,4vw,2.5rem)]">

          {/* ---------------- hero. everything load bearing is here. ---------------- */}
          <section className="pt-5 md:pt-[clamp(4rem,7vw,5.5rem)] pb-[clamp(3rem,7vw,5rem)]">
            <p className="m-0 font-mono font-bold text-[1.02rem] tracking-[-.01em]">{me.name}</p>
            <p className="m-0 mt-1 mb-5 font-mono text-[11px] tracking-[.13em] uppercase text-ink-2">
              {me.place} · {me.study}
            </p>
            <h1 className="text-[clamp(2rem,1.1rem+4.2vw,3.4rem)]">
              I take things out<br />of other people&apos;s<br />
              <span className="text-ultra">hot paths.</span>
            </h1>
            <p className="m-0 max-w-[54ch] mt-5 text-ink-2">
              {cap(inWords(mergedLead))} of my changes are merged into {lead}, which a lot of the cloud
              uses to watch its own software, and which the Cloud Native Computing Foundation raised to
              graduated, its highest level, on {CNCF_GRADUATED}.{rest ? ` ${cap(rest)}.` : ""}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 font-mono text-[11px] tracking-[.1em] uppercase">
              <Link href="/resume" className={btn}>resume</Link>
              <a href={links.github} className={`inline-block py-2 ${textLink}`}>github</a>
              <a href={`mailto:${me.email}`} className={`inline-block py-2 ${textLink}`}>email</a>
              <a href={links.linkedin} className={`inline-block py-2 ${textLink}`}>linkedin</a>
            </div>
            <p className="m-0 mt-4 text-[.95rem] text-ink">Looking for {me.seeking}.</p>

            <div className="grid gap-px bg-hair border border-hair mt-8 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
              {proof.map((c) => (
                <a key={c.n} href={prUrl(c.pr)} className="bg-chalk p-4 block no-underline transition-colors hover:bg-[#F7F4E8]">
                  <span className="block font-mono text-[clamp(1.4rem,1.1rem+1vw,1.9rem)] leading-none tracking-[-.04em] text-ultra">{c.n}</span>
                  <span className="block mt-[.45rem] text-[.85rem] leading-[1.42] text-ink-2">{c.w}</span>
                  <span className="block mt-[.6rem] font-mono text-[10.5px] leading-[1.55] tracking-[.05em] uppercase text-ink-3">
                    <span className="text-ink underline decoration-ink-3 underline-offset-[3px] [overflow-wrap:anywhere]">{repoName(c.pr)} {c.pr.num}</span>
                    <br />
                    <State p={c.pr} on="chalk" />
                  </span>
                </a>
              ))}
            </div>

            <span className="heap-note inline-flex items-center gap-[.55rem] mt-6 font-mono text-[12px] leading-[1.55] tracking-[.03em] text-ink bg-chalk px-3 py-[.55rem] border border-[#C9C4B2]">
              <kbd className="heap-note-mouse font-mono font-bold text-[11px] bg-inkpanel text-chalk px-[.4rem] py-[.28rem]">g</kbd>
              <span className="heap-note-mouse">
                each of the <span className="text-ultra">{HEAP.before} blocks</span> on this page is one piece of memory
                a single run used to claim. push them around, then press g to collect them.
              </span>
              <span className="heap-note-touch">
                the blocks on this page stand for the <span className="text-ultra">{HEAP.before} pieces of memory</span> a
                single run used to claim. the arrows in the bar turn gravity.
              </span>
            </span>
          </section>

          {/* ---------------- the change the floor is made of ---------------- */}
          <section className={section}>
            <Marg n="01" title="the change the floor is made of">
              <span>{repoName(bench.pr)} {bench.pr.num}</span>
              <State p={bench.pr} />
            </Marg>
            <Panel>
              <div
                tabIndex={0} role="region" aria-label="The benchmark, before and after"
                className="bg-inkpanel text-[#D8D3C2] font-mono text-[12.5px] leading-[19px] p-4 overflow-x-auto whitespace-pre"
              >
                {`${bench.name}, on ${bench.on}\n\n`}
                <span className="text-[#A39E8C]">{`${col("", 27)}${col("before", 16)}${col("after", 13)}change`}</span>
                {"\n" + bench.rows.map((b) => `${col(b.name, 27)}${col(b.old, 16)}${col(b.now, 13)}${b.delta}`).join("\n")}
              </div>
            </Panel>
            <p className="heap-note heap-note-mouse m-0 max-w-[54ch] mt-5 text-ink-2">
              Press <b>g</b> and the {inWords(HEAP.after)} that survive stay behind. Nothing on the page labels
              them, but they are the only {inWords(HEAP.after)} that never stop moving.
            </p>
            <p className="m-0 mt-4 font-mono text-[11px] tracking-[.06em] uppercase">
              <a href={prUrl(bench.pr)} className={textLink}>read the pull request</a>
            </p>
          </section>

          {/* ---------------- open source. the spine. ---------------- */}
          <section id="work" className={section}>
            <Marg n="02" title="open source">
              <span>{merged.length} merged</span>
              <span>{stillOpen.length} open</span>
            </Marg>
            <p className="m-0 font-mono text-[clamp(1.3rem,1.05rem+1.1vw,1.9rem)] leading-[1.06] tracking-[-.03em] text-balance max-w-[20ch]">
              This is the closest thing I have to a job history.
            </p>
            <p className="m-0 max-w-[54ch] mt-4 text-ink-2">
              So it goes where a job history would. Of the {merged.length} merged, {mergedLead} went
              to {lead}, across {inWords(leadRepos)} of its repositories. Every line links to its pull
              request, so each one can be checked against what GitHub says.
            </p>
            <ul className="list-none p-0 m-0 mt-8">
              {work.map((g) => <WorkEntry key={g.key} g={g} />)}
            </ul>
          </section>

          {/* ---------------- projects ---------------- */}
          <section id="projects" className={section}>
            <Marg n="03" title="projects">
              <span>{liveCount} you can open right now</span>
            </Marg>
            <div className="grid gap-px bg-hair border border-hair [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
              {featured.map((p) => <ProjectCard key={p.name} p={p} />)}
            </div>
            <h3 className="text-[1rem] mt-12 mb-3">And {moreProjects.length} more</h3>
            <ul className="list-none p-0 m-0">
              {moreProjects.map((p) => <ProjectRow key={p.name} p={p} />)}
            </ul>
          </section>

          {/* ---------------- writing ---------------- */}
          <section id="writing" className={section}>
            <Marg n="04" title="writing">
              <span>notes on what I broke and what I learned putting it back</span>
            </Marg>
            {posts.length > 0 ? (
              <ul className="list-none p-0 m-0">
                {posts.map((p) => (
                  <li key={p.id} className="border-t border-hair py-5">
                    <Link href={`/blog/${p.slug}`} className="no-underline block group">
                      <div className="font-mono text-[11px] tracking-[.07em] uppercase text-ink-2">
                        {p.published_at ? new Date(p.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "draft"}
                        {" · "}{p.reading_time} minute{p.reading_time === 1 ? "" : "s"}
                      </div>
                      <h3 className="text-[1.25rem] leading-[1.15] mt-2 group-hover:text-ultra-deep">{p.title}</h3>
                      {p.excerpt ? <p className="m-0 mt-2 text-[.92rem] text-ink-2 max-w-[62ch]">{p.excerpt}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 max-w-[54ch] text-ink-2">Everything I have written is on its own page.</p>
            )}
            <p className="m-0 mt-5 font-mono text-[11px] tracking-[.06em] uppercase">
              <Link href="/blog" className={textLink}>all the writing</Link>
            </p>
          </section>

          {/* ---------------- about ---------------- */}
          <section id="about" className={section}>
            <Marg n="05" title="about" />
            <div className="grid gap-[clamp(1.5rem,4vw,3rem)] md:grid-cols-[1.1fr_1fr] items-start">
              <div className="grid gap-4 text-ink-2 max-w-[54ch]">
                {about.map((para) => <p key={para} className="m-0">{para}</p>)}
              </div>
              <Panel className="p-5">
                <dl className="m-0 grid gap-x-4 gap-y-3 grid-cols-[6.2rem_1fr] text-[.9rem] leading-[1.45]">
                  {[
                    { k: "Based in", v: me.place },
                    { k: "Studying", v: `${me.degree}, ${me.years}. Grade point average ${me.gpa}.` },
                    ...skills,
                    { k: "Looking for", v: cap(me.seeking) },
                  ].map((row) => (
                    <div key={row.k} className="contents">
                      <dt className="font-mono text-[10px] leading-[1.9] tracking-[.08em] uppercase text-ink-3">{row.k}</dt>
                      <dd className="m-0 text-ink-2">{row.v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
          </section>

          {/* ---------------- picked for, passed, ranked ---------------- */}
          <section id="record" className={section}>
            <Marg n="06" title="the record">
              <span>picked for, passed, ranked</span>
            </Marg>
            <div className="grid gap-[clamp(1.5rem,4vw,3rem)] md:grid-cols-2">
              <ul className="list-none p-0 m-0">
                {achievements.map((a) => (
                  <li key={a.what} className="border-t border-hair py-3">
                    <div className="font-mono text-[.92rem]">{a.what} <span className="text-ink-2">{a.when}</span></div>
                    <p className="m-0 text-[.85rem] text-ink-2 mt-1">{a.note}</p>
                  </li>
                ))}
              </ul>
              <ul className="list-none p-0 m-0">
                {certifications.map((c) => (
                  <li key={c.what} className="border-t border-hair py-3">
                    <div className="text-[.88rem] text-ink-2">{c.what} <span className="font-mono text-[11px]">{c.when}</span></div>
                  </li>
                ))}
              </ul>
            </div>
            <h3 className="text-[1rem] mt-12">Contest ratings, as of {RATINGS_AS_OF}</h3>
            <div className="flex gap-[clamp(1.2rem,4vw,3rem)] items-start flex-wrap mt-5">
              {ratings.map((r) => (
                <div key={r.k}>
                  <a href={r.href} className="no-underline block hover:text-ultra-deep">
                    <span className="block font-mono text-[clamp(1.6rem,1.2rem+1.4vw,2.3rem)] leading-none tracking-[-.04em]">{r.v}</span>
                    <span className="block font-mono text-[11px] tracking-[.07em] uppercase text-ink-2 mt-1">{r.k}{r.sub ? ` · ${r.sub}` : ""}</span>
                  </a>
                  <p className="m-0 text-[.82rem] text-ink-2 mt-2 max-w-[22ch]">{r.admission}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ---------------- contact ---------------- */}
          <section id="contact" className={section}>
            <Marg n="07" title="get in touch" />
            <div className="grid gap-px bg-hair border border-hair [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
              <div className="bg-chalk p-5">
                <h3 className="text-[1.05rem]">Email</h3>
                <p className="m-0 mt-3 font-mono text-[.84rem] [overflow-wrap:anywhere]">
                  <a href={`mailto:${me.email}`} className={textLink}>{me.email}</a>
                </p>
              </div>
              <div className="bg-chalk p-5">
                <h3 className="text-[1.05rem]">Elsewhere</h3>
                <ul className="list-none p-0 m-0 mt-3 font-mono text-[.8rem] leading-[1.9]">
                  <li><a href={links.github} className={textLink}>github.com/itssaharsh</a></li>
                  <li><a href={links.linkedin} className={textLink}>LinkedIn</a> · <a href={links.x} className={textLink}>X</a></li>
                  <li>Discord, {me.discord}</li>
                  <li>
                    <a href={links.leetcode} className={textLink}>LeetCode</a> · <a href={links.codechef} className={textLink}>CodeChef</a> · <a href={links.codeforces} className={textLink}>Codeforces</a>
                  </li>
                </ul>
              </div>
              <div className="bg-chalk p-5">
                <h3 className="text-[1.05rem]">Resume</h3>
                <p className="m-0 mt-3 text-[.9rem] text-ink-2">The short version is a PDF. A fuller one is readable here, and it prints properly.</p>
                <p className="m-0 mt-3 font-mono text-[.8rem] leading-[1.9]">
                  <Link href="/resume" className={textLink}>Read it here</Link> · <a href="/resume.pdf" download className={textLink}>Download the PDF</a>
                </p>
              </div>
            </div>
          </section>

          <footer className="border-t border-hair mt-12 pt-6 pb-[12rem] font-mono text-[11px] leading-[1.7] tracking-[.05em] text-ink-2">
            Go Mono by Bigelow and Holmes, two weights, cut down to 10,756 and 10,996 bytes. The regular
            weight started at 173,248. No images, no gradients, no tracking. {prs.length} pull requests, every one of them linked.
          </footer>
        </div>
      </main>
    </>
  );
}
