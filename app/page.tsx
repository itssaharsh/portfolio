import Heap from "@/components/Heap";
import Grain from "@/components/Grain";
import { Marg, Panel, PrRow } from "@/components/ui";
import {
  me, links, proof, prs, merged, inReview, bench, projects, ratings,
  RATINGS_AS_OF, achievements, certifications, prUrl, HEAP, CNCF_GRADUATED, daysSince,
} from "@/content/data";

/** rebuilt daily, so the days in review counters stay honest without any client JavaScript */
export const revalidate = 86400;

export default function Home() {
  return (
    <>
      <Grain />
      <Heap />
      <main>
        <div className="mx-auto max-w-[60rem] px-[clamp(1.1rem,4vw,2.5rem)]">

          {/* ---------------- hero. everything load bearing is here. ---------------- */}
          <section className="pt-[clamp(4.5rem,9vw,7rem)] pb-[clamp(3rem,7vw,5rem)]">
            <p className="font-mono text-[11px] tracking-[.13em] uppercase text-ink-2 mb-6">
              {me.name} · {me.place} · {me.study}
            </p>
            <h1 className="text-[clamp(2rem,1.1rem+4.2vw,3.4rem)]">
              I take things out<br />of other people&apos;s<br />
              <span className="text-ultra">hot paths.</span>
            </h1>
            <p className="max-w-[54ch] mt-6 text-ink-2">
              {merged.length} of my changes are merged into OpenTelemetry, which is how most of the cloud
              watches its own software, and which finished graduating from the Cloud Native Computing
              Foundation on {CNCF_GRADUATED}. {inReview.length} more are open right now and being
              reviewed by the people who maintain it.
            </p>

            <span className="inline-flex items-center gap-[.55rem] mt-6 font-mono text-[12px] tracking-[.05em] text-ink bg-chalk px-3 py-[.55rem] border border-[#C9C4B2]">
              <kbd className="font-mono font-bold text-[11px] bg-inkpanel text-chalk px-[.4rem] py-[.28rem]">g</kbd>
              the <span className="text-ultra">{HEAP.before} blocks</span> on the floor are one real commit.
              push them around, then collect them.
            </span>

            <div className="grid gap-px bg-[#8F8C7E] border border-[#8F8C7E] mt-9 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
              {proof.map((c) => (
                <a key={c.n} href={prUrl(c.pr)} className="bg-chalk p-4 block no-underline transition-colors hover:bg-[#F7F4E8]">
                  <span className="block font-mono text-[clamp(1.4rem,1.1rem+1vw,1.9rem)] leading-none tracking-[-.04em] text-ultra">{c.n}</span>
                  <span className="block mt-[.45rem] text-[.85rem] leading-[1.42] text-ink-2">{c.w}</span>
                  <span className="block mt-[.6rem] font-mono text-[10px] leading-[1.3] tracking-[.06em] uppercase text-ink-3">
                    {c.pr.repo === "rsm" ? "kubernetes-sigs" : c.pr.repo === "otelc" ? "otel compile instrumentation" : "opentelemetry-go"} {c.pr.num}
                    {" · "}<span className="text-rust">{daysSince(c.pr.date)} days in review</span>
                  </span>
                </a>
              ))}
            </div>
          </section>

          {/* ---------------- the commit the floor is made of ---------------- */}
          <section className="py-[clamp(3rem,7vw,5rem)]">
            <Marg n="01"><span>the commit the floor is made of</span><span>kubernetes-sigs 102</span></Marg>
            <Panel>
              <div className="bg-inkpanel text-[#D8D3C2] font-mono text-[12.5px] leading-[19px] p-4 overflow-x-auto whitespace-pre">
{`$ go test -bench=BenchmarkGenerate -benchmem -count=10

`}<span className="text-[#6E6A5C]">{`name                       old            new         delta`}</span>{`
`}{bench.map((b) => `${b.name.padEnd(27)}${b.old.padEnd(15)}${b.now.padEnd(12)}${b.delta}`).join("\n")}
              </div>
            </Panel>
            <p className="max-w-[54ch] mt-5 text-ink-2">
              Every block on the floor is one of those {HEAP.before}. Press <b>g</b> and the {HEAP.after} that
              survive stay behind. Nothing on the page labels them, but they are the only {HEAP.after} that
              never stop moving.
            </p>
          </section>

          {/* ---------------- open source. the spine. ---------------- */}
          <section className="py-[clamp(3rem,7vw,5rem)]">
            <Marg n="02"><span>open source</span><span>{merged.length} merged · {inReview.length} open</span></Marg>
            <h2 className="text-[clamp(1.3rem,1.05rem+1.1vw,1.9rem)] max-w-[20ch]">
              This is the closest thing I have to a job history.
            </h2>
            <p className="max-w-[54ch] mt-4 text-ink-2">
              So it goes where a job history would. These {inReview.length} open ones are the best code I have
              written. None of them are merged yet, so read the numbers and decide for yourself.
            </p>
            <ul className="list-none p-0 mt-8">
              {inReview.map((p) => <PrRow key={`${p.repo}${p.num}`} p={p} />)}
            </ul>
            <h3 className="font-mono text-[1rem] mt-12 mb-1">Merged</h3>
            <ul className="list-none p-0">
              {merged.map((p) => <PrRow key={`${p.repo}${p.num}`} p={p} />)}
            </ul>
          </section>

          {/* ---------------- projects ---------------- */}
          <section className="py-[clamp(3rem,7vw,5rem)]">
            <Marg n="03"><span>projects</span><span>{projects.length} things I built</span></Marg>
            <div className="grid gap-px bg-[#8F8C7E] border border-[#8F8C7E] [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
              {projects.map((p) => {
                const inner = (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-mono text-[1.05rem]">{p.name}</h3>
                      <span className="font-mono text-[10px] tracking-[.08em] uppercase text-ink-3">{p.stack}</span>
                    </div>
                    <p className="mt-3 text-[.9rem] leading-[1.45] text-ink-2">{p.blurb}</p>
                    <span className="block mt-4 font-mono text-[10px] tracking-[.06em] uppercase text-ink-3">
                      {p.private ? p.note : p.url!.replace("https://github.com/", "")}
                    </span>
                  </>
                );
                return p.url ? (
                  <a key={p.name} href={p.url} className="bg-chalk p-5 block no-underline transition-colors hover:bg-[#F7F4E8]">{inner}</a>
                ) : (
                  <div key={p.name} className="bg-chalk p-5">{inner}</div>
                );
              })}
            </div>
          </section>

          {/* ---------------- contest ratings ---------------- */}
          <section className="py-[clamp(3rem,7vw,5rem)]">
            <Marg n="04"><span>contest ratings</span><span>as of {RATINGS_AS_OF}</span></Marg>
            <div className="flex gap-[clamp(1.2rem,4vw,3rem)] items-end flex-wrap mt-2">
              {ratings.map((r) => (
                <div key={r.k}>
                  <a href={r.href} className="no-underline block">
                    <span className="block font-mono text-[clamp(1.6rem,1.2rem+1.4vw,2.3rem)] leading-none tracking-[-.04em]">{r.v}</span>
                    <span className="block font-mono text-[11px] tracking-[.07em] uppercase text-ink-2 mt-1">{r.k} · {r.sub}</span>
                  </a>
                  <p className="text-[.82rem] text-rust mt-2 max-w-[22ch]">{r.admission}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ---------------- achievements and certifications ---------------- */}
          <section className="py-[clamp(3rem,7vw,5rem)]">
            <Marg n="05"><span>picked for</span><span>and passed</span></Marg>
            <div className="grid gap-[clamp(1.5rem,4vw,3rem)] md:grid-cols-2">
              <ul className="list-none p-0 m-0">
                {achievements.map((a) => (
                  <li key={a.what} className="border-t border-[#8F8C7E] py-3">
                    <div className="font-mono text-[.92rem]">{a.what} <span className="text-ink-3">{a.when}</span></div>
                    <p className="text-[.85rem] text-ink-2 mt-1">{a.note}</p>
                  </li>
                ))}
              </ul>
              <ul className="list-none p-0 m-0">
                {certifications.map((c) => (
                  <li key={c.what} className="border-t border-[#8F8C7E] py-3">
                    <div className="text-[.88rem] text-ink-2">{c.what} <span className="text-ink-3 font-mono text-[11px]">{c.when}</span></div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ---------------- writing, resume, contact ---------------- */}
          <section className="py-[clamp(3rem,7vw,5rem)]">
            <Marg n="06"><span>the rest</span></Marg>
            <div className="grid gap-px bg-[#8F8C7E] border border-[#8F8C7E] [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
              <a href="/blog" className="bg-chalk p-5 no-underline block hover:bg-[#F7F4E8]">
                <h3 className="font-mono text-[1.05rem]">Writing</h3>
                <p className="mt-2 text-[.9rem] text-ink-2">Notes on what I broke and what I learned putting it back.</p>
              </a>
              <a href="/resume" className="bg-chalk p-5 no-underline block hover:bg-[#F7F4E8]">
                <h3 className="font-mono text-[1.05rem]">Resume</h3>
                <p className="mt-2 text-[.9rem] text-ink-2">One page, readable here, downloadable, and it prints properly.</p>
              </a>
              <div className="bg-chalk p-5">
                <h3 className="font-mono text-[1.05rem]">Get in touch</h3>
                <ul className="list-none p-0 mt-2 font-mono text-[.8rem] leading-[1.9]">
                  <li><a href={`mailto:${me.email}`}>{me.email}</a></li>
                  <li><a href={links.github}>github.com/itssaharsh</a></li>
                  <li><a href={links.linkedin}>linkedin</a> · <a href={links.x}>x</a></li>
                  <li><a href={links.leetcode}>leetcode</a> · <a href={links.codechef}>codechef</a> · <a href={links.codeforces}>codeforces</a></li>
                </ul>
              </div>
            </div>
          </section>

          <footer className="border-t border-[#8F8C7E] mt-12 pt-6 pb-[12rem] font-mono text-[11px] leading-[1.7] tracking-[.05em] text-ink-2">
            Go Mono, subset to 10,756 bytes from the 173,248 byte original by Bigelow and Holmes.
            No images, no gradients, no tracking. {prs.length} pull requests, every one of them linked.
          </footer>
        </div>
      </main>
    </>
  );
}
