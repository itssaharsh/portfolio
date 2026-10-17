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
openssl rand -base64 24     # paste as SESSION_SECRET
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
- On the desk, press delete beside a post you do not need. It asks first, on a page that names
  the post.
- Open one post in two tabs, save in one, then in the other. The second is refused and says
  why, and what you typed there is offered back when you load the page again.

Images are capped at 4MB each, because Vercel Functions refuse request bodies over 4.5MB.

---

## Part 5. The old address

Applications you have already sent point at `itssaharsh.github.io/portfolio`. The `index.html` in
the repo root keeps that landing on a page that says the site moved, instead of a 404. It is
ignored by Next and by Vercel.

That page sends people straight on to `https://itssaharsh.vercel.app/`. The address was loaded
and seen working first, on 2026-10-05, because a redirect to an address nobody has tested is
worse than a page that only says the site moved. If the address ever changes, it is written in
that file in three places: in the link, which both points to it and shows it as its text, in
the `canonical` line, and in this one:

```html
<meta http-equiv="refresh" content="0; url=https://itssaharsh.vercel.app/">
```

### A custom domain, if you buy one

Settings → Domains → add it → Vercel gives you the DNS records to paste at your registrar. Then
update `NEXT_PUBLIC_SITE_URL` and redeploy. A real domain on a resume reads better than a
`vercel.app` address, but it is not urgent.

---

## Part 6. Posting from a text file

The writing desk at `/admin` is one way to write. This is the other, for when the words are
already in a file.

```bash
./post notes.txt
```

The first line is the title and everything under it is the post. Write it the way you would
write an email: a blank line between paragraphs, and a short line on its own wherever you want
a heading. The command works out the rest, shows you the title, the word count, the headings it
found and the summary it will use, then publishes and prints the address.

Lines straight under the title can set things: `tags: go, opentelemetry`, `summary: ...`,
`slug: some-words`, `draft: yes`. Keep them together, with no blank line and no other line
between them, and do not indent them. When the command finds one out of place at the top of the
file, it stops, shows the line and says what to do with it. A `draft: yes` with only a blank
line between it and the other settings is found that way. So is one under a summary that
wrapped onto a second line, one under a line of text, and one pushed in by the tab key. A first
line that is itself a setting stops the command too, so put the title above it. `draft: 'yes'`
and a setting with up to three spaces in front of it are read. `draft: yep`, or any draft line
of three words or fewer that is not a yes or a no, stops the command.

Text indented by four spaces or a tab is code, so a post can show a sample of someone else's
settings: put a blank line above the sample and indent every line of it, or put it between two
lines of three backticks. Straight under the title, or under a line of text, an indent does not
make a setting line code, so the command stops there and shows the line. Under the title it
gives both ways out, because it cannot know which was meant: take the indent off, or put a
blank line above the sample.

```bash
./post notes.txt --dry-run     # look first. nothing is sent.
./post notes.txt --draft       # saved, but only the desk can see it
./post notes.txt --tags "go, opentelemetry"
./post --help                  # every flag
```

`npm run post notes.txt` does the same thing. Through npm, flags have to come after a double
dash, as in `npm run post notes.txt -- --draft`, because npm keeps any flag typed before one for
itself. What happens then depends on the npm. Versions 10 and 11 pass only the file name on. The
command reads back the flags it knows when that has happened, and stops when one of them lost
its value on the way. It cannot do that for a flag that was also misspelt. That one is simply
gone, and the post goes out as if it had never been typed. Version 12 refuses to run at all
when it meets a flag it does not know. `./post` has no such trap on any of them: it stops at
anything it does not recognise.

It needs one thing: `ADMIN_PASSWORD` in `.env.local`, set to the same password as on Vercel. It
sends the post to `/api/posts` on the live site, which checks the password and saves it through
the same code as the desk.

Run it again on the same file and the post it made is updated, and it keeps the day it first
went out. The command remembers which address each file last posted to, in
`.post-backups/posted.json` on this machine, so a corrected title updates that post too.

Before it changes anything it asks the site what is there. It changes a post only when the file
is plainly a version of it. Under the same title that means most of the old text is still
there. Under a new title it means nearly all of each text is in the other, which is what a fixed
title and a few fixed typos look like. It makes a new post only when the file is plainly new. In
every case between, it stops, tells you what it found, and asks. A rewrite that keeps less than
half of a post is one such case. So is a file with the title of a post that is already there and
little or none of its text, which is what next week's notes look like. So is a new title over
text that quotes a good part of an old post. And so is any change to a post of under about
thirty words, even one fixed typo, because that is too little text to be sure of. The answer is
one of three flags:

```bash
./post notes.txt --same-post    # it is that post. change it where it is, and keep its date,
                                # its tags and whether it is out
./post notes.txt --separate     # it is a new post. put it beside the one that looks like it
./post notes.txt --overwrite    # it is a different post. replace the one at that address
```

From a different file or another machine the command has nothing to remember, and a retitled
post would go up as a second copy. The site catches that itself: it refuses a new post when most
of its text is already in another one, or most of another one is in it, names that post, and
the command prints the two answers, `--slug` with that post's address and `--same-post`, or
`--separate`. It needs about thirty words in common to be sure, so a post shorter than that,
sent again from another file with a word changed, is not caught.

Each flag and address the command prints as an answer can be typed back as printed. `--slug`
takes the last part of an address, or the whole address pasted from a browser, and then drops
whatever follows a `?` or a `#`.

A draft stays a draft unless you add `--publish`, and a live post stays live unless you add
`--draft`. There are two exceptions. `--overwrite` puts a new post where a different one was,
so nothing carries over: it gets today's date and its own tags and summary, and it is published
unless the file says `draft: yes` or you add `--draft`. And the undo of an overwrite, described
below, puts the old post back as a draft unless it was live then and the address is live now. A
summary you wrote by hand at the desk is left alone unless you pass `--summary`.

Whatever it replaces is saved first in `.post-backups/`, as a file you can post back with the
same command. The command prints that line for you, under "To put it back". When the run
changed whether the post is out, the line ends in `--publish` or `--draft`. The copy carries
the title, the address, the tags, the summary, the cover and the day it went out. Posting a
copy back never makes anything live by itself. If the copy was of a live post and what is there
now is a draft, it goes back as a draft and tells you to add `--publish`. A kept copy goes back
to its own address and nowhere else, so `--slug`, `--same-post` and `--separate` do not go with
one.

A copy says why it was kept, and the two kinds are put back differently. A copy kept before an
ordinary update is an older version of one post. It asks first in two cases. When another post
altogether sits at its address now, it wants `--overwrite`. And when the copy was of a draft
and the page is live now with other words on it, it wants `--publish` or `--draft`, because
the copy's words have never been out. A copy kept before an overwrite is the undo of that
overwrite. It takes the place of whatever is at its address now, without asking, and it comes
back as a draft unless it was live then and the address is live now. What it replaces is kept
first, like anything else. The one time it does not replace is when what is there is plainly
its own post, and then it is put back like any older version.

One thing the printed line does not put back. A draft that has never been out has no date. It
is given one the first time it goes out, and the site keeps a date once a post has one. So a
draft that went out by mistake and was put back keeps that day. The command says so when it
happens, and a line like `date: 2026-11-05` under the title sets another day.

If it says the site has no `/api/posts`, the code has not been deployed yet. If it says the
password was not accepted, `.env.local` and Vercel disagree.

---

## When Supabase frees up

Nothing gets rewritten. In Vercel: set `BLOG_STORE=supabase`, add `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, run the same `db/schema.sql` in the Supabase SQL editor, create a
public bucket called `post-images`, and redeploy. Sign in does not change, because it was never
part of the storage.

---

## Two things still on you

**The Neon password was pasted into a chat and still needs rotating.** Reset it in the Neon
console, put the new connection string in Vercel as `DATABASE_URL` and in `.env.local`, then
redeploy, because Vercel does not apply a changed variable to a deployment that already exists.

**Pull requests change without telling the site.** Run `npm run facts` every so often. When it
reports that something was merged or closed, fix `content/data.ts`, then `resume.tex`, then run
`npm run resume` so the PDF a recruiter downloads says the same thing as the page.
