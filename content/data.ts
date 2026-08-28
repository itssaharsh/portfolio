/**
 * SINGLE SOURCE OF TRUTH.
 *
 * Every fact rendered anywhere on this site comes from this file. Nothing on a page
 * may assert something that is not here. See 04_CONTENT_TRUTH.md for the rules and for
 * the verification log.
 *
 * Verified 2026-08-28 against the live GitHub API, the resume LaTeX source, and HTTP checks.
 * Two claims on the resume are wrong and are deliberately NOT repeated here:
 *   collector-contrib 46819 is closed, not merged.
 *   SeedSigner 916 and 927 are open, not delivered.
 */

export const me = {
  name: "Saharsh Tibrewala",
  place: "Pune, India",
  study: "second year, VIT Pune",
  degree: "B.Tech Computer Science (AI), VIT Pune",
  years: "2025 to present",
  gpa: "8.9 out of 10",
  school: "AECS 3, Tarapur. CBSE Class XII, 87 percent, 2025",
  email: "saharsh7002@gmail.com",
  discord: "saharsh12",
} as const;

export const links = {
  github: "https://github.com/itssaharsh",
  linkedin: "https://www.linkedin.com/in/saharsh-tibrewala/",
  x: "https://x.com/Saharshbugging",
  leetcode: "https://leetcode.com/u/itssaharsh",
  codechef: "https://www.codechef.com/users/itssaharsh",
  codeforces: "https://codeforces.com/profile/itssah",
} as const;

/** OpenTelemetry reached CNCF Graduated status on this date. Many reviewers do not know it. */
export const CNCF_GRADUATED = "11 May 2026";

const REPO: Record<string, string> = {
  otelgo: "open-telemetry/opentelemetry-go",
  contrib: "open-telemetry/opentelemetry-collector-contrib",
  spec: "open-telemetry/opentelemetry-specification",
  pandas: "pandas-dev/pandas",
  rsm: "kubernetes-sigs/resource-state-metrics",
  otelc: "open-telemetry/opentelemetry-go-compile-instrumentation",
  seedsigner: "SeedSigner/seedsigner",
};

export type PR = {
  repo: keyof typeof REPO;
  num: number;
  what: string;
  state: "merged" | "review";
  /** merged: the date it landed. review: the date it was opened, so days can be counted. */
  date: string;
  diff?: string;
};

export const prs: PR[] = [
  // ---- merged, eleven ----
  { repo: "otelgo", num: 7751, state: "merged", date: "2026-01-04", what: "Tests for how attribute values get written out" },
  { repo: "otelgo", num: 7764, state: "merged", date: "2026-01-08", what: "Tests proving that merging resources twice gives the same answer" },
  { repo: "otelgo", num: 7789, state: "merged", date: "2026-01-15", what: "Moved the shared names on a version, across 72 files, without changing behaviour" },
  { repo: "otelgo", num: 7824, state: "merged", date: "2026-01-21", what: "Skip the work when nobody is listening, on one of the senders" },
  { repo: "otelgo", num: 7825, state: "merged", date: "2026-01-22", what: "The same check, on the sender that carries traces" },
  { repo: "otelgo", num: 7866, state: "merged", date: "2026-02-03", what: "The same check again, on the Prometheus side" },
  { repo: "otelgo", num: 7881, state: "merged", date: "2026-02-07", what: "And again, on the one that goes over plain web requests" },
  { repo: "otelgo", num: 8015, state: "merged", date: "2026-03-06", what: "Generate the measurement buckets from the shared definition instead of by hand" },
  { repo: "contrib", num: 46467, state: "merged", date: "2026-02-26", what: "Fixed the build configuration for the collector" },
  { repo: "spec", num: 5112, state: "merged", date: "2026-05-21", what: "Cleaned up the overview documentation" },
  { repo: "pandas", num: 62573, state: "merged", date: "2025-10-04", what: "Made the documentation say what the function actually accepts" },

  // ---- open, ten. the best work. ----
  { repo: "otelgo", num: 8739, state: "review", date: "2026-08-12", diff: "plus 45 minus 15",
    what: "Read the label every request carries in one pass instead of two, by looking each character up in a table" },
  { repo: "otelgo", num: 8740, state: "review", date: "2026-08-12", diff: "plus 70 minus 12",
    what: "Unrolled the decoding so the compiler can drop all twelve of its safety checks" },
  { repo: "rsm", num: 102, state: "review", date: "2026-08-17", diff: "plus 66 minus 26",
    what: "Took out a search that got slower the more it had to look at" },
  { repo: "rsm", num: 101, state: "review", date: "2026-08-17",
    what: "Compile the little scripts once per resolver rather than once for every object" },
  { repo: "otelc", num: 1137, state: "review", date: "2026-08-17", diff: "plus 146 minus 109",
    what: "Cut what gets claimed from memory on every single web request" },
  { repo: "otelc", num: 1136, state: "review", date: "2026-08-17",
    what: "Stop rewriting files and retidying when nothing actually changed" },
  { repo: "seedsigner", num: 916, state: "review", date: "2026-04-13", what: "Support for custom key derivation paths" },
  { repo: "seedsigner", num: 927, state: "review", date: "2026-04-23", what: "Checking multisig addresses of a newer kind" },
  { repo: "seedsigner", num: 929, state: "review", date: "2026-04-25", what: "A check that runs on every change" },
  { repo: "seedsigner", num: 930, state: "review", date: "2026-04-25", what: "Keeping the translation files honest" },
];

export const prUrl = (p: PR) => `https://github.com/${REPO[p.repo]}/pull/${p.num}`;
export const prRepo = (p: PR) => REPO[p.repo];
export const merged = prs.filter((p) => p.state === "merged");
export const inReview = prs.filter((p) => p.state === "review");

/** The four numbers that have to be readable in the first thirty seconds. */
export const proof = [
  { n: "421→2", pr: prs.find((p) => p.repo === "rsm" && p.num === 102)!,
    w: "pieces of memory claimed per run, after taking out a search that got slower the more it had to look at" },
  { n: "33%", pr: prs.find((p) => p.repo === "otelgo" && p.num === 8740)!,
    w: "off decoding an identifier. Twelve safety checks the compiler no longer has to write, and nothing extra claimed" },
  { n: "11%", pr: prs.find((p) => p.repo === "otelgo" && p.num === 8739)!,
    w: "off reading the label every request carries, by looking each character up in a table instead of checking it twice" },
  { n: "19%", pr: prs.find((p) => p.repo === "otelc" && p.num === 1137)!,
    w: "off code that runs on every single web request, by using a fixed shape instead of a flexible one" },
];

/** The floor of the site is this commit. 421 is a real number from a real diff. */
export const HEAP = { before: 421, after: 2 } as const;

export const bench = [
  { name: "how long one run takes", old: "412.7µs", now: "4.31µs", delta: "98.96% less" },
  { name: "pieces of memory claimed", old: "421", now: "2", delta: "99.52% less" },
];

export type Project = {
  name: string; blurb: string; stack: string; url?: string; private?: true; note?: string;
};

export const projects: Project[] = [
  { name: "Sherlock", stack: "Go",
    url: "https://github.com/itssaharsh/sherlock",
    blurb: "Reads raw Bitcoin block files and works out which addresses probably belong to the same person, from patterns like which coins got spent together. Writes up what it found." },
  { name: "Coin Smith", stack: "Go",
    url: "https://github.com/itssaharsh/coin-smith",
    blurb: "Builds Bitcoin payments that follow the shared standard. Picks which coins to spend, works out the fee, and handles change without leaving amounts too small to ever move again." },
  { name: "Chain Lens", stack: "Go",
    url: "https://github.com/itssaharsh/Chain-lens",
    blurb: "Opens a single block and reports everything inside it: every payment, what it cost, how big it was, and which kind of spending rule it used." },
  { name: "YouTube Shorts Pipeline", stack: "Python",
    url: "https://github.com/itssaharsh/ed",
    blurb: "Writes the script, finds the footage, and publishes the video, on a schedule, without anyone touching it." },
  { name: "Hydra Recall", stack: "Go", private: true,
    note: "private, happy to walk you through it",
    blurb: "Memory for an assistant that understands time. Facts are stored with the window they were true for, so when something changes the old version is kept rather than painted over, and you can ask what was true on a given date. When it does not know, it says so instead of guessing." },
  { name: "autoapply", stack: "Python", private: true,
    note: "private, happy to walk you through it",
    blurb: "Finds job openings, tailors the application, and applies. Survives being killed halfway through without losing work or applying to the same place twice. Runs on your own machine by default, so nothing personal leaves it. Around 350 tests." },
];

/** Static, dated, each linking to the live profile. No API, nothing to break. */
export const ratings = [
  { v: "1741", k: "CodeChef peak", sub: "3 stars", href: links.codechef,
    admission: "1741 was the peak. It is lower now." },
  { v: "1295", k: "Codeforces peak", sub: "Pupil", href: links.codeforces,
    admission: "Pupil. I stopped practising for a semester." },
  { v: "350+", k: "LeetCode solved", sub: "problems", href: links.leetcode,
    admission: "350 is solved, not mastered." },
];
export const RATINGS_AS_OF = "August 2026";

export const achievements = [
  { what: "Linux Foundation LiFT Scholarship", when: "2026", note: "A course and exam scholarship from the Linux Foundation" },
  { what: "Summer of Bitcoin", when: "2025", note: "Cleared four rounds through to the proposal round" },
  { what: "LFX Mentee Finalist", when: "Linux Foundation", note: "Picked for a technical interview with the maintainers" },
  { what: "Google Big Code", when: "2026", note: "Top fifteen thousand in the country" },
];

export const certifications = [
  { what: "Oracle Cloud Infrastructure Foundations Associate", when: "2025" },
  { what: "Oracle Cloud Infrastructure Generative AI Professional", when: "2025" },
  { what: "Anthropic AI Fluency, and Claude 101", when: "2026" },
  { what: "AWS AI Practitioner Challenge, Udacity", when: "2026" },
  { what: "Infosys Springboard: Artificial Intelligence, Deep Learning, and Natural Language Processing", when: "2026" },
];

export function daysSince(iso: string, now = new Date()): number {
  return Math.max(0, Math.round((now.getTime() - new Date(iso + "T00:00:00Z").getTime()) / 86400000));
}
