#!/usr/bin/env node
/**
 * npm run facts
 *
 * Asks GitHub whether every pull request in content/data.ts still says what the site says,
 * and whether there is an open one the site does not know about.
 *
 * It exists because the site went five weeks telling people that its best work was unmerged
 * when five of those pull requests had landed, while three new ones went unlisted and two that
 * were listed had become drafts. Nothing tells data.ts when a maintainer presses merge, so this
 * has to be run by hand: at the start of any session that touches content, and before anything
 * is called done.
 *
 * It checks states, dates and the count of lines added and removed. It cannot check benchmark
 * figures. Those are read from the last numbers the author posted on the pull request, by a
 * person.
 *
 * It reads content/data.ts itself, the same file the site is built from, so there is no second
 * description of the facts to fall out of step. That is the file in this checkout, and it says
 * so when the file differs from origin/main, which is what the live site was built from.
 * Reads only. Uses the gh command if it is signed in, and the public API otherwise, which
 * allows sixty requests an hour and needs about twenty five.
 *
 * It leaves with 0 when everything matched, 1 when something on the site is wrong, and 2 when
 * the check itself could not be made, because GitHub could not be asked or content/data.ts
 * could not be read. That is neither a pass nor a mismatch.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

let data;
try {
  data = await import("../content/data.ts");
} catch (e) {
  // Node before 22.18 has to be asked to read TypeScript. Ask once, and run again.
  if (e.code === "ERR_UNKNOWN_FILE_EXTENSION") {
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 22 || (major === 22 && minor < 6)) {
      console.error(`\n  This needs Node 22.6 or newer to read content/data.ts, and this is Node ${process.versions.node}. Nothing was checked.\n`);
      process.exit(2);
    }
    if (!process.execArgv.includes("--experimental-strip-types")) {
      const again = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit" });
      process.exit(again.status ?? 2);
    }
  }
  console.error(`\n  Could not read content/data.ts, so nothing was checked.\n  ${String(e.message).split("\n")[0]}\n`);
  process.exit(2);
}
const { prs, prRepo, links } = data;
if (!Array.isArray(prs) || prs.length === 0 || typeof prRepo !== "function") {
  console.error("\n  content/data.ts no longer exports prs and prRepo, so nothing was checked.\n");
  process.exit(2);
}

let useGh = true;
try { execFileSync("gh", ["auth", "status"], { stdio: "ignore" }); } catch { useGh = false; }

/** an answer of "there is no such thing" is a fact about the site. every other failure is only a failure to ask. */
const missing = (message) => Object.assign(new Error(message), { missing: true });

async function ask(path) {
  if (useGh) {
    try {
      return JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
    } catch (e) {
      // gh puts the reason on the last line it writes. the first line is only the command again.
      const said = String(e.stderr ?? "").trim().split("\n").pop();
      if (/HTTP 404/.test(said)) throw missing(said);
      throw new Error(said || String(e.message).split("\n")[0]);
    }
  }
  const res = await fetch(`https://api.github.com/${path}`, { headers: { accept: "application/vnd.github+json" } });
  if (res.status === 403 || res.status === 429) throw new Error("GitHub is rate limiting this machine. Sign in with gh, or wait an hour.");
  if (res.status === 404) throw missing("GitHub answered 404");
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return res.json();
}

const day = (iso) => (iso ? iso.slice(0, 10) : undefined);
/** what the site says and GitHub does not */
const wrong = [];
/** what GitHub would not answer. this says nothing about whether the site is right. */
const unasked = [];
let checked = 0;

for (const p of prs) {
  const full = prRepo(p);
  const name = `${full} ${p.num}`;
  let live;
  try { live = await ask(`repos/${full}/pulls/${p.num}`); } catch (e) {
    // running it again does not help with this one. the number or the repository is wrong, or cannot be seen.
    if (e.missing) wrong.push(`${name}: GitHub shows no such pull request, and the site links to it`);
    else unasked.push(`${name}: ${e.message}`);
    continue;
  }
  checked++;
  if (day(live.created_at) !== p.opened) wrong.push(`${name}: opened ${day(live.created_at)}, the site says ${p.opened}`);
  if (live.merged && !p.merged) wrong.push(`${name}: MERGED on ${day(live.merged_at)}, the site still says open`);
  else if (live.merged && day(live.merged_at) !== p.merged) wrong.push(`${name}: merged ${day(live.merged_at)}, the site says ${p.merged}`);
  else if (!live.merged && p.merged) wrong.push(`${name}: not merged, the site says merged ${p.merged}`);
  else if (!live.merged && live.state === "closed") wrong.push(`${name}: CLOSED without being merged, the site says open`);
  else if (!live.merged && live.draft) wrong.push(`${name}: a DRAFT on GitHub, and the site does not list drafts. Take it out of data.ts`);

  // an open pull request keeps changing size as review goes on, so this one drifts on its own
  if (p.diff) {
    const m = p.diff.match(/^([\d,]+) lines? added, ([\d,]+) removed$/);
    const n = (s) => Number(s.replace(/,/g, ""));
    if (!m) wrong.push(`${name}: the size is written as "${p.diff}", which this check cannot read. Write it as "67 lines added, 12 removed"`);
    else if (n(m[1]) !== live.additions || n(m[2]) !== live.deletions) {
      wrong.push(`${name}: ${live.additions} lines added and ${live.deletions} removed, the site says ${p.diff}`);
    }
  }
}

// The other half: work GitHub knows about and the site does not.
const mine = links?.github?.match(/github\.com\/([^/]+)/)?.[1];
const unlisted = [];
/** open, not a draft, and in a repository the site does not list at all: the first change to a new project looks like this */
const openElsewhere = [];
if (!mine) {
  unasked.push("no GitHub address under links in data.ts, so unlisted pull requests were not looked for");
} else {
  try {
    const found = await ask(`search/issues?q=${encodeURIComponent(`author:${mine} type:pr -user:${mine}`)}&per_page=100`);
    // this is how GitHub reports a search it gave up on. the list it sends with it is not the whole list.
    if (found.incomplete_results) unasked.push("the search for unlisted pull requests: GitHub did not finish it");
    const have = new Set(prs.map((p) => `${prRepo(p).toLowerCase()}#${p.num}`));
    const listedRepos = new Set(prs.map((p) => prRepo(p).toLowerCase()));
    for (const it of found.items ?? []) {
      const repo = it.repository_url.replace("https://api.github.com/repos/", "");
      if (have.has(`${repo.toLowerCase()}#${it.number}`)) continue;
      const merged = Boolean(it.pull_request?.merged_at);
      if (it.state === "open" && !it.draft && listedRepos.has(repo.toLowerCase())) {
        wrong.push(`${repo} ${it.number}: OPEN since ${day(it.created_at)} and not on the site. "${it.title}"`);
      } else if (it.state === "open" && !it.draft) {
        openElsewhere.push(`${repo} ${it.number}, open since ${day(it.created_at)}. "${it.title}"`);
      } else if (merged) {
        unlisted.push(`${repo} ${it.number}, merged ${day(it.pull_request.merged_at)}. "${it.title}"`);
      }
    }
    if ((found.total_count ?? 0) > 100) unasked.push(`GitHub has ${found.total_count} pull requests and this check only reads the first 100`);
  } catch (e) {
    unasked.push(`the search for unlisted pull requests: ${e.message}`);
  }
}

const merged = prs.filter((p) => p.merged).length;
console.log(`\n  ${checked} of ${prs.length} pull requests checked against GitHub. content/data.ts says ${merged} merged and ${prs.length - merged} open.`);

// This reads the file in front of it. The live site is built from main, and may not have it yet.
try {
  execFileSync("git", ["diff", "--quiet", "origin/main", "--", "content/data.ts"], { cwd: fileURLToPath(new URL("..", import.meta.url)), stdio: "ignore" });
} catch (e) {
  if (e.status === 1) console.log("\n  This content/data.ts is not the one the live site was built from: it differs from origin/main.\n  A pass here says this file is right, not that the site is, until it is merged and deployed.");
  // any other failure means git could not tell, and then nothing is claimed either way
}

if (openElsewhere.length) {
  console.log(`\n  Open, and in a project the site does not list. Add ${openElsewhere.length === 1 ? "it" : "them"} to content/data.ts, unless leaving ${openElsewhere.length === 1 ? "it" : "them"} off is on purpose:`);
  for (const u of openElsewhere) console.log(`     ${u}`);
}
if (unlisted.length) {
  console.log(`\n  Merged elsewhere and not on the site, which may well be on purpose:`);
  for (const u of unlisted) console.log(`     ${u}`);
}
if (wrong.length) {
  console.log(`\n  ${wrong.length} that ${wrong.length === 1 ? "does" : "do"} not match. Fix content/data.ts, then resume.tex, then run npm run resume.\n`);
  for (const w of wrong) console.log(`  !  ${w}`);
}
if (unasked.length) {
  console.log(`\n  ${unasked.length} that could not be checked. That is not a mismatch and not a pass. Run it again.\n`);
  for (const u of unasked) console.log(`  ?  ${u}`);
}
if (wrong.length === 0 && unasked.length === 0) {
  console.log(`\n  Every one of them still matches${openElsewhere.length ? `. The open ${openElsewhere.length === 1 ? "one above is" : "ones above are"} not on the site.` : ", and nothing open is missing."}`);
}
console.log("");
process.exit(wrong.length ? 1 : unasked.length ? 2 : 0);
