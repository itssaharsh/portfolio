# 04 — CONTENT SOURCE OF TRUTH

**This file is the only source any copy on the site may draw from.**
If a fact is not in this file, it does not go on the site. No exceptions, no filling gaps
from memory, no rounding numbers up, no describing open work as finished.

Every entry below was verified on **2026-08-28** against the live GitHub API (`gh`), the
resume LaTeX source, and HTTP status checks. Re-verify before launch if significant time
has passed, because pull request states change.

---

## Voice rules

These apply to every word that ships: headings, body, buttons, alt text, meta
descriptions, error states, the blog, and the admin UI.

1. **Plain human language. No jargon.** Write it the way you would say it out loud to a
   friend who does not work in software.
2. **No dashes in prose.** No em dash, no en dash, no hyphen used as a connector. Rewrite
   the sentence rather than reflexively swapping in a comma.
   - Display names lose their dashes: **Chain Lens**, **Coin Smith**, **Sherlock**.
   - **Exception: URLs, repository names, package names and the traceparent string keep
     their real characters.** `github.com/itssaharsh/Chain-lens` stays exactly as written,
     because changing it breaks the link. The 55 character header is data, not prose.
3. **Jargon goes, numbers stay.** Never resolve rule 1 by becoming vague. Every concrete
   figure survives; only the vocabulary changes.
4. No "leveraging", no "passionate about", no "I craft experiences", no "cutting edge".
5. **No emoji anywhere on the site.** The old site used them as icons and it was the
   loudest amateur signal on the page.

### Worked example

> **Too jargon heavy:** "Replaced the two pass traceparent decode with a generated reverse
> hex table, cutting Extract by 9 to 11 percent."
>
> **Too vague:** "Made some performance improvements to a tracing library."
>
> **Right:** "Every request carries a small label so you can follow it across services.
> The code used to read that label twice, once to check it looked right and once to
> actually use it. I made it do both in a single pass by looking each character up in a
> table. That took about a tenth off the time."

---

## Identity

| Field | Value |
|---|---|
| Name | Saharsh Tibrewala |
| Study | B.Tech Computer Science (AI), VIT Pune |
| Year | Second year, 2025 to present |
| GPA | 8.9 out of 10 |
| School | AECS 3, Tarapur. CBSE Class XII, 87 percent, 2025 |
| Email | saharsh7002@gmail.com |
| Phone | +91 95612 79506 |
| Discord | saharsh12 |
| Location | Pune, India |

Source: `/home/saharsh/contri/Claude/auto/Resume.tex`, last edited 2026-08-23.

## Links

All six verified. LeetCode, Codeforces and LinkedIn return 403 or 999 to `curl`, which is
bot protection rather than a dead link. CodeChef returned 200.

| Platform | URL |
|---|---|
| GitHub | https://github.com/itssaharsh |
| LinkedIn | https://www.linkedin.com/in/saharsh-tibrewala/ |
| X | https://x.com/Saharshbugging |
| LeetCode | https://leetcode.com/u/itssaharsh |
| CodeChef | https://www.codechef.com/users/itssaharsh |
| Codeforces | https://codeforces.com/profile/itssah |

---

## Open source: MERGED (11)

Label these **merged**. Each links to its pull request.

| Repo | PR | What it did | Date |
|---|---|---|---|
| open-telemetry/opentelemetry-go | 7751 | Test cases for `TestEmit` in `attribute` | 2026-01-04 |
| open-telemetry/opentelemetry-go | 7764 | Tests for merge idempotency and equivalent stability | 2026-01-08 |
| open-telemetry/opentelemetry-go | 7789 | Moved semconv v1.37.0 to v1.39.0 across 72 files | 2026-01-15 |
| open-telemetry/opentelemetry-go | 7824 | Skip the work when nobody is listening, OTLP gRPC | 2026-01-21 |
| open-telemetry/opentelemetry-go | 7825 | Same, trace gRPC | 2026-01-22 |
| open-telemetry/opentelemetry-go | 7866 | Same, Prometheus | 2026-02-03 |
| open-telemetry/opentelemetry-go | 7881 | Same, OTLP trace over HTTP | 2026-02-07 |
| open-telemetry/opentelemetry-go | 8015 | Generate histogram boundaries from `weaver.yaml` | 2026-03-06 |
| open-telemetry/opentelemetry-collector-contrib | 46467 | Builder config fix | 2026-02-26 |
| open-telemetry/opentelemetry-specification | 5112 | Overview docs update | 2026-05-21 |
| pandas-dev/pandas | 62573 | Clarify that `check_array_indexer` accepts int and slice | 2025-10-04 |

URL shape: `https://github.com/<repo>/pull/<number>`

## Open source: OPEN, IN REVIEW (10)

Label these **in review**. **Never label them merged.** This is the strongest material on
the site precisely because CNCF maintainers are actively reviewing it, and mislabelling is
the only way to lose that.

| Repo | PR | What it does | Diff |
|---|---|---|---|
| open-telemetry/opentelemetry-go | 8739 | Decode the tracing label in one pass using a lookup table | +45 −15, 3 files, 6 review comments |
| open-telemetry/opentelemetry-go | 8740 | Unroll the hex decoders so the compiler drops all 12 bounds checks | +70 −12, 2 files |
| kubernetes-sigs/resource-state-metrics | 102 | Remove a scan that got slower as the square of the input | +66 −26, 3 files |
| kubernetes-sigs/resource-state-metrics | 101 | Compile the scripts once per resolver instead of once per object | — |
| open-telemetry/opentelemetry-go-compile-instrumentation | 1137 | Cut per request allocations in the HTTP hooks | +146 −109, 6 files |
| open-telemetry/opentelemetry-go-compile-instrumentation | 1136 | Skip rewriting files and retidying when nothing changed | — |
| SeedSigner/seedsigner | 916 | Custom derivation paths | — |
| SeedSigner/seedsigner | 927 | Taproot multisig address verification | — |
| SeedSigner/seedsigner | 929, 930 | CI checks | — |

## Two resume claims that are WRONG and must not be repeated

1. **opentelemetry-collector-contrib 46819** is listed on the resume under "merged
   earlier". The API reports it **closed, not merged**. Do not put it in the merged list.
   Either omit it or label it closed.
2. **SeedSigner 916 and 927** are written on the resume as delivered. Both are **still
   open**. Label them in review.

---

## The measured numbers

Every one of these is a claim made in a pull request. The site presents each with what was
wrong, what changed, the figure, and the link. **Never state a bare percentage.**

| Claim | Figure | PR |
|---|---|---|
| Reading the tracing label in one pass instead of two | about 9 to 11 percent faster | otel-go 8739 |
| Unrolled hex decoding, 12 bounds checks gone | 33 percent and 28 percent faster, zero allocations | otel-go 8740 |
| Removed the scan that grew as the square of the input | allocations went from 421 to 2 | rsm 102 |
| Compile scripts once per resolver | a further 67 percent | rsm 101 |
| Typed struct instead of a map in the HTTP hooks | 19 percent less time, 27 allocations down to 21 per request | otelc 1137 |
| Skip needless rebuild work | about 16 seconds off a steady state build | otelc 1136 |

**Context worth stating explicitly:** OpenTelemetry reached CNCF Graduated status on
**2026-05-11**. Many reviewers will not know this. Say it.

---

## Projects: public, all verified reachable

| Display name | Repo | Built with |
|---|---|---|
| Sherlock | https://github.com/itssaharsh/sherlock | Go |
| Coin Smith | https://github.com/itssaharsh/coin-smith | Go |
| Chain Lens | https://github.com/itssaharsh/Chain-lens | Go |
| YouTube Shorts Pipeline | https://github.com/itssaharsh/ed | Python |

The three Bitcoin tools came out of Summer of Bitcoin 2025 developer challenges.

**Sherlock.** Reads raw Bitcoin block files and works out which addresses probably belong
to the same person, using patterns like which inputs got spent together. Produces a report.

**Coin Smith.** Builds Bitcoin transactions that follow the shared standard, picks which
coins to spend, works out the fee, and handles change without leaving unspendable dust.

**Chain Lens.** Reads a raw block and reports what is inside it: every transaction, what it
cost, how big it was, and what kind of spending rule it used.

**YouTube Shorts Pipeline.** Writes the script, finds the footage, and publishes the video,
on a schedule, without anyone touching it.

## Projects: PRIVATE, do not link

Both return 404 publicly. Badge them **private, available on request**. No href.

**Hydra Recall.** Memory for an AI assistant that understands time. Facts are stored with
the window they were true for, so when something changes the old version is kept rather
than overwritten, and you can ask what was true on a given date. If it does not know, it
says so rather than guessing. Tested against a standard benchmark and compared with the
usual approach. Written in Go.

**autoapply.** Finds job openings, tailors the application, and applies. Survives being
killed partway through without losing work or applying twice. Runs on your own machine by
default so nothing personal leaves it. Around 350 tests. MIT licensed.

**countersign** was created 2026-08-28 and its README says under construction. Too early to
feature. Optional "currently building" slot only.

---

## Competitive programming

Static figures from the resume. **No live API, no widget.** Stamp them "as of August 2026"
and link each to the live profile.

| Platform | Figure |
|---|---|
| LeetCode | more than 350 problems solved |
| CodeChef | 3 stars, highest rating 1741 |
| Codeforces | Pupil, highest rating 1295 |

## Achievements

- Linux Foundation LiFT Scholarship 2026
- Summer of Bitcoin 2025, cleared four rounds through to the proposal round
- LFX Mentee Finalist, Linux Foundation, picked for a maintainer interview
- Google Big Code 26, top 15,000 in the country

## Certifications

- Oracle Cloud Infrastructure Foundations Associate, 2025
- Oracle Cloud Infrastructure Generative AI Professional, 2025
- Anthropic AI Fluency, Framework and Foundations, and Claude 101
- AWS AI Practitioner Challenge, Udacity, 2026
- Infosys Springboard: Introduction to AI, Deep Learning, and Natural Language Processing, 2026

---

## Resume

Built from `Resume.tex` with `pdflatex` (installed at `/usr/bin/pdflatex`) to
`public/resume.pdf` and served from the site. This replaces the old Google Drive view link,
which is a dead end for a recruiter who just wants the file.
