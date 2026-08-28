# 05 — ACCEPTANCE CHECKLIST

Work through this before calling the build done. Anything unchecked is not done.

## Truth

- [ ] Every claim on the page traces to `04_CONTENT_TRUTH.md`.
- [ ] Every pull request link opens, and the **merged** or **in review** label matches what
      GitHub actually reports today.
- [ ] collector-contrib 46819 is **not** in the merged list.
- [ ] SeedSigner 916 and 927 are labelled in review, not delivered.
- [ ] Hydra Recall and autoapply have no href on them.
- [ ] Contest ratings are stamped with a date and there is no fake live widget.

## Voice

- [ ] No dashes in any prose. URLs, repository names and the traceparent string excepted.
- [ ] No emoji anywhere.
- [ ] No jargon a non specialist would bounce off. Numbers all still present.
- [ ] **Proofread every word twice.** Typos were the strongest negative predictor found in
      the research. This matters more than any animation on the page.

## Build

- [ ] `npm run build` clean.
- [ ] `npx tsc --noEmit` clean.

## The floor

- [ ] **JavaScript disabled: every section renders complete and readable, including the
      decode bench in its finished state.** Most important check here.
- [ ] `prefers-reduced-motion: reduce`: no pinning, no scrubbing, static storyboard.
- [ ] Keyboard only: every section reachable, focus rings visible, status line mirrors focus.
- [ ] 375px wide: no horizontal scroll, no scroll jacking, ruler rewraps to 16 per row.
- [ ] Light, dark and system all hold contrast. No flash of unstyled content.

## Performance

- [ ] Lighthouse performance and accessibility both 95 or better on the deployed URL.
- [ ] Hero numbers visible without scrolling.
- [ ] The performance figures printed in the hero were measured, not asserted.
- [ ] No render blocking font request.

## CMS

- [ ] Log in by magic link.
- [ ] Write a post, drag in an image, publish, confirm it appears immediately.
- [ ] Search a word from the post body and find it.
- [ ] Log out. Confirm an anonymous visitor cannot reach `/admin`.
- [ ] **Confirm the homepage and blog are not redirected to login for anonymous visitors.**
      This is the failure mode the Supabase docs walk you straight into.

## Ship

- [ ] Old GitHub Pages URL serves a redirect, not a broken page.
- [ ] `og:image`, favicon, sitemap and robots all present. The old site had none of them.
