# Running it, and putting it live

Every step below was checked against the current Vercel and Neon documentation, and the local
path was tested from a clean clone. Nothing needs a credit card.

---

## Part 1. Running it on your machine

```bash
git clone https://github.com/itssaharsh/portfolio
cd portfolio
npm install
npm run dev
```

Open **http://localhost:3000**. That is the whole thing.

**It runs with no configuration at all.** Verified from a fresh clone: the homepage, the blog and
the resume all serve, `/admin` correctly bounces you to the sign in page, and the build succeeds
with an empty environment. The blog just says nothing is published yet, because there is no
database behind it. Ready in about 1.4 seconds.

To write posts locally, make a `.env.local` (it is gitignored, it never leaves your machine):

```bash
cp .env.example .env.local
openssl rand -base64 24     # paste as ADMIN_PASSWORD
openssl rand -base64 32     # paste as SESSION_SECRET
```

Fill `DATABASE_URL` too once you have done Part 2. `next dev` reads `.env.local` on its own.

To check the real production build before pushing:

```bash
npm run build && npm start
```

---

## Part 2. Neon, which holds the posts

1. Go to **neon.com**, sign up with GitHub. No card.
2. Create a project. Any name. Pick a region near you.
3. On the **Project Dashboard**, click **Connect**. Leave the **Connection pooling** toggle **on**,
   which is the default, and copy the string. The hostname will contain `-pooler`.
   That is your `DATABASE_URL`.

   Use it exactly as given. Do not append anything. It already carries `sslmode` and
   `channel_binding`. Neon's own guide says to assign it as is.

   Pooled is right here because this app opens many short lived connections. Direct is for schema
   migrations and long lived connections, which is not what this does.

4. Open **SQL Editor** in the Neon console. It is in the left sidebar under your project, below
   Tables. Paste the whole of **`db/schema.sql`** and press Run. Multi statement scripts work
   there, so the whole file goes in at once.
5. Paste **`db/seed.sql`** and run that too. It publishes the first post.

**Already done for the current database.** The schema is applied and the post is live, verified by
querying it back. You only need this section again if you ever start a fresh Neon project.

Free forever: 0.5 GB and 100 compute hours a month, from Neon's own pricing page. The database
sleeps after five minutes of no traffic, so the first visitor after a quiet spell waits about a
second. Nobody after that does. If you ever run out of compute hours the database is suspended,
not deleted.

---

## Part 3. Vercel, which serves the site

**Read this bit before you start, it saves a confusing hour.** Vercel's docs are explicit:

> Changes to environment variables are not applied to previous deployments, they only apply to new
> deployments. You must redeploy your project.

So set everything on the **import screen, before you press Deploy**. Anything added later needs a
redeploy before it does anything.

1. **vercel.com** → **New Project** → import `itssaharsh/portfolio`.
2. It detects Next.js on its own. Do not touch the build settings. Turbopack is already the
   default bundler and needs no configuration. Node 24 is the default and is correct, so leave
   `engines` out of `package.json`.
3. Expand **Environment Variables** on that same screen and add:

   | Name | Value |
   |---|---|
   | `BLOG_STORE` | `neon` |
   | `ADMIN_PASSWORD` | your first secret |
   | `SESSION_SECRET` | your second secret |
   | `DATABASE_URL` | the pooled string from Neon |

   Leave `NEXT_PUBLIC_SITE_URL` for now. You do not know the address yet.
4. Press **Deploy**.

### Then the image store

5. In the project, go to **Storage** → **Create Database** → **Blob**.
6. Set access to **Public**. This cannot be changed later, and blog images need to be public.
   The region cannot be changed later either.
7. Tick **Development** as well as Production and Preview, so `vercel env pull` gives you the
   token locally too.
8. **Redeploy.** Vercel adds `BLOB_READ_WRITE_TOKEN` when you connect the store, and by the rule
   above your live deployment cannot see it until you redeploy. Uploads fail until you do.

   Deployments tab → the newest one → the three dots → **Redeploy**.

### Then the address

9. Your project gets a stable `something.vercel.app`. Copy it.
10. Settings → Environment Variables → add `NEXT_PUBLIC_SITE_URL` with that address → **redeploy**.
    This one is baked in at build time, which is why it needs the redeploy.

**Permanently live from here on.** Every push to `main` deploys to production automatically. Pushes
to any other branch get their own preview URL and do not touch the live site.

---

## Part 4. Check it actually works

- The site loads and the blocks fall in. Press `g`.
- `/blog` loads.
- `/admin` asks for the password. Type it. You are in for seven days.
- Write a post, drag an image into the text, tick Published, save. It appears immediately.
- Search a word from inside the post body on `/blog`.
- Open `/admin` in a private window and confirm it will not let you in.

Images are capped at 4MB each, because Vercel Functions refuse request bodies over 4.5MB.

---

## Part 5. The old address

Applications you have already sent point at `itssaharsh.github.io/portfolio`. The `index.html` in
the repo root keeps that landing on a page that says the site moved, instead of a 404. It is
ignored by Next and by Vercel.

Once you have loaded your real address and seen it work, edit that file: put the address in the
link, and add this inside its `<head>`:

```html
<meta http-equiv="refresh" content="0; url=https://your-real-address">
```

Not before. A redirect to an address you have not tested is worse than the page that is there now.

### A custom domain, if you buy one

Settings → Domains → add it → Vercel gives you the DNS records to paste at your registrar. Then
update `NEXT_PUBLIC_SITE_URL` and redeploy. A real domain on a resume reads better than a
`vercel.app` address, but it is not urgent.

---

## When Supabase frees up

Nothing gets rewritten. In Vercel: set `BLOG_STORE=supabase`, add `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, run the same `db/schema.sql` in the Supabase SQL editor, create a
public bucket called `post-images`, and redeploy. Sign in does not change, because it was never
part of the storage.

---

## Two things still on you

**Your resume contradicts GitHub in two places.** `resume.tex` lists
`opentelemetry-collector-contrib` 46819 as merged work and the API reports it **closed**. It also
presents SeedSigner 916 and 927 as delivered, and both are still **open**. The site does not repeat
either claim, but the PDF a recruiter downloads still does. Fix `resume.tex`, then run
`npm run resume`.

**The seeded post is a draft deliberately.** 991 words in plain language on what OpenTelemetry
actually is. Read it, make it sound like you, then publish.
