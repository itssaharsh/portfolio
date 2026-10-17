/**
 * SINGLE SOURCE OF TRUTH.
 *
 * Every fact rendered anywhere on this site comes from this file. Nothing on a page
 * may assert something that is not here.
 *
 * Verified 2026-10-05 against the live GitHub API (the state, both dates and the line counts
 * of all 22 pull requests, and the description and readme of every repository named here),
 * the resume LaTeX source, and an HTTP check of every live link.
 *
 * Pull requests get merged, closed and opened without telling this file. `npm run facts` asks
 * GitHub again, and also lists any open one that is missing from here. On 2026-10-05 five that
 * had been open were merged, three new ones were not listed at all, and two that were listed
 * turned out to be drafts, one of them turned down by the maintainer. Drafts are not listed.
 *
 * A number is only quoted from the LAST benchmark its author posted. A description is written
 * on day one and the thread underneath often carries a later, smaller, truer figure.
 *
 * Two claims that were once on the resume are wrong and are deliberately NOT repeated here:
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
  school: "AECS 3, Tarapur, where I finished CBSE Class XII in 2025 with 87%",
  email: "saharsh7002@gmail.com",
  discord: "saharsh12",
  /** the role named in the summary line of resume.tex */
  seeking: "a backend or AI software engineering internship",
  /** one line for search results and link previews */
  intro: "Second year computer science student in Pune",
} as const;

/** Where the site lives. The sitemap, the link previews and the post command all use this. */
export const SITE_URL = "https://itssaharsh.vercel.app";

export const links = {
  github: "https://github.com/itssaharsh",
  linkedin: "https://www.linkedin.com/in/saharsh-tibrewala/",
  x: "https://x.com/Saharshbugging",
  leetcode: "https://leetcode.com/u/itssaharsh",
  codechef: "https://www.codechef.com/users/itssaharsh",
  codeforces: "https://codeforces.com/profile/itssah",
} as const;

/** Two short paragraphs for the about section. Each sentence is backed by something below. */
export const about = [
  "I am a second year computer science student at VIT Pune. Since October 2025 I have been sending changes to open source projects, most of them to OpenTelemetry. The ones I like best find something that runs on every request and make it cost less, with a benchmark to prove it.",
  "I also build things end to end and put them where people can open them. Lately a lot of that has been at hackathons, on problems like scam calls and product recalls.",
] as const;

/** From the skills block of resume.tex. Names of real tools keep their real spelling. */
export const skills = [
  { k: "Languages", v: "Go, Python, Java, C++, SQL, Shell" },
  { k: "Libraries and APIs", v: "OpenTelemetry SDK, gRPC, REST APIs, pandas, NumPy" },
  { k: "Tools", v: "Git, GitHub Actions, Docker, Kubernetes, Linux" },
] as const;

/**
 * The day the Cloud Native Computing Foundation moved OpenTelemetry to Graduated, the highest
 * of its three levels. The date is the one on cncf.io/projects/opentelemetry. The foundation
 * announced it ten days later, on 21 May. Many reviewers do not know it.
 */
export const CNCF_GRADUATED = "11 May 2026";

type Repo = {
  full: string;
  /** who it belongs to, written the way they write it */
  org: string;
  /** what the project is, in plain words. checked against its own description on GitHub. */
  is: string;
};

const REPO = {
  otelgo: {
    full: "open-telemetry/opentelemetry-go", org: "OpenTelemetry",
    is: "The Go version of OpenTelemetry. A program written in Go uses it to report what it is doing.",
  },
  otelc: {
    full: "open-telemetry/opentelemetry-go-compile-instrumentation", org: "OpenTelemetry",
    is: "Adds that reporting to a Go program while it is being built, so nobody has to write it in by hand.",
  },
  rsm: {
    full: "kubernetes-sigs/resource-state-metrics", org: "Kubernetes SIGs",
    is: "Runs inside Kubernetes and turns the state of the things people have added to a cluster into numbers they can watch.",
  },
  seedsigner: {
    full: "SeedSigner/seedsigner", org: "SeedSigner",
    is: "A Bitcoin signing device you build yourself from a Raspberry Pi Zero that is never connected to the internet.",
  },
  contrib: {
    full: "open-telemetry/opentelemetry-collector-contrib", org: "OpenTelemetry",
    is: "The shared home for the extra parts people have written for the Collector, the program that gathers what other programs report and passes it on.",
  },
  spec: {
    full: "open-telemetry/opentelemetry-specification", org: "OpenTelemetry",
    is: "The written rules every version of OpenTelemetry has to follow.",
  },
  pandas: {
    full: "pandas-dev/pandas", org: "pandas",
    is: "A widely used Python library for working with tables of data.",
  },
} as const satisfies Record<string, Repo>;

export type RepoKey = keyof typeof REPO;

export type PR = {
  repo: RepoKey;
  num: number;
  what: string;
  /** the day it was opened, from GitHub, in UTC */
  opened: string;
  /** the day it was merged. Absent means it is still open. */
  merged?: string;
  /** a measured result, taken from the benchmark in the pull request itself */
  gain?: string;
  diff?: string;
};

/**
 * Listed in the order they are shown: one project at a time, the strongest or newest first.
 * What has merged is written in the past tense. What is still open is written in the present,
 * because "made" beside the word open says it shipped.
 */
export const prs: PR[] = [
  // ---- opentelemetry-go, ten merged ----
  { repo: "otelgo", num: 8740, opened: "2026-08-12", merged: "2026-09-21", diff: "67 lines added, 12 removed",
    gain: "33% less time on the longer identifier, 28% on the shorter",
    what: "Wrote the decoding out step by step so the compiler can drop all twelve of its safety checks" },
  { repo: "otelgo", num: 8739, opened: "2026-08-12", merged: "2026-09-07", diff: "48 lines added, 15 removed",
    // Extract/Sampled is the label requests carry today. FutureAdditionalData is a later version of it.
    gain: "9% less time on today's label, 11% on a newer form of it",
    what: "Made one pass instead of two over the label every request carries, by looking each character up in a table" },
  { repo: "otelgo", num: 8015, opened: "2026-03-06", merged: "2026-05-20", what: "Generated the measurement buckets from the shared definition instead of by hand" },
  { repo: "otelgo", num: 7881, opened: "2026-02-07", merged: "2026-02-20", what: "Skipped the work when nobody is listening, on the trace sender that uses plain web requests" },
  { repo: "otelgo", num: 7866, opened: "2026-02-03", merged: "2026-02-09", what: "The same skip, on the Prometheus side" },
  { repo: "otelgo", num: 7825, opened: "2026-01-22", merged: "2026-02-10", what: "The same skip, on the trace sender that uses gRPC" },
  { repo: "otelgo", num: 7824, opened: "2026-01-21", merged: "2026-02-10", what: "The same skip, on the log sender" },
  { repo: "otelgo", num: 7789, opened: "2026-01-15", merged: "2026-01-21", what: "Moved the shared names forward two versions, across 65 files" },
  { repo: "otelgo", num: 7764, opened: "2026-01-08", merged: "2026-01-13", what: "Added tests showing that merging a resource with itself changes nothing" },
  { repo: "otelgo", num: 7751, opened: "2026-01-04", merged: "2026-01-05", what: "Added tests for how attribute values get written out" },

  // ---- opentelemetry-go-compile-instrumentation, two merged, three open ----
  { repo: "otelc", num: 1137, opened: "2026-08-17", merged: "2026-09-07", diff: "149 lines added, 108 removed",
    // From the benchmark the author posted on 6 Sep, the day before it merged. The description
    // still shows the first run, 19% and 20%, taken against an older and slower main.
    gain: "12% less time on requests coming in, 6% on requests going out, by the last benchmark posted on the pull request",
    what: "Cut what gets claimed from memory on every single web request" },
  { repo: "otelc", num: 1136, opened: "2026-08-17", merged: "2026-09-29", diff: "320 lines added, 10 removed",
    what: "Stopped rewriting files and tidying them again when nothing had changed" },
  // No figures for these two. On GitHub their descriptions are swapped with each other.
  { repo: "otelc", num: 1416, opened: "2026-09-29", diff: "44 lines added, 4 removed",
    what: "Stops pulling a whole database query apart just to read its first word" },
  { repo: "otelc", num: 1415, opened: "2026-09-29", diff: "65 lines added, 14 removed",
    what: "Adds the request's label to every log line without claiming memory to do it" },
  { repo: "otelc", num: 1425, opened: "2026-09-29", diff: "249 lines added, 11 removed",
    what: "Fixes two tests that could fail because they did not wait for the thing they check" },

  // ---- resource-state-metrics, one merged, one open ----
  { repo: "rsm", num: 102, opened: "2026-08-17", merged: "2026-09-20", diff: "103 lines added, 24 removed",
    gain: "99% less time, and 421 pieces of memory down to 2",
    what: "Took out a search that got slower the more it had to look at" },
  { repo: "rsm", num: 101, opened: "2026-08-17", diff: "109 lines added, 19 removed",
    gain: "67% less time",
    what: "Compiles the little scripts once and keeps them, rather than once for every object" },

  // ---- SeedSigner, two open. 929 and 930 are drafts there, and 929 was turned down, so neither is listed. ----
  { repo: "seedsigner", num: 916, opened: "2026-04-13", what: "Makes the address explorer work for wallets that keep their keys on a path of their own" },
  { repo: "seedsigner", num: 927, opened: "2026-04-23", what: "Checks a newer kind of shared address, one that needs several keys to spend from" },

  // ---- one each ----
  { repo: "contrib", num: 46467, opened: "2026-02-26", merged: "2026-02-26", what: "Fixed one out of date version number in the Collector's build configuration" },
  { repo: "spec", num: 5112, opened: "2026-05-21", merged: "2026-05-21", what: "Fixed a misplaced full stop in the overview" },
  { repo: "pandas", num: 62573, opened: "2025-10-04", merged: "2025-10-05", what: "Made the documentation say what the function actually accepts" },
];

export const repoOf = (p: PR) => REPO[p.repo];
/** the name of the repository as GitHub spells it, without its owner */
export const repoName = (p: PR) => REPO[p.repo].full.split("/")[1];
export const repoUrl = (k: RepoKey) => `https://github.com/${REPO[k].full}`;
export const prUrl = (p: PR) => `${repoUrl(p.repo)}/pull/${p.num}`;
export const prRepo = (p: PR) => REPO[p.repo].full;
export const merged = prs.filter((p) => p.merged);
/** open on GitHub and not a draft. nobody is promised to be reading it, so the site says open and no more. */
export const stillOpen = prs.filter((p) => !p.merged);

const findPr = (repo: RepoKey, num: number) => prs.find((p) => p.repo === repo && p.num === num)!;

/** The four numbers that have to be readable in the first thirty seconds. */
export const proof = [
  { n: "421→2", pr: findPr("rsm", 102),
    w: "pieces of memory claimed per run, after taking out a search that got slower the more it had to look at" },
  { n: "33%", pr: findPr("otelgo", 8740),
    w: "less time decoding the longer of two identifiers and 28% less on the shorter, with twelve safety checks the compiler no longer has to write and no extra memory claimed" },
  { n: "9%", pr: findPr("otelgo", 8739),
    w: "less time reading the label every request carries, and 11% on a newer form of it that nothing sends yet, by looking each character up in a table instead of going over it twice" },
  { n: "12%", pr: findPr("otelc", 1137),
    w: "less time in code that runs on every web request coming in, where it now claims 18 pieces of memory instead of 24, and 6% on every one going out, where it claims 17 instead of 26" },
];

/** The floor of the site is this commit. 421 is a real number from a real diff. */
export const HEAP = { before: 421, after: 2 } as const;

/**
 * From the comparison the author posted in kubernetes-sigs/resource-state-metrics 102 two hours
 * after opening it, ten runs a side, "replacing my single-run numbers". The description above
 * it still shows the single run (4,625,897 ns down to 34,825 ns), so the time here is not the
 * first figure a reader meets on that page. The other two rows are the same in both.
 */
export const bench = {
  pr: findPr("rsm", 102),
  name: "BenchmarkCollectIndexedResolvedValues",
  on: "a list of 512 items, ten runs before and ten after, from the benchmark posted on the pull request",
  rows: [
    { name: "how long one run takes", old: "4,397,440 ns", now: "34,890 ns", delta: "99.21% less" },
    { name: "bytes of memory claimed", old: "20,073", now: "9,984", delta: "50.26% less" },
    { name: "pieces of memory claimed", old: "421", now: "2", delta: "99.52% less" },
  ],
} as const;

/** One project with everything sent to it, the way a job history lists one employer. */
export type WorkGroup = { key: RepoKey; repo: Repo; prs: PR[]; merged: number; open: number; period: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2026-09-21 becomes 21 Sep 2026. Done by hand so the time zone of the server can never move a day. */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function period(list: PR[]): string {
  const my = (iso: string) => { const [y, m] = iso.split("-").map(Number); return { y, m, label: `${MONTHS[m - 1]} ${y}` }; };
  const a = my(list.map((p) => p.opened).sort()[0]);
  if (!list.some((p) => p.merged)) return `since ${a.label}`;
  const ends = list.map((p) => p.merged ?? p.opened).sort();
  const b = my(ends[ends.length - 1]);
  if (a.y === b.y && a.m === b.m) return a.label;
  return a.y === b.y ? `${MONTHS[a.m - 1]} to ${b.label}` : `${a.label} to ${b.label}`;
}

export const work: WorkGroup[] = (Object.keys(REPO) as RepoKey[]).map((key) => {
  const list = prs.filter((p) => p.repo === key);
  return { key, repo: REPO[key], prs: list, merged: list.filter((p) => p.merged).length, open: list.filter((p) => !p.merged).length, period: period(list) };
});

/** How many merged changes went to one organisation, and which others have merged work. */
export const mergedInto = (org: string) => merged.filter((p) => REPO[p.repo].org === org).length;
export const mergedOrgs = Array.from(new Set(merged.map((p) => REPO[p.repo].org)));
/** the organisation with the most merged work. the opening sentence of the site is about it. */
export const leadOrg = [...mergedOrgs].sort((a, b) => mergedInto(b) - mergedInto(a))[0];

const SMALL = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
/** 2 becomes two. A numeral straight after a year, as in "2026. 2 more", reads like a typo. */
export const inWords = (n: number) => SMALL[n] ?? String(n);

/** a, b and c */
export function sentenceList(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export type Project = {
  name: string;
  stack: string;
  /** what it is, in one sentence. shown large on a card, so it has to stand on its own. */
  line?: string;
  blurb: string;
  /** the event it was built for, when its own readme names one */
  built?: string;
  source?: string;
  /** somewhere it can be opened and used right now. each one answered an HTTP check. */
  live?: string;
  /** a recorded demo, such as a YouTube link */
  demo?: string;
  private?: true;
  note?: string;
  /** the six shown in full. the rest are listed underneath. */
  featured?: true;
};

const gh = (repo: string) => `https://github.com/itssaharsh/${repo}`;

/**
 * The six shown in full come first and alternate on purpose: the Go that backs the headline,
 * then something that can be opened and used. To change which six, move the `featured` flag.
 */
export const projects: Project[] = [
  { name: "Sherlock", stack: "Go", featured: true,
    source: gh("sherlock"),
    line: "Reads raw Bitcoin blocks and labels every payment by the pattern it shows.",
    blurb: "Runs a set of checks on each payment, such as whether coins were spent together, which coin is the change, and whether many coins were gathered into one, then writes a report. It flags payments and does not group addresses by owner. Runs from the command line, with a small web page for reading the reports." },
  { name: "Countersign", stack: "JavaScript, TypeScript", featured: true,
    built: "The Agent Harness Hackathon, August 2026",
    live: "https://countersign-xi.vercel.app", source: gh("countersign"),
    line: "Counts exactly what a change will delete from a database, and proves the undo, before anyone can approve it.",
    blurb: "It runs the change for real inside a transaction it then undoes, and follows it into every table tied to the rows it deletes. The approve button does not exist until the count and a tested undo both do. The live demo replays a recorded run." },
  { name: "Hydra Recall", stack: "Go", featured: true, private: true,
    note: "private, happy to walk you through it",
    line: "Memory that understands time, built for an assistant.",
    blurb: "Facts are stored with the window they were true for, so when something changes the old version is kept rather than painted over, and you can ask what was true on a given date. When it does not know, it says so instead of guessing." },
  { name: "Canary Maze", stack: "Python, JavaScript", featured: true,
    live: "https://site-nine-hazel-35.vercel.app", demo: "https://site-nine-hazel-35.vercel.app/demo.mp4", source: gh("canary-maze"),
    line: "Shows when one bot reads something on your site and passes it on to another.",
    blurb: "Every automated visitor is given a link that only it was ever shown. When a different visitor asks for that link, both log lines are kept, in a file anyone can check in their own browser with your server switched off. It does not claim the two visitors belong to different people, and it says so. The handoff in the demo was staged with two test bots, and it has not caught a real one yet." },
  { name: "Coin Smith", stack: "Go", featured: true,
    source: gh("coin-smith"),
    line: "Builds Bitcoin payments that follow the shared standard.",
    blurb: "Picks which coins to spend, works out the fee, and handles the change without leaving amounts too small to ever move again. Runs from the command line or as a web service." },
  { name: "Rollcall", stack: "TypeScript", featured: true,
    built: "AssemblyAI Voice Agent Hackathon, September 2026",
    live: "https://rollcall-sage.vercel.app", source: gh("rollcall"),
    line: "A voice agent built to phone every doctor's office on a health plan's list and correct the list.",
    blurb: "Each call checks five facts in three questions. Every change keeps the clip of the office saying it, and an unsure answer goes to a person instead of being written down. Every office is played by another voice model, so no real office has been called. The 40 calls on the live page are recordings." },

  { name: "Dead State", stack: "JavaScript",
    built: "Cambridge x Arcade AI Hackathon 2026",
    live: "https://dead-state.vercel.app", source: gh("dead-state"),
    blurb: "Quests written by an AI model can each read fine and still trap the player once they share a world. This finds the order of ordinary moves that leaves a quest impossible to finish, and shows the path there. On four quests written separately for one city, it found that six ordinary moves could block two of them for good." },
  { name: "RecallIndia", stack: "TypeScript, Python, AWS",
    built: "WeMakeDevs and AWS First Commit, September 2026",
    live: "https://recallindia.d2jn22qjgettr5.amplifyapp.com", source: gh("recallindia"),
    blurb: "India publishes product recalls as documents nobody reads. This keeps checking India's drug regulator and three American recall feeds, turns each notice into a record of the same shape, and matches it against the things a household says it owns. When something matches and a person approves, it stores a signed copy of the evidence under a 30 day lock and writes the claim letter." },
  { name: "Calltree", stack: "JavaScript, TypeScript, AWS",
    built: "AWS Zero to Shipped 2026",
    live: "https://main.dk4896o2qx1ht.amplifyapp.com", source: gh("calltree"),
    blurb: "When a heat warning is issued, it works through a town's register of isolated elderly people, asks each one three questions, and sends a person only to those who did not answer or said something worrying. The demo runs on 100 invented residents, with no real phone line attached." },
  { name: "Crossing Watch", stack: "TypeScript",
    live: "https://crossing-watch.vercel.app", source: gh("crossing-watch"),
    blurb: "Gives a verdict for each named crossing that floods in Juja, Kenya: cross, wait or take another road. The demo replays a real storm from March 2026 as one rain gauge recorded it. It is built to get more accurate as motorbike riders send in reports, and it has not been tried with riders yet." },
  { name: "Thamba", stack: "TypeScript",
    built: "Hack for Humanity: Pune, September 2026",
    live: "https://thamba-pune.vercel.app", source: gh("thamba"),
    blurb: "A second opinion in the middle of a digital arrest scam call, for older people in Pune. Say or type what the caller is claiming and it shows which step of the scam they have reached, in Marathi, Hindi or English." },
  { name: "Clerkmark", stack: "Python, JavaScript",
    built: "LexHack 2026",
    live: "https://clerkmark.vercel.app/?demo=1", source: gh("clerkmark"),
    blurb: "Marks up every case a court filing cites so intake staff know which to check first. It does not confuse a case that is probably invented with a real one that the free case library simply does not hold." },
  { name: "Regrade", stack: "TypeScript",
    built: "Devpost Build With AI: Basics",
    live: "https://regrade-app.vercel.app", source: gh("regrade"),
    blurb: "Sorts youth football teams into bands by their results, fits the new fixtures into the pitches a league actually has, and writes them out in the layout the Football Association's upload tool asks for. Tried on an invented league so far." },
  { name: "Voxmorph", stack: "TypeScript",
    built: "AssemblyAI Voice Hackathon Week, September 2026",
    live: "https://voxmorph-navy.vercel.app", source: gh("voxmorph"),
    blurb: "Say one thing once and get it written five ways, for your boss, your team, your users, your engineers and your family." },
  { name: "Helpline Watch", stack: "Python, TypeScript",
    built: "SerpApi India Hackathon 2026",
    source: gh("helpline-watch"),
    blurb: "Finds the fake customer care numbers scammers plant on Google Search, Maps and ads, city by city, before customers call them." },
  { name: "Meanwhile", stack: "TypeScript",
    source: gh("meanwhile"),
    blurb: "A channel whose only programme is the planet. It watches public webcams, checks how old each frame really is before showing it, and cuts to the best one." },
  { name: "Chain Lens", stack: "Go",
    source: gh("Chain-lens"),
    blurb: "Opens a file of Bitcoin blocks and reports everything inside: every payment, what it cost, how big it was, and which kind of spending rule it used." },
  { name: "YouTube Shorts Pipeline", stack: "Python",
    source: gh("ed"),
    blurb: "Writes the jokes, picks the best one, voices it, generates every frame, checks its own work and uploads the video. The schedule is paused for now, so each run is started by hand." },
  { name: "autoapply", stack: "Python", private: true,
    note: "private, happy to walk you through it",
    blurb: "Finds job openings, tailors the application, and applies. Survives being killed halfway through without losing work or applying to the same place twice. The model that reads your resume runs on your own machine by default, so your resume goes to the employers you apply to and nowhere else. Around 350 tests." },
];

export const featured = projects.filter((p) => p.featured);
export const moreProjects = projects.filter((p) => !p.featured);

/** Static, dated, each linking to the live profile. No API, nothing to break. */
export const ratings = [
  { v: "1741", k: "CodeChef peak", sub: "3 stars", href: links.codechef,
    admission: "It is lower now." },
  { v: "1295", k: "Codeforces peak", sub: "Pupil", href: links.codeforces,
    admission: "I stopped practising for a semester." },
  { v: "350+", k: "LeetCode problems solved", sub: "", href: links.leetcode,
    admission: "Solved, not mastered." },
];
export const RATINGS_AS_OF = "August 2026";

export const achievements = [
  { what: "Linux Foundation LiFT Scholarship", when: "2026", note: "Covers a course and its certification exam" },
  { what: "Summer of Bitcoin", when: "2025", note: "Cleared all four rounds, the last of them the proposal round" },
  { what: "LFX Mentee Finalist", when: "Linux Foundation", note: "Picked for a technical interview with the maintainers" },
  { what: "Google Big Code", when: "2026", note: "Top 15,000 in India" },
];

export const certifications = [
  { what: "Oracle Cloud Infrastructure Foundations Associate", when: "2025" },
  { what: "Oracle Cloud Infrastructure Generative AI Professional", when: "2025" },
  { what: "Anthropic AI Fluency and Claude 101", when: "2026" },
  { what: "AWS AI Practitioner Challenge, Udacity", when: "2026" },
  { what: "Infosys Springboard: Artificial Intelligence, Deep Learning, and Natural Language Processing", when: "2026" },
];

export function daysSince(iso: string, now = new Date()): number {
  // whole days. rounding used to add a day to every count from noon UTC onwards.
  return Math.max(0, Math.floor((now.getTime() - new Date(iso + "T00:00:00Z").getTime()) / 86400000));
}
