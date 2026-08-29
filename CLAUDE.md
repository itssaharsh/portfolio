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
"in review" with a link, so the label checks itself.

**2. Voice: plain human language, no jargon, and no dashes in prose.**
No em dash, no en dash, no hyphen as a connector. Rewrite the sentence instead. The exception
is URLs, repository names, package names and benchmark output, which keep their real characters
because changing them breaks links and misnames real projects. No emoji anywhere.

"No jargon" is never resolved by becoming vague. Every concrete number survives; only the
vocabulary changes.

## The design, and the one rule holding it up

Direction is **Mark and Sweep**. The floor of the page is **421 physics blocks**, the exact
allocation count removed in `kubernetes-sigs/resource-state-metrics` 102, down to 2. You can
shove them, throw them, flip gravity, and press `g` to garbage collect. Two blocks never sleep;
nothing on the page says why.

**Spectacle and evidence are architecturally separate, and this must stay true.** Every route
is statically generated with the headline, all prose, every benchmark and all 21 pull request
links in the server HTML at full opacity with no entrance animation. The physics is imported
inside a `useEffect` so matter-js lands in its own chunk after first paint. With JavaScript off
the page keeps 1,188 readable words and every link. If you break that, the site stops being
defensible for a performance engineer.

Palette and type are in `app/globals.css`. Warm concrete `#ABA89A`, never near black, never the
cream cluster. Go Mono is the voice, subset by hand to 10,756 bytes in `public/fonts` because it
is not on Google Fonts. Archivo carries prose. **No gradients, no glass, no shadows, no rounded
cards.** Ultramarine `#2A2BD6` is 3.64:1 on concrete, so it is for large text and non text only;
small text on concrete uses `--color-ultra-deep`.

## Layout

```
content/data.ts        every fact. start here.
app/page.tsx           the homepage, all sections
components/Heap.tsx    the physics. client only, loads after paint
lib/store/types.ts     the PostStore interface the blog talks to
lib/store/{neon,supabase}.ts   the two adapters
lib/store/index.ts     picks one from BLOG_STORE
lib/auth.ts            sign in. one password, a jose signed cookie. NOT part of the store.
lib/posts.ts           markdown rendering and the safe read wrappers
app/admin/*            the writing desk
app/api/health         says whether the database is reachable, without leaking the credential
db/schema.sql          runs on Neon or Supabase unchanged. both are Postgres.
proxy.ts               Next 16's renamed middleware. matches /admin only.
```

## Deployment state, as of 2026-08-29

- **Vercel**, project `portfolio` under team `lack-toes`, production domain `itssaharsh.vercel.app`.
  The auto generated `portfolio-lack-toes.vercel.app` is still behind Vercel Authentication.
- **Neon** Postgres holds the posts. Free tier, sleeps after five minutes, so the first request
  after a quiet spell pays a cold start.
- **Vercel Blob** holds uploaded images.
- Production variables set: `DATABASE_URL`, `BLOG_STORE=neon`, `ADMIN_PASSWORD`, `SESSION_SECRET`,
  `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SITE_URL`. Leftover `NEXT_PUBLIC_SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are unused while `BLOG_STORE=neon` and can be deleted.
- One post is published.
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

**Server Actions are POSTs to the page they live on, so the proxy does not cover them.** Every
action calls `requireDesk()` itself. Keep that property.

**Read paths must never throw.** A blog that answers 500 because a database was asleep is worse
than one showing nothing. `lib/posts.ts` catches, logs and falls back to empty. Writes still
throw, because a silent failed save is worse than an error.

**Vercel Functions cap request bodies at 4.5MB**, so `/api/upload` refuses at 4MB with a clear
message rather than letting the platform return something opaque.

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
npm run resume       # resume.tex -> public/resume.pdf. rebuild after editing the tex.
```

`SETUP.md` has the full deployment walkthrough. `/api/health` on the live site tells you whether
the database is reachable and why not if it is not.

## Before you say it is done

- Turn JavaScript off. Every section must still render complete, including the decode.
- `prefers-reduced-motion`: the heap must never initialise.
- 375px wide: no horizontal scroll, no scroll jacking.
- Every claim clicked through to its pull request, and the merged versus in review label matching
  what GitHub actually reports today.
- Proofread twice.
