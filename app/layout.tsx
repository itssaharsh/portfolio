import type { Metadata } from "next";
import localFont from "next/font/local";
import { Archivo } from "next/font/google";
import "./globals.css";
import { me } from "@/content/data";

/* Go Mono is not on Google Fonts. The 173,248 byte original comes from
   go.googlesource.com, by Bigelow and Holmes for the Go project, BSD licensed.
   Subset here to 10,756 bytes. Bold is a real second file, because faux bold on a
   monospace face is visibly wrong and an engineer will see it. */
const goMono = localFont({
  variable: "--font-go-mono",
  display: "swap",
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

export const metadata: Metadata = {
  title: `${me.name} · takes things out of hot paths`,
  description:
    "Second year computer science student in Pune. Eleven changes merged into OpenTelemetry, the standard the cloud uses to watch its own software. Ten more open and under review.",
  openGraph: {
    title: `${me.name}`,
    description:
      "Eleven changes merged into OpenTelemetry. Ten more open and under review. Go, performance, and the parts of a program that run on every request.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${goMono.variable} ${archivo.variable}`}>
      <body
        style={
          {
            "--font-mono": `var(--font-go-mono), ui-monospace, Menlo, monospace`,
            "--font-sans": `var(--font-archivo), system-ui, sans-serif`,
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
