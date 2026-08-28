import { type PR, prUrl, prRepo, daysSince } from "@/content/data";

export function Marg({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[.11em] uppercase text-ink-2 mb-5 flex gap-4 flex-wrap items-baseline">
      <span className="text-ultra-deep">{n}</span>
      {children}
    </p>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-chalk border border-[#C9C4B2] ${className}`}>{children}</div>;
}

/** merged or in review, said truthfully, with the link so the label checks itself */
export function PrTag({ p }: { p: PR }) {
  return p.state === "merged" ? (
    <span className="inline-block px-[.45rem] py-[.14rem] text-[10px] tracking-[.09em] uppercase border border-current text-moss">merged</span>
  ) : (
    <span className="inline-block px-[.45rem] py-[.14rem] text-[10px] tracking-[.09em] uppercase border border-current text-ultra-deep">in review</span>
  );
}

export function PrRow({ p }: { p: PR }) {
  return (
    <li className="border-t border-[#8F8C7E] py-4 grid gap-3 md:grid-cols-[9rem_1fr]">
      <div className="font-mono text-[11px] leading-[1.7] tracking-[.05em] text-ink-2">
        <PrTag p={p} />
        <br />
        {prRepo(p).split("/")[0]}
        <br />
        {p.state === "review" ? `${daysSince(p.date)} days in review` : new Date(p.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        {p.diff ? <><br />{p.diff}</> : null}
      </div>
      <div>
        <h3 className="font-mono text-[1.02rem]">{prRepo(p).split("/")[1]} <span className="text-ink-3">{p.num}</span></h3>
        <p className="mt-2 text-[.95rem] text-ink-2 max-w-[62ch]">{p.what}</p>
        <a href={prUrl(p)} className="inline-block mt-3 font-mono text-[11px] tracking-[.05em] text-ink-2 border-b border-[#8F8C7E] pb-[.2rem] no-underline hover:text-ultra-deep hover:border-ultra-deep">
          {prUrl(p).replace("https://", "")}
        </a>
      </div>
    </li>
  );
}
