import type { Metadata } from "next";
import localFont from "next/font/local";
import { Archivo } from "next/font/google";
import "./globals.css";
import { me, merged, stillOpen, mergedOrgs, sentenceList } from "@/content/data";
import { siteBase } from "@/lib/site";

/* Go Mono is not on Google Fonts. The 173,248 byte original comes from
   go.googlesource.com, by Bigelow and Holmes for the Go project, BSD licensed.
   Subset here to 10,756 bytes. Bold is a real second file, because faux bold on a
   monospace face is visibly wrong and an engineer will see it. */
const goMono = localFont({
  variable: "--font-go-mono",
  display: "swap",
  /* The subset holds 107 characters. Anything else in a code block, a µ or a ±, used to fall to
     the stand in next/font adds for a local face, which is Arial stretched by a third, and
     pushed the column out of line. With this off it falls to the next monospace face instead. */
  adjustFontFallback: false,
  src: [
    { path: "../public/fonts/go-mono.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/go-mono-bold.woff2", weight: "700", style: "normal" },
  ],
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

/* Only posts use emphasis, so the italic is its own face and is never preloaded. A page with
   no slanted word on it never asks for the file. */
const archivoItalic = Archivo({
  subsets: ["latin"],
  style: "italic",
  variable: "--font-archivo-italic",
  display: "swap",
  preload: false,
});

/* counted from the data, so a pull request that gets merged cannot leave this saying otherwise */
const record = `${merged.length} changes merged into ${sentenceList(mergedOrgs)}.${stillOpen.length > 0 ? ` ${stillOpen.length} more open.` : ""}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteBase()),
  title: `${me.name} · takes things out of hot paths`,
  description: `${me.intro}. ${record}`,
  openGraph: {
    title: `${me.name}`,
    description: `${record} Go, performance, and the parts of a program that run on every request.`,
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${goMono.variable} ${archivo.variable} ${archivoItalic.variable}`}>
      <body
        style={
          {
            "--font-mono": `var(--font-go-mono), ui-monospace, Menlo, monospace`,
            "--font-sans": `var(--font-archivo), system-ui, sans-serif`,
          } as React.CSSProperties
        }
      >
        <a href="#main" className="skip-link">skip to the content</a>
        {children}
      </body>
    </html>
  );
}
