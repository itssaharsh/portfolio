import type { Metadata } from "next";
import Link from "next/link";
import { me, links, merged, inReview, ratings, RATINGS_AS_OF, achievements, prUrl, prRepo, daysSince } from "@/content/data";

export const metadata: Metadata = { title: `Resume · ${me.name}` };
export const revalidate = 86400;

export default function Resume() {
  return (
    <main className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2.5rem,6vw,4.5rem)]">
      <div className="flex items-baseline justify-between gap-4 flex-wrap no-print">
        <Link href="/" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">back to the floor</Link>
        <a href="/resume.pdf" download className="font-mono text-[11px] tracking-[.1em] uppercase bg-inkpanel text-chalk px-3 py-2 no-underline">download the pdf</a>
      </div>

      <article className="bg-chalk border border-[#C9C4B2] p-[clamp(1.4rem,4vw,2.6rem)] mt-6 print-flat">
        <h1 className="text-[clamp(1.6rem,1.2rem+1.6vw,2.2rem)]">{me.name}</h1>
        <p className="font-mono text-[11px] tracking-[.06em] mt-2 text-ink-2">
          {me.place} · <a href={`mailto:${me.email}`}>{me.email}</a> · <a href={links.github}>github.com/itssaharsh</a> · <a href={links.linkedin}>linkedin</a>
        </p>

        <h2 className="font-mono text-[.78rem] tracking-[.14em] uppercase mt-8 pb-1 border-b border-[#C9C4B2]">What I do</h2>
        <p className="mt-3 text-[.95rem] text-ink-2">
          I make other people&apos;s Go code faster, in small measured amounts, in projects a lot of the
          internet already runs on. {merged.length} of my changes are merged into OpenTelemetry and pandas.
          {" "}{inReview.length} more are open and being reviewed right now.
        </p>

        <h2 className="font-mono text-[.78rem] tracking-[.14em] uppercase mt-8 pb-1 border-b border-[#C9C4B2]">Open source</h2>
        <ul className="list-none p-0 mt-3">
          {[...inReview, ...merged].map((p) => (
            <li key={`${p.repo}${p.num}`} className="py-[.45rem] text-[.9rem] border-b border-[#E0DBCB] last:border-0">
              <span className="font-mono text-[11px] tracking-[.06em] uppercase text-ink-3">
                {p.state === "merged" ? "merged" : `in review, ${daysSince(p.date)} days`}
              </span>
              <br />
              <a href={prUrl(p)}>{prRepo(p)} {p.num}</a> — <span className="text-ink-2">{p.what}</span>
            </li>
          ))}
        </ul>

        <h2 className="font-mono text-[.78rem] tracking-[.14em] uppercase mt-8 pb-1 border-b border-[#C9C4B2]">Study</h2>
        <p className="mt-3 text-[.95rem] text-ink-2">{me.degree}, {me.years}. Grade point average {me.gpa}. Before that, {me.school}.</p>

        <h2 className="font-mono text-[.78rem] tracking-[.14em] uppercase mt-8 pb-1 border-b border-[#C9C4B2]">Picked for</h2>
        <ul className="list-none p-0 mt-3 text-[.92rem] text-ink-2">
          {achievements.map((a) => <li key={a.what} className="py-1">{a.what}, {a.when}. {a.note}.</li>)}
        </ul>

        <h2 className="font-mono text-[.78rem] tracking-[.14em] uppercase mt-8 pb-1 border-b border-[#C9C4B2]">Contests, as of {RATINGS_AS_OF}</h2>
        <p className="mt-3 text-[.92rem] text-ink-2">
          {ratings.map((r) => `${r.k} ${r.v}`).join(" · ")}. These are peaks rather than current.
        </p>
      </article>

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
    </main>
  );
}
