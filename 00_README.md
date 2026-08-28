# Portfolio rebuild — prompt package

Build kit for rebuilding **itssaharsh/portfolio** as a Next.js and Supabase site on Vercel,
with an in site CMS for writing blog posts with images.

## Files, in order

1. **00_README.md** — this file.
2. **01_MASTER_PROMPT.md** — the main prompt. Read first.
3. **02_DESIGN_SPEC.md** — the chosen direction, palette, type, the signature set piece.
4. **03_TECH_SPEC.md** — stack, versions, schema, auth, the two Supabase traps.
5. **04_CONTENT_TRUTH.md** — **every fact allowed on the site**, plus the voice rules.
6. **05_ACCEPTANCE_CHECKLIST.md** — self test before shipping.

## How the direction was chosen

A 12 agent research and judging workflow (`wf_c798d05a-5b2`, 0 errors, 1.4M tokens) ran six
verified research sweeps, generated three competing design directions, and scored each on
craft, buildability and hiring signal. Every version number, font byte count, contrast ratio
and browser support figure in these files came from that run and was checked against a real
source rather than recalled.

The winning direction is **Wire Format**, with specific grafts from the two runners up that
all three judges independently recommended.

## The rule that overrides everything else

`04_CONTENT_TRUTH.md` is the only source of facts. If something is not in it, it does not go
on the site. Two claims on Saharsh's own resume are wrong and are documented there so they
do not get repeated.
