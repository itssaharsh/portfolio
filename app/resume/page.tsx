import type { Metadata } from "next";
import { SiteHeader, btn } from "@/components/ui";
import {
  me, links, skills, prs, merged, stillOpen, mergedOrgs, sentenceList, featured, ratings, RATINGS_AS_OF,
  achievements, certifications, prUrl, prRepo, daysSince, fmtDate, inWords,
} from "@/content/data";

export const metadata: Metadata = { title: `Resume · ${me.name}` };
export const revalidate = 86400;

const h2 = "font-mono text-[.78rem] leading-[1.4] tracking-[.14em] uppercase mt-8 pb-1 border-b border-[#C9C4B2]";
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** merged work that carries a measured result. the rest is tests, documentation and housekeeping, and says so. */
const measured = merged.filter((p) => p.gain).length;

export default function Resume() {
  return (
    <div className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <SiteHeader current="resume" />
      <main id="main">

      <div className="mt-8 flex justify-end no-print">
        <a href="/resume.pdf" download className={btn}>download the pdf</a>
      </div>

      {/* every link in here is underlined, because on paper and on a projector colour alone says nothing */}
      <article className="bg-chalk border border-[#C9C4B2] p-[clamp(1.4rem,4vw,2.6rem)] mt-5 print-flat [&_a]:underline [&_a]:decoration-[#A8A392] [&_a]:underline-offset-[3px]">
        <h1 className="text-[clamp(1.6rem,1.2rem+1.6vw,2.2rem)]">{me.name}</h1>
        <p className="m-0 font-mono text-[11px] leading-[1.7] tracking-[.06em] mt-2 text-ink-2">
          {me.place} · <a href={`mailto:${me.email}`}>{me.email}</a> · <a href={links.github}>github.com/itssaharsh</a> · <a href={links.linkedin}>LinkedIn</a>
        </p>

        <h2 className={h2}>What I do</h2>
        <p className="m-0 mt-3 text-[.95rem] text-ink-2">
          I make other people&apos;s Go code faster, in small measured amounts. {cap(inWords(merged.length))} of my
          changes are merged into {sentenceList(mergedOrgs)}, and {inWords(measured)} of those come with a benchmark.
          {stillOpen.length > 0 ? ` ${stillOpen.length === 1 ? "One more is" : `${cap(inWords(stillOpen.length))} more are`} still open.` : ""} I am looking for {me.seeking}.
        </p>

        <h2 className={h2}>What I work in</h2>
        <dl className="m-0 mt-3 grid gap-x-4 gap-y-1 grid-cols-[6.2rem_1fr] text-[.92rem]">
          {skills.map((s) => (
            <div key={s.k} className="contents">
              <dt className="font-mono text-[10px] leading-[2.1] tracking-[.08em] uppercase text-ink-3">{s.k}</dt>
              <dd className="m-0 text-ink-2">{s.v}</dd>
            </div>
          ))}
        </dl>

        <h2 className={h2}>Open source</h2>
        <ul className="list-none p-0 m-0 mt-3">
          {prs.map((p) => (
            <li key={`${p.repo}${p.num}`} className="py-[.45rem] text-[.9rem] border-b border-[#E0DBCB] last:border-0">
              <span className="font-mono text-[11px] tracking-[.06em] uppercase text-ink-3">
                {p.merged ? `merged ${fmtDate(p.merged)}` : daysSince(p.opened) === 0 ? "opened today" : `open, ${daysSince(p.opened)} day${daysSince(p.opened) === 1 ? "" : "s"}`}
                {p.gain ? `, ${p.gain}` : ""}
              </span>
              <br />
              <a href={prUrl(p)}>{prRepo(p)} {p.num}</a>. <span className="text-ink-2">{p.what}.</span>
            </li>
          ))}
        </ul>

        <h2 className={h2}>Projects</h2>
        <ul className="list-none p-0 m-0 mt-3">
          {featured.map((p) => (
            <li key={p.name} className="py-[.45rem] text-[.9rem] border-b border-[#E0DBCB] last:border-0">
              <span className="font-mono text-[11px] tracking-[.06em] uppercase text-ink-3">{p.stack}</span>
              <br />
              {p.live || p.source ? <a href={p.live ?? p.source}>{p.name}</a> : p.name}.{" "}
              <span className="text-ink-2">{p.line ? `${p.line} ` : ""}{p.blurb}</span>
              {p.live && p.source ? <> <a href={p.source} className="text-ink-2">Source</a>.</> : null}
              {p.private ? <span className="text-ink-2"> It is private, and I am happy to walk you through it.</span> : null}
            </li>
          ))}
        </ul>

        <h2 className={h2}>Study</h2>
        <p className="m-0 mt-3 text-[.95rem] text-ink-2">{me.degree}, {me.years}. Grade point average {me.gpa}. Before that, {me.school}.</p>

        <h2 className={h2}>Picked for and ranked</h2>
        <ul className="list-none p-0 m-0 mt-3 text-[.92rem] text-ink-2">
          {achievements.map((a) => <li key={a.what} className="py-1">{a.what}, {a.when}. {a.note}.</li>)}
        </ul>

        <h2 className={h2}>Passed</h2>
        <ul className="list-none p-0 m-0 mt-3 text-[.92rem] text-ink-2">
          {certifications.map((c) => <li key={c.what} className="py-1">{c.what}, {c.when}.</li>)}
        </ul>

        <h2 className={h2}>Contest ratings, as of {RATINGS_AS_OF}</h2>
        <p className="m-0 mt-3 text-[.92rem] text-ink-2">
          {ratings.map((r) => `${r.k} ${r.v}`).join(" · ")}.
        </p>
      </article>

      </main>

      {/* recruiters genuinely print and project resumes, and almost nobody ships this */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #grain, #heap { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .print-flat { border: 0 !important; background: #fff !important; padding: 0 !important; }
          a { color: #000 !important; text-decoration: none; }
          a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 9pt; color: #444; }
          a[href^="mailto"]::after { content: ""; }
          h2 { break-after: avoid; }
          li { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
