# Setup, in order

About twenty minutes. Nothing here needs a credit card.

---

## 1. Make two secrets

```bash
openssl rand -base64 24     # this is ADMIN_PASSWORD
openssl rand -base64 32     # this is SESSION_SECRET
```

Keep them somewhere. The first is what you type to sign in. Do not pick a memorable password
instead: there is no rate limiting on the sign in, so the only thing protecting it is that the
password is not guessable.

Changing `SESSION_SECRET` later signs you out of every device instantly. That is your emergency stop.

---

## 2. Neon, for the posts

1. Go to **neon.com** and sign up with GitHub. No card.
2. Create a project. Any name, any region near you.
3. On the dashboard, copy the **pooled** connection string. It looks like
   `postgresql://user:pass@ep-something-pooler.region.aws.neon.tech/neondb?sslmode=require`.
   That is `DATABASE_URL`.
4. Open the **SQL Editor** in Neon, paste the whole of `db/schema.sql`, run it.
5. Optionally paste `db/seed.sql` and run that too. It puts the OpenTelemetry post in as a
   **draft**, so nothing is public until you say so.

What you get free, from Neon's own pricing page: 0.5 GB, 100 compute hours a month, permanent, no
card. It sleeps after five minutes of no traffic, so the first visitor after a quiet spell waits
about a second. Everyone after that does not.

---

## 3. Vercel, for the site and the images

1. **vercel.com** → Add New → Project → import `itssaharsh/portfolio`.
2. It will detect Next.js. Do not change the build settings.
3. Before you press Deploy, add the environment variables:

   | Name | Value |
   |---|---|
   | `BLOG_STORE` | `neon` |
   | `ADMIN_PASSWORD` | the first secret from step 1 |
   | `SESSION_SECRET` | the second secret from step 1 |
   | `DATABASE_URL` | the pooled string from Neon |
   | `NEXT_PUBLIC_SITE_URL` | your address, once you know it |

4. Deploy.
5. Then go to the **Storage** tab, create a **Blob** store, and connect it to this project.
   Vercel sets `BLOB_READ_WRITE_TOKEN` for you. **Redeploy** so the new variable is picked up.

Blob free allowance: 1 GB stored, 10 GB transfer a month. If you ever exceed it, it stops working
until the month rolls over rather than charging you.

---

## 4. Check it worked

- The site loads, and the blocks fall in.
- `/blog` loads and says nothing is published yet.
- `/admin` sends you to a password box.
- Sign in. Write something. Drag an image into the text. Publish. It appears immediately.
- Sign out, then open `/admin` in a private window and confirm it will not let you in.

---

## 5. The old address

Applications you have already sent link to `itssaharsh.github.io/portfolio`. The `index.html` in
the repo root keeps that landing on a page saying the site moved, rather than a 404.

Once Vercel gives you the real address, put it in that file's link, and add this line inside its
`<head>` so it forwards automatically:

```html
<meta http-equiv="refresh" content="0; url=https://your-real-address">
```

Do not add the redirect before you have loaded the address yourself and seen it work.

---

## When Supabase frees up

Nothing has to be rewritten. In Vercel:

1. Set `BLOG_STORE=supabase`.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Run the same `db/schema.sql` in the Supabase SQL editor.
4. Create a public storage bucket called `post-images`.
5. Redeploy.

Sign in does not change, because it was never part of the storage.

Moving existing posts across is a `pg_dump` of the `posts` table from Neon and a restore into
Supabase. Ask me and I will write the command out.

---

## Two things still on you

**Your resume has two claims GitHub disagrees with.** `resume.tex` lists
`opentelemetry-collector-contrib` 46819 under merged work, and the API says it is **closed**.
It also presents SeedSigner 916 and 927 as delivered, and both are still **open**. The site does not
repeat either, but the PDF a recruiter downloads still does. Fix `resume.tex`, then run
`npm run resume`.

**The seeded post is a draft on purpose.** It is 991 words in plain language about what
OpenTelemetry actually is. Read it, put it in your own voice, then publish it. It reads better
coming from you than from me.
