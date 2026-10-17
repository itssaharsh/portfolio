import Link from "next/link";
import { type PR, type Project, type WorkGroup, prUrl, repoUrl, daysSince, fmtDate, me } from "@/content/data";

/**
 * The section links. One list feeds the bar on the homepage and the header on every other
 * page. On the homepage they are plain jumps down the page, so they work with no JavaScript.
 */
const NAV = [
  { label: "work", home: "#work", away: "/#work" },
  { label: "projects", home: "#projects", away: "/#projects" },
  { label: "writing", home: "#writing", away: "/blog" },
  { label: "about", home: "#about", away: "/#about" },
  { label: "resume", home: "/resume", away: "/resume" },
  { label: "contact", home: "#contact", away: "/#contact" },
] as const;

export type NavLabel = (typeof NAV)[number]["label"];

export function SiteNav({ home = false, current, className = "" }: { home?: boolean; current?: NavLabel; className?: string }) {
  return (
    <nav aria-label="Site" className={`font-mono text-[11px] tracking-[.04em] md:tracking-[.08em] uppercase ${className}`}>
      {/* six words have to share one line on a phone, so there they spread across the full width */}
      <ul className="list-none p-0 m-0 flex flex-wrap md:flex-nowrap justify-between gap-x-2 md:justify-start md:gap-x-4">
        {NAV.map((n) => (
          <li key={n.label}>
            <a
              href={home ? n.home : n.away}
              aria-current={current === n.label ? "page" : undefined}
              className="inline-block py-2 no-underline text-ink-2 hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline underline-offset-4"
            >
              {n.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** the top of every page that is not the homepage. the homepage carries the same links in its bar. */
export function SiteHeader({ current }: { current?: NavLabel }) {
  return (
    <header className="no-print flex items-center justify-between gap-x-6 gap-y-1 flex-wrap [&>nav]:w-full md:[&>nav]:w-auto">
      <Link href="/" className="flex items-center gap-[.55rem] no-underline font-mono text-[12.5px] tracking-[-.01em] text-ink">
        <span aria-hidden="true" className="grid place-items-center size-[22px] shrink-0 rounded-full bg-inkpanel text-cad text-[9px] leading-none">ST</span>
        {me.name}
      </Link>
      <SiteNav current={current} />
    </header>
  );
}

/** the small numbered label over each section. the label itself is the section heading. */
export function Marg({ n, title, children }: { n: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] tracking-[.11em] uppercase text-ink-2 mb-5 flex gap-x-4 gap-y-1 flex-wrap items-baseline">
      <span className="text-ultra-deep" aria-hidden="true">{n}</span>
      <h2 className="text-[11px] tracking-[.11em] leading-[inherit]">{title}</h2>
      {children}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-chalk border border-[#C9C4B2] ${className}`}>{children}</div>;
}

export const btn =
  "inline-block bg-inkpanel text-chalk font-mono text-[11px] tracking-[.1em] uppercase px-4 py-[.7rem] no-underline hover:bg-ultra-deep";
export const textLink =
  "underline decoration-hair underline-offset-4 hover:text-ultra-deep hover:decoration-ultra-deep";

/**
 * Merged or still open, always said in words, so it never rests on colour alone.
 *
 * Moss and rust only pass the contrast check on chalk, so that is the only place they are
 * used, with a small square beside them: filled has landed, hollow is still in the air. On
 * concrete the words stand alone in ink. A square there gets mistaken for one of the blocks
 * drifting behind the text.
 */
export function State({ p, on = "concrete" }: { p: PR; on?: "concrete" | "chalk" }) {
  const mark = (filled: boolean) =>
    on === "chalk" ? (
      <span aria-hidden="true" className={`inline-block size-[7px] mr-[.45rem] align-[1px] ${filled ? "bg-current" : "border border-current"}`} />
    ) : null;
  if (p.merged) return <span className={on === "chalk" ? "text-moss" : ""}>{mark(true)}merged {fmtDate(p.merged)}</span>;
  const days = daysSince(p.opened);
  return (
    <span className={on === "chalk" ? "text-rust" : "text-ultra-deep"}>
      {mark(false)}{days === 0 ? "opened today" : `open, ${days} day${days === 1 ? "" : "s"}`}
    </span>
  );
}

/** one pull request. the whole line is the link, because the sentence is what people try to click. */
function PrLine({ p }: { p: PR }) {
  return (
    <li className="border-t border-[#9C998B]">
      <a href={prUrl(p)} className="group grid grid-cols-[3.4rem_1fr] gap-x-3 py-[.6rem] no-underline">
        <span className="font-mono text-[12.5px] leading-[1.45rem] text-ink underline decoration-ink-2 underline-offset-4 group-hover:text-ultra-deep group-hover:decoration-ultra-deep">
          {p.num}
        </span>
        <span>
          <span className="block text-[.95rem] leading-[1.45] text-ink group-hover:text-ultra-deep">{p.what}</span>
          <span className="block mt-1 font-mono text-[11px] leading-[1.6] tracking-[.04em] text-ink-2">
            <State p={p} />
            {p.gain ? <> · <span className="text-ink">{p.gain}</span></> : null}
            {p.diff ? <> · {p.diff}</> : null}
          </span>
        </span>
      </a>
    </li>
  );
}

/** one project and everything sent to it, laid out the way a job history lists one employer */
export function WorkEntry({ g }: { g: WorkGroup }) {
  const [owner, name] = g.repo.full.split("/");
  const counts = [g.merged ? `${g.merged} merged` : "", g.open ? `${g.open} open` : ""].filter(Boolean).join(", ");
  return (
    <li className="border-t border-hair py-6 grid gap-x-6 gap-y-3 md:grid-cols-[10.5rem_1fr]">
      <div className="font-mono text-[11px] leading-[1.7] tracking-[.05em] text-ink-2">
        {owner}
        <br />
        {g.period}
        <br />
        {counts}
      </div>
      <div>
        <h3 className="text-[1.08rem] [overflow-wrap:anywhere]">
          <a href={repoUrl(g.key)} className={textLink}>{name}</a>
        </h3>
        <p className="m-0 mt-2 text-[.95rem] text-ink-2 max-w-[62ch]">{g.repo.is}</p>
        <ul className="list-none p-0 m-0 mt-4">
          {g.prs.map((p) => <PrLine key={p.num} p={p} />)}
        </ul>
      </div>
    </li>
  );
}

/** live, demo and source, named for what each one opens. a private project says so instead. */
export function ProjectLinks({ p, className = "" }: { p: Project; className?: string }) {
  return (
    <p className={`m-0 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tracking-[.06em] uppercase ${className}`}>
      {p.live ? <a href={p.live} aria-label={`open it live: ${p.name}`} className={`inline-block py-1 text-ultra-deep ${textLink}`}>open it live</a> : null}
      {p.demo ? <a href={p.demo} aria-label={`demo of ${p.name}`} className={`inline-block py-1 ${textLink}`}>demo</a> : null}
      {p.source ? <a href={p.source} aria-label={`source for ${p.name}`} className={`inline-block py-1 ${textLink}`}>source</a> : null}
      {p.private ? <span className="inline-block py-1 normal-case tracking-[.02em]">{p.note}</span> : null}
    </p>
  );
}

const projectMeta = (p: Project) => [p.stack, p.built ? `built for ${p.built}` : ""].filter(Boolean).join(" · ");

export function ProjectCard({ p }: { p: Project }) {
  return (
    <article className="bg-chalk p-5 flex flex-col">
      <h3 className="text-[1.05rem]">{p.name}</h3>
      {p.line ? <p className="m-0 mt-3 text-[.98rem] leading-[1.38] text-ink">{p.line}</p> : null}
      <p className="m-0 mt-2 text-[.88rem] leading-[1.48] text-ink-2">{p.blurb}</p>
      <p className="m-0 mt-auto pt-4 font-mono text-[10.5px] leading-[1.55] tracking-[.06em] uppercase text-ink-3">{projectMeta(p)}</p>
      <ProjectLinks p={p} className="mt-2" />
    </article>
  );
}

export function ProjectRow({ p }: { p: Project }) {
  return (
    <li className="border-t border-hair py-4 grid gap-x-6 gap-y-2 md:grid-cols-[10.5rem_1fr]">
      <h4 className="m-0 font-mono font-normal text-[.98rem] leading-[1.25] tracking-[-.02em]">{p.name}</h4>
      <div>
        <p className="m-0 text-[.92rem] leading-[1.45] text-ink-2 max-w-[62ch]">{p.line ? `${p.line} ` : ""}{p.blurb}</p>
        <p className="m-0 mt-2 font-mono text-[10.5px] leading-[1.55] tracking-[.06em] uppercase text-ink-2">{projectMeta(p)}</p>
        <ProjectLinks p={p} className="mt-1 text-ink-2" />
      </div>
    </li>
  );
}
