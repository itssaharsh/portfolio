# 01 — MASTER BUILD PROMPT

You are rebuilding **Saharsh Tibrewala's** developer portfolio from scratch. The existing
three file static site is being scrapped entirely.

Read `02_DESIGN_SPEC.md`, `03_TECH_SPEC.md` and `04_CONTENT_TRUTH.md` in full before writing
any code. Self test against `05_ACCEPTANCE_CHECKLIST.md` before calling it done.

## Who this is for

Engineering hiring managers and technical recruiters. The goal is a backend, AI or systems
engineering internship. The largest controlled study available found the median review time
is **31 seconds**, recruiter accuracy at predicting interview success is **55 percent**,
and the strongest single predictor of an offer was **typo count**, not GPA or school.

Design for a distracted skim, then reward the person who stays.

## The one thing that matters most

Saharsh is a second year student with no employment history to borrow credibility from. His
merged pull requests into OpenTelemetry, kubernetes-sigs and pandas **are** his employment
history and must occupy the screen position a senior engineer's job list would.

Metrics on student resumes are presumed inflated by default. The only thing that beats that
prior is **mechanism plus a link**. So the site never states a bare percentage. Every number
arrives as: what was wrong, what changed, the measured figure, and the pull request where a
maintainer reviewed it.

## Hard constraints

1. **Never assert a fact that is not in `04_CONTENT_TRUTH.md`.** No filling gaps from
   memory. No describing open pull requests as merged.
2. **Plain human language. No jargon. No dashes in prose.** Full rules in `04`.
3. **Not a fully black background.** This is an explicit instruction from Saharsh, and it
   also happens to match the research on what reads as machine generated.
4. **No emoji anywhere.**
5. **Everything readable with JavaScript disabled**, including the animated set piece,
   which is authored in its finished state and reset by script on mount.
6. **High visual ambition is fine only if it costs nothing measurable.** A slow janky site
   refutes a performance engineer before the reader reaches section two.

## Build order

**Phase 1. Design preview.** One live page: real fonts, real palette, real hero, and the
decode bench working end to end. Show it to Saharsh. **Build nothing else until he
approves the direction.**

**Phase 2. The site.** Scaffold, tokens, every section, the waterfall navigation, the
status line, the gutter. Build the resume from `Resume.tex` with `pdflatex` into
`public/resume.pdf`.

**Phase 3. Blog and CMS.** Schema, row level security, auth, storage, editor with drag and
drop image upload, search, public blog. Then seed one short post explaining what
OpenTelemetry is, in plain language, saved as a draft for Saharsh to rewrite in his voice.

**Phase 4. Polish and deploy.** Preview images, favicon, sitemap, robots, reduced motion,
keyboard paths, Lighthouse. Commit to `main`, push, connect Vercel. Leave a redirect page on
the GitHub Pages branch, because job applications already sent out link to the old URL.

## What Saharsh does himself

1. Create the Supabase project and copy three values into Vercel.
2. Point Vercel at the repository.
3. Configure custom SMTP in Supabase so the login email is reliable.
4. Read the seeded blog post and rewrite it in his own voice before publishing.
