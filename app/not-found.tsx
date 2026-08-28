import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[40rem] px-6 py-[clamp(4rem,12vw,8rem)]">
      <h1 className="text-[clamp(1.8rem,1.3rem+2vw,2.6rem)]">Collected.</h1>
      <p className="mt-4 text-ink-2 max-w-[46ch]">
        Whatever was here is not any more. Nothing points at it, so it got swept.
      </p>
      <Link href="/" className="inline-block mt-6 font-mono text-[11px] tracking-[.1em] uppercase bg-inkpanel text-chalk px-4 py-3 no-underline">
        back to the floor
      </Link>
    </main>
  );
}
