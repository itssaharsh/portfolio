# 03 — TECH SPEC

Every version below was checked against the npm registry on 2026-08-28. Do not substitute
from memory.

## Stack

```
next 16.3.3 · react 19.2.8 · tailwindcss 4.3.3 · typescript 5
gsap 3.15.0 + @gsap/react 2.1.2
lenis 1.3.26 · next-themes 0.4.6 · shiki 4.4.3 · @number-flow/react 0.6.2
@supabase/supabase-js 2.112.4 · @supabase/ssr 0.12.5
```

GSAP became fully free including every former paid plugin in April 2025 after the Webflow
acquisition. SplitText and ScrollTrigger cost nothing now, commercial use included.

**`@supabase/auth-helpers-nextjs` is deprecated.** `npm view` returns a deprecation notice
pointing at `@supabase/ssr`. Most tutorials online are stale on this. Use `@supabase/ssr`.

## Routes

```
/                    the portfolio
/blog                index, recency sorted, search
/blog/[slug]         a post
/admin               login gated dashboard
/admin/new           editor
/admin/edit/[id]     editor
/resume              inline PDF, download, print stylesheet
/api/og/[...]        generated preview images
```

## Storage is swappable

The blog talks to `PostStore` in `lib/store/types.ts` and never to a vendor. `BLOG_STORE` picks the
adapter. Nothing else in the app knows which is in use.

| Value | Posts | Images | Notes |
|---|---|---|---|
| `neon` (default) | Neon Postgres | Vercel Blob | free, permanent, no card. Sleeps after five minutes of no traffic |
| `supabase` | Supabase Postgres | Supabase Storage | switch to this when the account frees up |

Both are Postgres, so `db/schema.sql` and the weighted tsvector search are identical on either.

Sign in is deliberately **not** part of the store. It is one password in an environment variable,
checked in a Server Action, issued as an HS256 signed httpOnly cookie by `jose@6.2.10`. That is what
the Next.js authentication guide recommends for this, and Server Actions compare Origin against Host
so cross site request forgery is covered. Route Handlers get none of that, which settles the choice.

Because sign in does not change when the store does, swapping backends touches one variable.

## Blog data model

Supabase provisions **Postgres 17**. This matters: `VIRTUAL` generated columns are Postgres
18 and later, so the search column **must** be `STORED`.

```sql
create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body_json    jsonb,          -- editor document, source of truth for editing
  body_html    text,           -- rendered, what the public page serves
  body_text    text,           -- plain text, what search indexes
  cover_url    text,
  tags         text[] default '{}',
  published    boolean not null default false,
  reading_time int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

alter table public.posts add column fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'D')
  ) stored;

create index posts_fts_idx  on public.posts using gin (fts);
create index posts_tags_idx on public.posts using gin (tags);
create index posts_pub_idx  on public.posts (published, published_at desc);
```

Search runs through `textSearch('fts', query, { type: 'websearch' })`.

Known limitation to state honestly in the UI: this stems words but does not match partial
words. Searching "observ" will not find "observability". If substring matching turns out to
matter, add a trigram index rather than pretending it already works.

## Row level security

Anonymous visitors read published posts only. One email address writes.

```sql
alter table public.posts enable row level security;

create policy "public reads published"
  on public.posts for select
  using (published = true);

create policy "admin does everything"
  on public.posts for all
  using (auth.jwt() ->> 'email' = 'saharsh7002@gmail.com')
  with check (auth.jwt() ->> 'email' = 'saharsh7002@gmail.com');
```

## Auth

Magic link, so there is no password to leak.

**Two adaptations the Supabase docs do not cover. Getting either wrong breaks the site.**

1. The documented `updateSession` helper redirects **every** unauthenticated request to
   `/login`. On a public portfolio that 302s the homepage, the blog, everything, for every
   visitor. Narrow the matcher to `['/admin/:path*', '/auth/:path*']` **and** gate the
   redirect on `pathname.startsWith('/admin')`.
2. **Never call `getSession()` in server code.** It is not guaranteed to revalidate the
   token. Use `getUser()`.

Supabase's built in SMTP is rate limited and meant for testing. Wire custom SMTP, because
this is a login Saharsh depends on.

## Image upload

A Supabase Storage bucket, public read, admin write. Add the storage host to
`remotePatterns` in `next.config.ts` or `next/image` refuses to serve them.

## Rendering

Blog pages use ISR so a newly published post appears immediately. Revalidate the index and
the post path on publish.

## Image generation

The Pollinations MCP is connected (`claude mcp list` shows it healthy). Verified live: a
real 768x384 JPEG, HTTP 200, no account, no key.

Two measured caveats. **About 47 seconds per image**, and the MCP wrapper's last actual code
release was 2025-05-20, so keep a plain `fetch` against the HTTP endpoint as a fallback.
Generate at build time and commit the files. Never generate at request time.

Needed in only two places: blog cover art and social preview images. Nothing load bearing
depends on it, because the design derives its visuals from data rather than imagery.

## Performance budget

State the real numbers in the hero rule, measured at deploy, never asserted.

- No render blocking font requests. `next/font/google` self hosts at build time.
- Animation code budgeted and reported honestly.
- Images: the four existing files are JPEGs misnamed `.png`, all 1024x1024 at 300 DPI,
  2.4MB total, and one of them is referenced nowhere. Convert what is kept, drop the rest.

## Accessibility floor

- Everything readable with JavaScript disabled.
- `prefers-reduced-motion: reduce` removes all scroll driven motion.
- Visible focus rings everywhere, and the status line mirrors keyboard focus as well as the
  pointer.
- Contrast meets WCAG AA in both themes. Verify with real computation, not by eye.
