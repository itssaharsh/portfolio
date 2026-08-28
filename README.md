# saharsh.dev

The floor of this site is 421 blocks. That is the exact number of memory allocations removed in
[kubernetes-sigs/resource-state-metrics#102](https://github.com/kubernetes-sigs/resource-state-metrics/pull/102),
down to 2. Push them around. Press `g`.

Next.js 16 · React 19 · Tailwind 4 · Supabase · matter-js · Go Mono, subset by hand.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

The site works without Supabase. The blog shows an empty state and the writing desk explains what is missing.

## Putting it live

1. Create a Supabase project.
Full walkthrough in [`SETUP.md`](SETUP.md). The short version:

1. Create a Neon project, run `db/schema.sql` in its SQL editor.
2. Run `db/seed.sql` to put the first post in.
3. Import the repo on Vercel with the values from `.env.example`, set on the import screen.
4. Add a public Blob store, then redeploy so the token is picked up.
5. Go to `/admin`, sign in with your password, and write. Drag an image straight into the text.

## Rules this repo keeps

Every fact on the site comes from [`content/data.ts`](content/data.ts). Nothing may assert anything
that is not in there. Two claims on the resume are wrong and are deliberately not repeated:
collector-contrib 46819 is closed rather than merged, and SeedSigner 916 and 927 are still open.

Prose carries no dashes and no jargon. Repository names, URLs and benchmark output keep their real
characters, because changing those would break links and misname real projects.

## Rebuilding the resume

```bash
npm run resume    # resume.tex -> public/resume.pdf
```
