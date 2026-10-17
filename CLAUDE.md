# CLAUDE.md

Read this before touching anything. It is the project's memory, so you do not have to
rediscover the state or repeat mistakes that have already been made and fixed.

## What this is

Saharsh Tibrewala's portfolio. Live at **https://itssaharsh.vercel.app**, repo
`itssaharsh/portfolio`, deployed from `main` on Vercel automatically.

Audience is engineering hiring managers. The research this was built on found the median
recruiter spends **31 seconds**, and that the strongest negative predictor in the largest
study available was **typo count**. So: proofread harder than you optimise, and never bury the
evidence.

## Two rules that override your instincts

**1. `content/data.ts` is the only source of facts.**
Nothing on the site may assert anything not in that file. It carries every pull request with
its real state, the projects, the ratings, the achievements. If you need a new fact, verify it
against the source first, then add it there, then render it. Never inline a fact in a component.

Two claims on Saharsh's own resume were wrong and are deliberately not repeated anywhere:
`opentelemetry-collector-contrib` 46819 is **closed**, not merged, and SeedSigner 916 and 927
are **open**, not delivered. Both are now corrected in `resume.tex` too. Open work is labelled
"open" with the days since it was opened and a link, so the label checks itself. It is not
called "in review": several have sat for months with nobody reading them. A draft is not listed
at all. SeedSigner 929 and 930 are drafts, and the maintainer turned 929 down.

**The labels go stale without telling anyone.** A maintainer pressing merge does not update
`content/data.ts`. On 2026-10-05 the site had spent five weeks calling its best work unmerged
when five of the ten pull requests it listed as in review had landed, including 102, the change
the floor is made of.
Three newer ones were not listed at all, and two that were listed had become drafts.
Run `npm run facts` at the start of any session that touches content. It checks every state,
every date and every count of lines added and removed, and lists any open pull request the site
does not have. If it reports a change, fix `content/data.ts`, then `resume.tex`, then
`npm run resume`.

**A benchmark figure comes from the last run its author posted, not the first.** `npm run facts`
cannot check a benchmark figure, so this is done by reading the whole thread. The description of a pull
request is written on day one. Compile instrumentation 1137 says 19% there, and the run posted
the day before it merged, against a main that had got faster, says 12%. The site had the 19.
The benchmark panel had a command and timings that were never in its pull request at all. Where
a benchmark gave two results, both are shown, and the one for the common case leads.

**2. Voice: plain human language, no jargon, and no dashes in prose.**
No em dash, no en dash, no hyphen as a connector. Rewrite the sentence instead. The exception
is URLs, repository names, package names and benchmark output, which keep their real characters
because changing them breaks links and misnames real projects. No emoji anywhere.

"No jargon" is never resolved by becoming vague. Every concrete number survives; only the
vocabulary changes.

## The design, and the one rule holding it up

Direction is **Mark and Sweep**. The floor of the page is **421 physics blocks**, the exact
number of allocations a single run used to make before `kubernetes-sigs/resource-state-metrics`
102 brought it down to 2. You can
shove them, throw them, flip gravity, and press `g` to garbage collect. Two blocks never sleep;
nothing on the page says why.

**Spectacle and evidence are architecturally separate, and this must stay true.** Every route
is statically generated with the headline, all prose, every benchmark and all 22 pull request
links in the server HTML at full opacity with no entrance animation. The physics is imported
inside a `useEffect` so matter-js lands in its own chunk after first paint. With JavaScript off
the page keeps about 2,600 readable words and every link. If you break that, the site stops being
defensible for a performance engineer.

The homepage reads in the order a reviewer needs it: who and what and the four numbers, then
01 the change the floor is made of, 02 open source grouped by project like a job history,
03 projects with six shown in full and the rest listed, 04 writing, 05 about, 06 the record,
07 get in touch. The six are whichever projects carry `featured` in `content/data.ts`. They alternate Go with something
that can be opened live, so the grid backs the headline instead of contradicting it. The
section links sit in the bar on a wide screen and at the top of the hero on a phone. Both are
plain links in the server HTML, passed into `Heap` as children, so they work with no JavaScript.

Palette and type are in `app/globals.css`. Warm concrete `#ABA89A`, never near black, never the
cream cluster. Go Mono is the voice, subset by hand to 10,756 bytes in `public/fonts` because it
is not on Google Fonts. Archivo carries prose. **No gradients, no glass, no shadows, no rounded
cards.** Ultramarine `#2A2BD6` is 3.64:1 on concrete, so it is for large text and non text only;
small text on concrete uses `--color-ultra-deep`. Moss, rust and `ink-3` only pass on chalk
and are under 3:1 on concrete, so on concrete a state is said in words with a filled or hollow
square beside it, in ink.

## Layout

```
content/data.ts        every fact. start here.
app/page.tsx           the homepage, all sections
components/Heap.tsx    the physics. client only, loads after paint
components/ui.tsx      shared pieces: the nav, a work entry, a project card, the merged or open mark
lib/store/types.ts     the PostStore interface the blog talks to
lib/store/{neon,supabase}.ts   the two adapters
lib/store/index.ts     picks one from BLOG_STORE
lib/auth.ts            sign in. one password, a jose signed cookie. NOT part of the store.
lib/posts.ts           markdown rendering and the safe read wrappers
lib/site.ts            the address the site is served from. use this, never the variable directly.
app/admin/*            the writing desk
app/admin/delete/[id]  the page that asks before a post is deleted. the list only links to it.
app/admin/error.tsx    what the desk shows when a page throws or a save never gets an answer
app/api/health         says whether the database is reachable, without leaking the credential
app/api/posts          what `./post` talks to. checks the password itself, like every action.
scripts/post.mjs       a plain text file in, a published post out. the files and the network.
post                   a few lines of shell so that is `./post notes.txt`, with no npm in the way
scripts/post-text.mjs  the rules that turn text into a post. its tests sit beside it.
scripts/post-plan.mjs  what the command decides before it sends anything: the flags, and what
                       a post will and will not change on the site. its tests sit beside it too.
scripts/post-plan.grid.test.mjs   every combination that decision can be handed, about 94,000,
                       checked against what must always be true. where the decision asks, each
                       answer it offers is read off the sentence and typed back.
scripts/sim/           a whole site in a temp folder: the real /api/posts, sign in and desk code,
                       run in memory with a JSON file for a database and no network
scripts/post-flow.test.mjs   the command run for real against that, one test for each way it once went wrong
scripts/desk.test.mjs  the desk with no browser: savePost, deletePost, the desk's reads, the proxy, the pages
scripts/desk-editor.test.mjs   the real Editor.tsx in headless Chromium with no server. npm run desk.
scripts/sim/editor/    the editor made into one browser script, and drawn the way the server draws it
scripts/check-facts.mjs   asks GitHub whether every pull request still matches content/data.ts
db/schema.sql          runs on Neon or Supabase unchanged. both are Postgres.
proxy.ts               Next 16's renamed middleware. matches /admin only.
```

## Deployment state, as of 2026-10-05

- **Vercel**, project `portfolio` under team `lack-toes`, production domain `itssaharsh.vercel.app`.
  The auto generated `portfolio-lack-toes.vercel.app` is still behind Vercel Authentication.
- **Neon** Postgres holds the posts. Free tier, sleeps after five minutes, so the first request
  after a quiet spell pays a cold start.
- **Vercel Blob** holds uploaded images.
- Production variables set: `DATABASE_URL`, `BLOG_STORE=neon`, `ADMIN_PASSWORD`, `SESSION_SECRET`,
  `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SITE_URL`. Leftover `NEXT_PUBLIC_SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are unused while `BLOG_STORE=neon` and can be deleted.
- One post is published.
- `./post` needs no new variable. It uses `ADMIN_PASSWORD`, the one that opens the desk. It
  talks to `/api/posts`, so it only works against a deployment that has that route, and it says
  so plainly when the route is not there.
- `NEXT_PUBLIC_SITE_URL` is set in production but EMPTY. `lib/site.ts` falls back to `SITE_URL`
  in `content/data.ts`, so it is harmless now. Delete it or set it to the real address.
- **Outstanding:** the Neon password was pasted into a chat and still needs rotating.

## Things that have already gone wrong. Do not repeat them.

**jsdom killed the blog in production.** `isomorphic-dompurify` pulls in 11MB of jsdom, which
works locally and 500s in the serverless function. Every blog route died while `/api/health`
stayed up, because only the blog imports `lib/posts`. Sanitising now uses `sanitize-html`, which
parses with htmlparser2 and needs no DOM. **Do not reintroduce anything requiring a DOM on the
server.**

**The schema would not apply at all.** `to_tsvector('english', x)` can resolve to the single
argument overload, which is `STABLE`, and a generated column refuses it, so the config is cast
to `::regconfig`. `array_to_string` is `STABLE` too, so the tags part needs the `tags_to_text`
immutable wrapper. Both are in `db/schema.sql`. Without them the search column cannot be created.

**Vercel does not apply environment variables to deployments that already exist.** Adding one
and not redeploying looks exactly like a broken app. Always redeploy after changing any variable.

**The Supabase auth example redirects the whole site to a login page.** `proxy.ts` matches
`/admin` only, and the redirect is gated on that prefix again. Never widen the matcher.

**The proxy lets every POST under `/admin` through, on purpose.** A Server Action is a POST to
the page it lives on. Turned away with a redirect, a save pressed after the sign in had run out
never reached `savePost`, Next's own script could not read the answer, and the editor was
replaced by an error page with the text behind it. So the proxy only sends page loads to the
sign in. Every action that reads or changes a post calls `requireDesk()` itself, and every page
of the desk calls `signedIn()` itself and draws the sign in there, with no redirect. Keep both.
Do not make a desk page redirect to the sign in: after a form posted with JavaScript off, the
browser posts the form again to the sign in page, and that answers "Internal Server Error".

**Read paths must never throw.** A blog that answers 500 because a database was asleep is worse
than one showing nothing. `lib/posts.ts` catches, logs and falls back to empty. A failed save
is never silent: the store throws, and `savePost` and `/api/posts` hand the reason back as a
sentence.

**Vercel Functions cap request bodies at 4.5MB**, so `/api/upload` refuses at 4MB with a clear
message rather than letting the platform return something opaque.

**Anything written outside a CSS layer beats every Tailwind utility.** `h1, h2, h3 { margin: 0 }`
and `a { color: inherit }` sat unlayered in `globals.css`, so every margin, tracking and colour
class on a heading or a link was silently thrown away. The resume download button was dark text
on a dark button in production for five weeks. Element defaults live in `@layer base` now. Keep
them there, and look at the page rather than the class list.

**An empty environment variable is not a missing one.** `process.env.X ?? fallback` lets an
empty string straight through. `NEXT_PUBLIC_SITE_URL` is empty in production, so the sitemap
went out with relative addresses for five weeks, and a `new URL()` around it would have failed
the build on Vercel while passing locally. Go through `lib/site.ts`.

**npm keeps flags that come before a double dash.** `npm run post notes.txt --draft` hands the
script only the file name, which would publish a draft. `scripts/post-plan.mjs` reads the trace
npm leaves in the environment. Worse, npm stretches a flag into any of its own settings that
starts the same way: `--replace` became `replace-registry-host` and swallowed the `--dry-run`
typed after it, and `--local` vanished without a trace. That is why the flags are `--overwrite`
and `--localhost`, and why there is no `--update`, which npm would stretch into
`update-notifier`. Before adding a flag, run `npm run env --newflag` and look for
`npm_config_newflag=true` in what it prints. Checked on npm 10.9, 11.21 and 12.2. On 10 a
misspelt flag is lost without a trace, and on 11 with a warning. npm 12 refuses to run at all
when it meets a flag it does not know, and still hands on `--dry-run`, which it does know.
`npm run post --help` shows npm's own help on all three. `./post` avoids all of it and is the
form the docs teach.

**A flag that lost its value must not eat the next flag.** `./post notes.txt --tags --dry-run`
once meant a post tagged `--dry-run`, published for real. A value that starts with two dashes is
refused unless it is written `--tags=...`, and a switch given a value, as in `--draft=false`, is
refused too. Every one of these is a test in `scripts/post-plan.test.mjs`.

**The post command must look before it writes, and must ask instead of guessing.** The address
made from a title is not an identity: two titles can make the same one, and a fixed typo makes a
new one. A file name is not an identity either: `notes.txt` gets reused. A title is not one:
two weeks of "Weeknotes" share it, and a sign off. Five rounds of review each found a new way
for a guess to go wrong. Guess "same" too easily and a short post that quotes an old one
replaces it. Guess "different" too easily and a corrected title publishes a second copy beside
the draft it was meant to fix.

So the command acts only on what is plain, and `relate()` in `scripts/post-plan.mjs` says what
that is. Under the same title, most of the old text still being there is the same post. Under a
new title, nearly all of each text has to be in the other, which is what a fixed title and a few
fixed typos look like. Next to nothing in common is a different post. Everything between is
asked about, whoever sends it and from whatever file, and the person answers with `--same-post`,
`--separate` or `--overwrite`. It compares runs of three words, not whole paragraphs, so a typo
fixed in every paragraph is still the same post, and line endings and dashes do not count.
`/api/posts` asks the related question, `secondCopy()`, before it lets a new post in. Both
need about thirty words in common to be sure. So a very short post sent again from another
file with a word changed is not caught, and a very short post is asked about after any change
at all, even one fixed typo. No lower floor tells that typo from two short weeknotes that
share a sign off, so leave it where it is.

Only `--draft` and `--publish` change whether a post that is already there is out. Never a
`draft:` line left in the file. There are two exceptions. `--overwrite` is a new post taking an
address and inherits nothing, not even whether the old one was out. And the undo of an
overwrite goes back as a draft unless it was live then and the address is live now.

A kept copy says why it was kept, `kept: update` or `kept: overwrite`, and the two are put back
differently. Putting either back makes nothing live by itself. A copy kept before an update is
an older version of one post: it is never written onto a live page from a draft without
`--publish` or `--draft`, and never written over another post altogether without `--overwrite`.
A copy kept before an overwrite is the undo of it. It takes the place of whatever is at its
address now without asking, because what is there is expected to be another post, and what it
replaces is kept first. The one time it does not replace is when what is there is plainly its
own post, and then it goes back like any older version.

The whole decision is `plan()` in `scripts/post-plan.mjs`, which touches no file and no network
so it can be tested: by hand written cases, by `scripts/post-plan.grid.test.mjs`, which tries
every combination against rules it knows the truth of by construction, and by `npm run fuzz`,
which keeps its own account of which piece of writing each post holds. Do not simplify any of
that back into a blind upsert, and do not add a guess where it asks. If a new rule is needed,
write it into the grid first and watch it fail.

**A test that borrows its truth from the code it tests is not a test.** The first random tester
decided whether two posts were copies by calling the same function the site uses to decide
that. It stayed green with that function switched off. The grid and the fuzz now know the
answer from how they built the texts. Before trusting a new check, break the code on purpose
and see whether it notices.

**A `draft: yes` line the reader never reached went out as the opening of the post.** The
settings were read from the top until the first line that was not one, and nothing looked past
it. A blank line between two setting lines, a summary an editor had wrapped, `--title` over a
file with an underlined title, or an indent in front of the line each published a draft with
`draft: yes` in its opening. The reader stops now, and shows the line. It looks in the block it
stopped in, the block after it, and each block after that for as long as the one above holds a
line shaped like a setting. It looks a second time without the indents that do not make a line
code: in a file typed like a letter, on the first line of a paragraph set like a book, under a
line of text, and straight under the title, where a tab is as likely a slip as a sample. Keep
it stopping. Do not teach it to read the stray line, because a wrapped value cannot be read
back safely, and do not let an indent decide what was meant.

**Answers the command printed were refused when typed.** `--separate` was offered where a post
already sat at the title's address, the way back printed after `--publish` did nothing, and a
dry run promised a new post under `--same-post`. Every flag and address a question offers has
to work when typed as printed. The grid reads each offer off the sentence and types it, so a
sentence that offers what `plan()` would refuse fails there. `plan()` cannot see the site's two
refusals, so those are flow tests, and the fuzz types the answers too. An offer of a title or
an address is always worded "give it its own", because that is how the tests tell one from a
flag.

**An address pasted from a browser published a post at an address nobody typed.**
`--slug .../blog/notes-on-the-cache#the-fix` made a new post at `notes-on-the-cache-the-fix`. A
pasted address is cut at the first `?` or `#`, and a `%20` in it is read back as the space it
stands for. An address the command prints for the writer to type is printed bare only when a
shell leaves it alone.

**The way back cannot take a date off, and says so.** A draft that has never been out has no
date. `--publish` gives it one, the site keeps a date once a post has one, and the kept copy
has no date to give. So the printed way back makes it a draft again with the day of the slip
still on it, and the command says so under "To put it back". Taking the date off for real
would mean `/api/posts` accepting an empty date.

**The writing desk lost what was typed when a save failed.** `savePost` threw, Next replaced
the editor with an error page, and the text went with it. A database that was asleep was
enough. It returns a sentence now, the editor shows it with every box still filled and the tick
where it was left, and every change is also kept in the browser, at
`desk:unsaved:<the post's id, or new>`, and written there again at the press of save. A save
that goes through removes that text only if it is exactly what the save carried. A text found
there on arrival is an offer, and offers have a list of their own, `desk:offered:<id or new>`.
Only the writer's own buttons take one off that list, with three exceptions that lose nothing:
a save of that very text going through, a text that says exactly what the post says, and a
page's own earlier text when that page writes a newer one. Keep it that way: a save must never
throw for something the writer can put right or try again.

**The desk wrote an old picture of a post over a newer one.** A tab opened before
`./post --publish` took the post down, wiped the day it went out and put the old text back. The
form now carries the post's `updated_at` as the page was drawn, and `savePost` refuses a page
that is older than the post. The two are compared as text in `savePost`, never in the query:
the column keeps microseconds and the text a page is given keeps milliseconds, so a query would
match almost never while every test stayed green. The day a post first went out comes from the
stored post, never from the form. `deletePost` checks the same stamp.

**The Published tick moved by itself, twice.** React puts a form back to its defaults when its
action answers, and a tick keeps the default it was drawn with, so after a refused save the
tick went back to what the site held and the next save sent that. The editor keeps the default
in step with the tick. Then the Back button: Chromium fetches the editor again and sets the
tick to what the old page had, and the editor took that for the writer's. The tick carries
`autoComplete="off"`. "put it back" never takes the tick from a kept text. Only the writer's
own tick, in this sitting, changes whether a post is out.

**Text typed while a save was on its way was neither saved nor kept.** The boxes are read only
and the tick is held until the save answers, an image dropped then is turned away with a line,
and save waits while an image uploads. Do not make the editor stay and save again: a new post
has no id until the page is drawn again, so a second save would be a second post.

**One letter typed in one tab threw away a paragraph typed in another.** Two tabs on one post
share one kept place, and the editor wrote there without looking. Every write looks first now.
A text another page wrote there goes on the list of offers before anything goes over it, and
each kept text carries `by`, a mark of the page that wrote it, so a page is never offered its
own boxes. An offer that was put back leaves the list only once the boxes that took it are
written down, or a browser that is full loses it.

**The desk said "Nothing here yet." when the database had not answered.** The desk reads
through `listForDesk` and `getForDesk` in `lib/posts.ts`, which hand back their own error.
`lastReadError` is one variable for the whole server and is not for the desk. The edit page
never draws a form for a post it could not read: empty boxes over a post's id are one press
away from an empty post. And delete is no longer one click beside edit. It is a link to
`/admin/delete/<id>`, which names the post and holds the real button.

**The editor was never run until a reviewer ran it.** Every test called `savePost` directly, so
nothing that happens in a browser was seen: the tick, the kept text, two tabs, the Back button.
`npm run desk` runs the real `Editor.tsx` in headless Chromium. Three things it had to learn. A
page has to be woken the way `next dev` wakes it, with every effect run twice, or two guards on
one fault hide each other. A stand in for a full browser has to refuse what a real one refuses:
the first one refused even a shorter write, which a real browser takes, and a text lost in a
real full browser went unseen. And a form that shows an answer needs a test that draws it
holding one.

**Saving at the desk moved a live post.** It tidied the address on every save, and an address
cut at 80 characters lost its last dash the second time, so the link that was live a moment
before found nothing. An address that is already stored is now kept exactly as it is, and
making an address from an address changes nothing.

**The writing desk stored CR LF line endings.** A browser sends a text box that way. A post
saved once at the desk then never compared equal to the file it came from: the command called
the text changed when it was not, and a retitled copy got past the check for a second copy.
`savePost` and `/api/posts` both store plain line endings now, and every comparison ignores
them, for the rows that already have the other kind.

**The brake on wrong passwords was one count for everybody.** Twenty requests from anyone, with
no password in them, locked the owner out of `./post` for a minute. It is counted per caller
now, in `lib/auth.ts`, and a request with no password in it is turned away without being
counted, because a page on another site can make the owner's own browser send those. It is
still per server instance and per door, so it is a brake and not a wall.

**The sim spelt its temp folder through a link, and the random tester called a true sentence
false.** The command reads its own place as a real path and the tester looked the file up under
the linked spelling. The system temp folder on a Mac is a link too. `scripts/sim/site.mjs`
takes the real path of every folder it makes.

**Two runs of the same breaks at once passed for a table of catches.** Each deleted the other's
temp folders, every flow test failed, and every break looked caught. A break that fails thirty
tests has not been caught. Read which tests failed, not how many, and never stop a run with
`pkill -f` on a script name that another run may share.

**`.env.local` points at the production database.** There is only one Neon database, so anything
that writes while running on localhost writes to the live blog. `./post` has `--dry-run`
to look and `--draft` to save where only the desk can see it.

**A test of the post command published a post on the live blog.** On 2026-10-05 two test runs
failed because the database could not be reached from this machine, and the next run in the same
script carried no `--draft`. It created the post it expected to update, published, and that post
sat on the live `/blog` for two minutes. A new post goes out unless told otherwise, which is what
the command is for.

So the command is tested without the database now. `scripts/sim/` runs the real route, the real
sign in and the real `savePost` in memory, and `npm test` drives the real command against them.
`npm run fuzz` throws random sequences at the same thing and checks after every step that
nothing went out, came down, was turned into another post or went up twice that no flag asked
for. Change the command or the route, then run both. Go near the real database only to check the stack itself,
and then: every run that could create a post carries `--draft`, nothing later in a script
assumes an earlier step worked, the live posts are counted after every step, and test titles
start with `zz e2e` so they can be found and removed.

**Rebuilding while `next start` is still running corrupts the build.** The old server writes
pages from the old build into the new output and the stylesheet link starts returning 404, which
looks exactly like the CSS being broken. Stop the server, then build.

**Sleeping bodies ignore a gravity change** in matter-js, so every block is woken and nudged when
a direction is pressed. And upward gravity needs a ceiling, which is switched off for the first
2.6 seconds so the opening rain can still fall in.

**The pile is not interactive on touch.** A canvas answering drags in the bottom band steals the
thumb scroll zone.

## Commands

```bash
npm run dev          # localhost:3000. runs with no configuration at all.
npm run build        # then npm start for the real thing
npm run typecheck
npm test             # the text rules, the command's decisions, the command against the real route in memory, and the desk's actions, reads, proxy and pages
npm run desk         # the real editor in headless Chromium, no server. needs a Playwright it can find, and skips with a sentence when there is none.
npm run fuzz         # random sequences of the command against the same in memory site. 200 steps, about a minute and a half.
npm run facts        # asks GitHub whether every pull request still matches content/data.ts
./post a.txt         # publish a text file as a post. --dry-run looks, --draft hides, --help lists the rest
npm run resume       # resume.tex -> public/resume.pdf. rebuild after editing the tex.
```

`SETUP.md` has the full deployment walkthrough. `/api/health` on the live site tells you whether
the database is reachable and why not if it is not.

## Before you say it is done

- Turn JavaScript off. Every section must still render complete, including the decode.
- `prefers-reduced-motion`: the heap must never initialise.
- 375px wide: no horizontal scroll, no scroll jacking.
- Every claim clicked through to its pull request, the merged versus open label matching what
  GitHub actually reports today, and every figure matching the last benchmark in the thread.
- Every project sentence checked against that project's own readme, including what it admits is
  simulated, recorded or untried. The first version of this list claimed more than six of them did.
- `npm run facts` and `npm test` both pass, `npm run fuzz` after any change to the command or the
  route, and `npm run desk` after any change to `app/admin/Editor.tsx` or `app/admin/actions.ts`.
- Proofread twice.
