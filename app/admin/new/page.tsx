import Link from "next/link";
import Editor from "../Editor";
import Login from "../login/page";
import { signedIn } from "@/lib/auth";

export const metadata = { title: "Write something" };
export const dynamic = "force-dynamic";

export default async function New() {
  // Signed out, this page is the sign in. It is drawn here, not reached by a redirect: after a
  // save posted with JavaScript off, Next answers a redirect from a page with a 307, the browser
  // posts the form again to the sign in page, and that ends in "Internal Server Error".
  if (!(await signedIn())) return <Login />;
  return (
    <main id="main" className="mx-auto max-w-[52rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <Link href="/admin" className="font-mono text-[11px] tracking-[.1em] uppercase text-ink-2 no-underline">back to the desk</Link>
      <h1 className="text-[1.6rem] mt-4">Write something</h1>
      <Editor />
    </main>
  );
}
