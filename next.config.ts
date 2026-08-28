import type { NextConfig } from "next";

/** Images can come from either backend, so both hosts are allowed. */
const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  // Vercel Blob, the default. Every store gets its own subdomain.
  { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
];

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  remotePatterns.push({
    protocol: "https",
    hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
    pathname: "/storage/v1/object/public/**",
  });
}

const nextConfig: NextConfig = { images: { remotePatterns } };

export default nextConfig;
