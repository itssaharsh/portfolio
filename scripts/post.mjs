#!/usr/bin/env node
/**
 * ./post notes.txt
 *
 * Give it a plain text file and it puts it on the site as a post. The first line is the title.
 * What it does to the rest is written at the top of post-text.mjs.
 *
 *   ./post notes.txt                     publish it
 *   ./post notes.txt --dry-run           show what would be posted and post nothing
 *   ./post notes.txt --draft             save it where only the writing desk can see it
 *   ./post notes.txt --tags "go, opentelemetry"
 *   npm run post notes.txt               the same thing through npm. flags need a double dash first.
 *
 * Run it again on the same file and the post it made is updated in place, so fixing a typo is
 * one command. It remembers which address a file last posted to, on this machine, so a
 * corrected title updates that post too. It looks before it writes: it asks the site what is
 * there, changes a post only when the file is plainly a version of it, makes a new one only
 * when the file is plainly new, and otherwise stops and asks. A post of under about thirty
 * words is too little text to be plain about, so a change to its text is always asked about,
 * and the answer is --same-post. It leaves a draft a draft and a live post live, leaves alone
 * a summary it would not have cut itself, and keeps a copy of whatever it replaces.
 * What it decides, and why, is in post-plan.mjs, where it can be tested. This file is only
 * the reading, the asking and the printing.
 *
 * It needs ADMIN_PASSWORD, the same one that opens /admin, in .env.local or in the environment.
 * It never sees the database. It talks to /api/posts on the site, which does the saving.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { textToPost, slugify, keptCopy } from "./post-text.mjs";
import { readArgs, plan, dryRun, wholeAddress, PLAIN, DOUBLE_DASH } from "./post-plan.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** where the person was standing when they ran it. npm moves to the package root first. */
const FROM = process.env.INIT_CWD || process.cwd();
const KEEP = join(ROOT, ".post-backups");
const POSTED = join(KEEP, "posted.json");

/** said after any refusal that comes once a copy has been kept, so the copy is not left behind unmentioned */
let keptSoFar = "";
function fail(message) {
  console.error(`\n  ${message}${keptSoFar}\n`);
  process.exit(1);
}

/**
 * Reads KEY=value lines much as Next reads the same file: a later line wins, quotes come off,
 * and a hash after a space starts a comment. In two things it does not follow Next, and takes
 * the value as it was typed, which is how Vercel holds it and so what the server compares
 * against: a hash with no space before it is part of the value, and a dollar sign stands for
 * itself, where Next would cut the value at the one and fill in a name after the other.
 */
function readEnvFile(path) {
  const out = {};
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return out; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    if ((q === '"' || q === "'" || q === "`") && v.lastIndexOf(q) > 0) v = v.slice(1, v.lastIndexOf(q));
    else v = v.replace(/\s+#.*$/, "");
    out[m[1]] = v;
  }
  return out;
}

const readJson = (path) => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return {}; } };

const help = `
  ./post <file.txt>

  The first line of the file is the title. Everything under it is the post.
  Run it again on the same file and the same post is updated.

    --dry-run          show what would be posted, and post nothing
    --draft            save it without publishing. on a live post, takes it off the site
    --publish          publish it, even if it is a draft on the site now
    --tags "a, b"      tags, separated by commas
    --summary "..."    the line shown on the list page. left out, it is cut from the opening
    --slug some-words  the last part of the address on the site. left out, it is made
                       from the title
    --title "..."      for a file with no title line: use this title, and treat the
                       whole file as the post
    --localhost        post to http://localhost:3000 instead of the live site
    --site <address>   post somewhere else entirely

  When it cannot tell whether the file is a new version of a post that is already
  there, it stops and asks. The answer is one of these:

    --same-post        it is that post. change it where it is, and keep its date,
                       its tags and whether it is out
    --separate         it is a new post. put it beside the one that looks like it
    --overwrite        it is a different post. replace the one at that address,
                       as a new post

  Through npm the flags go after a double dash:  npm run post notes.txt -- --draft
`;

let args;
try { args = readArgs(process.argv.slice(2), process.env); } catch (e) { fail(e.message); }
if (args.help || args.files.length === 0) { console.log(help); process.exit(args.help ? 0 : 1); }
if (args.files.length > 1) {
  // the likeliest cause by far is a value with a space in it and no quotes round it
  const viaNpm = Boolean(process.env.npm_lifecycle_event);
  fail(`One file at a time. Got ${args.files.length}: ${args.files.join(", ")}\n  If one of those belongs to a flag, put quotes round it:  --tags "go, opentelemetry"${viaNpm ? `\n  Through npm, a flag typed before a double dash goes missing as well.\n  ${DOUBLE_DASH}` : ""}`);
}

const file = resolve(FROM, args.files[0]);
/** posting back a copy this command kept: the old version of a post, not a new post */
const restoring = file.startsWith(KEEP + sep);
// a copy goes back to the address written in it. sent somewhere else it would land on another post.
if (restoring && args.slug) fail("This file is a copy the command kept, and it goes back to its own address. --slug does not go with it.");
let raw;
try { raw = readFileSync(file, "utf8"); } catch { fail(`Could not read ${file}`); }

let post;
try {
  post = textToPost(raw, { title: args.title, tags: args.tags?.split(","), summary: args.summary, slug: args.slug, copy: restoring });
} catch (e) {
  fail(e.message);
}
// the site refuses a longer one, and by then a copy of the post would already have been kept
if (post.title.length > 200) fail(`The title is ${post.title.length} characters long, and the site takes 200 at most. The first line of the file is the title.`);
/** what the command line says about publishing. undefined means it says nothing. */
const flagPublished = args.draft ? false : args.publish ? true : undefined;

const n = (x) => x.toLocaleString("en-GB");
const count = (x, word) => `${n(x)} ${word}${x === 1 ? "" : "s"}`;
// everything that was read from the file is shown, so a dry run cannot hide a date or a cover
const facts = [
  count(post.words, "word"), count(post.minutes, "minute"), count(post.headings.length, "heading"),
  post.tags.length ? `tags: ${post.tags.join(", ")}` : null,
  post.date ? `dated ${post.date}` : null,
  post.given.cover ? (post.cover ? `cover: ${post.cover}` : "no cover") : null,
].filter(Boolean).join(" · ");
console.log(`
  ${post.title}
  ${facts}

  ${post.excerpt}
`);
for (const h of post.headings) console.log(`    ${h}`);
if (post.headings.length) console.log("");
for (const w of post.warnings) console.log(`  !  ${w}`);
if (post.warnings.length) console.log("");

const env = { ...readEnvFile(join(ROOT, ".env")), ...readEnvFile(join(ROOT, ".env.local")), ...process.env };

/** the one place the address of the site is written down */
const home = readFileSync(join(ROOT, "content", "data.ts"), "utf8").match(/SITE_URL\s*=\s*"([^"]+)"/)?.[1];
const site = (args.site ?? (args.localhost ? "http://localhost:3000" : home) ?? "").replace(/\/+$/, "");
if (!site) fail("Could not work out where the site is. Pass --site with its address.");

const fromTitle = slugify(post.title);
const posted = readJson(POSTED);
/** the address this file last posted to. it is only looked at when the file names no address itself, and a copy never has one. */
const remembered = !post.slug && !restoring && posted[file]?.site === site ? posted[file].slug : undefined;
if (!post.slug && !fromTitle && !remembered) fail("That title has no letters or numbers to make an address from. Pass --slug with some.");
/** a new post gets a tidied address. one that is already there keeps the address it has, however it was typed. */
const target = post.slug ?? fromTitle;

if (args["dry-run"]) {
  // The rules are worded in post-plan.mjs, for the kind of file and the flags in hand, so that
  // no line here promises what the real run would refuse.
  const lines = [
    "Dry run. Nothing was posted, and the site was not asked anything, so this is what the", "rules say and not what is there.",
    ...dryRun({ post, target, remembered, site, restoring, published: flagPublished, samePost: args["same-post"], separate: args.separate, overwrite: args.overwrite }),
    "This is what would be sent:",
  ];
  console.log(lines.map((l) => `  ${l}`).join("\n") + "\n");
  console.log(post.body_md.split("\n").map((l) => `  | ${l}`).join("\n") + "\n");
  process.exit(0);
}

const password = env.ADMIN_PASSWORD;
if (!password) fail("ADMIN_PASSWORD is not set. Put the password that opens /admin in .env.local as ADMIN_PASSWORD=...");

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(site + path, {
      method,
      headers: { authorization: `Bearer ${password}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      // the database sleeps when nobody is reading, and the first request has to wake it
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    fail(`Could not reach ${site}. ${e.name === "TimeoutError" ? "It took over a minute to answer." : e.cause?.message ?? e.message}`);
  }
  let answer = null;
  try { answer = await res.json(); } catch { /* not JSON, so the status is all there is */ }
  if (res.ok && answer?.ok) return answer;
  // a page where an answer should be. a preview behind a sign in page does this, with a 200 or a 401.
  if (!answer && (res.ok || res.status === 401 || res.status === 403)) {
    fail(`${site} answered with a page instead of an answer${res.redirected ? `, after sending this on to ${new URL(res.url).origin}` : ""}.\n  If that address is a preview kept behind a sign in, it never reached the site. Use the public address.`);
  }
  if (res.status === 401) fail(`${site} did not accept the password. ADMIN_PASSWORD here has to be the one set on the server.`);
  if (res.status === 404 && !answer) fail(`${site} has no /api/posts yet. The code that adds it has to be deployed first.`);
  if (res.status === 409 && answer?.existing) {
    // A copy goes back to its own address, so it is never pointed at another one. What stops
    // it here is a post that has its title, and the copy itself is a file, not a post at the desk.
    if (restoring) fail(`${answer.error}\n  A kept copy goes back to its own address, and this stops it. Give that post another title at the desk, or change the title: line at the top of the copy, then run this again.`);
    const slug = await typed(answer.existing.slug);
    // --overwrite found nothing to replace and the post went up as a new one, which is what
    // the site has just refused. The other two answers cannot stand beside it on one line.
    const nothingThere = `--overwrite replaces what is at an address, and nothing is at ${site}/blog/${target}. To replace that post with this one, add  --slug ${slug}`;
    if (answer.near) {
      fail(args.overwrite
        ? `${answer.error}\n  ${nothingThere}\n  If this is a new version of that post, take --overwrite off and add  --slug ${slug} --same-post\n  If it is a new post, take --overwrite off and add  --separate`
        : `${answer.error}\n  If this is a new version of that post, add  --slug ${slug} --same-post\n  If it is a new post, add  --separate`);
    }
    // A post with this title lives somewhere else. Sent to that address with no answer, the
    // command would only ask again unless the text is plainly that post's, so the answer is printed with it.
    fail(args.separate ? `${answer.error}\n  For a second post, give it its own title`
      : args.overwrite ? `${answer.error}\n  ${nothingThere}`
      : `${answer.error}\n  To change that post from this file, add  --slug ${slug} --same-post`);
  }
  fail(`${site} answered ${res.status}. ${answer?.error ?? "It gave no reason."}`);
}
const lookAt = async (slug) => (await call("GET", `/api/posts?slug=${encodeURIComponent(slug)}`)).post;
/** the same look, for a hint only. if it cannot be had, the message it was wanted for is still printed. */
async function peek(slug) {
  try {
    const res = await fetch(`${site}/api/posts?slug=${encodeURIComponent(slug)}`, { headers: { authorization: `Bearer ${password}` }, signal: AbortSignal.timeout(20_000) });
    return (await res.json())?.post ?? null;
  } catch {
    return undefined;
  }
}
/**
 * What to type after --slug to reach the post stored at an address. One typed at the old desk
 * can hold a space, which the flag refuses, or an ampersand, which a shell takes for its own.
 * Its tidied form finds it, unless another post is stored at exactly that, so the site is
 * asked before the tidied form is printed. Failing that it is printed whole, the way a
 * browser shows it, which the flag takes and asks for exactly.
 */
async function typed(slug) {
  if (PLAIN.test(slug)) return slug;
  const tidy = slugify(slug);
  return tidy && (await peek(tidy))?.slug === slug ? tidy : wholeAddress(site, slug);
}

// 1. Look before writing: at the address this file last posted to, and at the address it asks for now.
// An address that was pasted whole and had to be tidied is asked for as it was pasted. The
// site looks for exactly that first, then for the tidied form. Asked for the tidied form
// alone, it would hand back another post when one happens to be stored at exactly that.
const made = remembered ? await lookAt(remembered) : null;
const atTarget = !target ? null : made && remembered === target ? made : await lookAt(args.pasted ?? target);

// 2. Decide what changes. Anything not sent is left as it is on the site.
const todo = plan({
  post, atTarget, made, restoring, site,
  published: flagPublished, samePost: args["same-post"], separate: args.separate, overwrite: args.overwrite,
});
if (todo.refuse) fail(todo.refuse);
const { send, notes, existing } = todo;
if (!existing && !send.slug) fail("That title has no letters or numbers to make an address from. Pass --slug with some.");

const remember = (slug) => {
  if (restoring) return;
  try {
    mkdirSync(KEEP, { recursive: true });
    writeFileSync(POSTED, JSON.stringify({ ...posted, [file]: { slug, site } }, null, 2) + "\n");
  } catch { /* only a convenience: next time the address comes from the title again */ }
};
const say = (lines) => { for (const l of lines) console.log(`  ${l}`); if (lines.length) console.log(""); };

if (todo.same) {
  remember(existing.slug);
  console.log(`  Nothing to change. The site already has exactly this${existing.published ? "" : ", as a draft"}.\n  ${existing.published ? `${site}/blog/${existing.slug}` : `${site}/admin`}\n`);
  say(notes);
  process.exit(0);
}

// Changing a post replaces what was there for good, so keep it first, as a file this command can post back.
let kept = null;
if (todo.keep && !existing.body_md.trim()) {
  notes.push("What was there had a title and no text, so there was nothing to keep a copy of.");
} else if (todo.keep) {
  try {
    const copy = keptCopy(existing, todo.why);
    // read it back the way this command would, before anything is written, and say so if
    // something would not survive the trip
    const back = textToPost(copy, { copy: true });
    const day = (d) => (d ? Date.parse(d) : null);
    const lost = [
      back.title !== existing.title.trim() && "title",
      back.slug !== existing.slug && "address",
      back.draft === existing.published && "whether it is published",
      JSON.stringify(back.tags) !== JSON.stringify(existing.tags ?? []) && "tags",
      back.body_md !== existing.body_md.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "") && "text",
      (back.given.summary ? back.excerpt : "") !== (existing.excerpt ?? "") && "summary",
      day(back.date) !== day(existing.published_at) && "date",
      (back.cover || null) !== (existing.cover_url ?? null) && "cover",
    ].filter(Boolean);
    mkdirSync(KEEP, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    // two runs inside one second must not share a name, or the first copy would be written over
    for (let i = 1; !kept || existsSync(kept); i++) kept = join(KEEP, `${slugify(existing.slug) || "post"}-${stamp}${i > 1 ? `-${i}` : ""}.txt`);
    writeFileSync(kept, copy);
    keptSoFar = `\n  What was there before this run is kept at ${relative(FROM, kept) || kept}`;
    if (lost.length) notes.push(`The kept copy does not carry the old ${lost.length > 1 ? `${lost.slice(0, -1).join(", ")} and ${lost.at(-1)}` : lost[0]} exactly. Check it by hand before posting it back.`);
  } catch (e) {
    fail(`Could not keep a copy of the post this would replace, so nothing was sent. ${e.message}`);
  }
}

// 3. Send it.
const answer = await call("POST", "/api/posts", send);
keptSoFar = "";
remember(answer.slug);

const did = !answer.updated ? (answer.published ? "Published" : "Saved as a draft")
  : send.fresh ? `Replaced what was there, and ${answer.published ? "published" : "saved as a draft"}`
  : answer.published ? (todo.wasLive ? "Updated" : "Updated, and now published")
  : (todo.wasLive ? "Taken off the site, and a draft now" : "Updated, still a draft");
console.log(`  ${did}\n  ${answer.published ? answer.url : `${site}/admin`}\n`);
if (answer.updated && !send.fresh && todo.changes.length) console.log(`  Changed: ${todo.changes.join(", ")}.\n`);
say(notes);
if (kept) {
  const where = relative(FROM, kept) || kept;
  const cmd = relative(FROM, join(ROOT, "post"));
  // The copy alone does not always put things back as they were: it never changes by itself
  // whether a post is out. plan() says which flags have to go with it after this run.
  // One thing no flag puts back. A post with no date is given one the first time it goes out,
  // or by a date: line, and the site keeps it from then on. The copy has no date to give, so
  // it leaves that one there. Only an overwrite starts a post clean, and the way back from
  // one is an overwrite as well, as is any way back that carries --overwrite.
  const startsClean = send.fresh || todo.undo.includes("--overwrite");
  const dateStays = !existing.published_at && answer.published_at && !startsClean;
  // with a title passed in, a file can hold no setting lines, so "under the title" would point at a line the command refuses
  const another = args.title
    ? "A line like  date: 2026-08-28  sets another, but only under a title that is the first line of the file, since a file posted with --title can hold no setting lines."
    : "A line like  date: 2026-08-28  under the title sets another.";
  console.log(`  What it replaced is kept at ${where}\n  To put it back:  ${cmd.includes("/") ? cmd : `./${cmd}`} ${JSON.stringify(where)}${todo.undo.map((flag) => ` ${flag}`).join("")}${dateStays ? `\n  Putting it back does not take the date off again. The post had none before this run, and the site keeps a date once a post has one. ${another}` : ""}\n`);
}
if (post.warnings.length) {
  const above = `Posted with the ${post.warnings.length === 1 ? "warning" : "warnings"} above.`;
  // A copy went back as it was kept, so there is nothing to fix in it. For a file, the same
  // command again is the way to change the post, except that --separate would be refused now
  // that the post is there. A very short post is asked about, so the answer is given here.
  console.log(restoring ? `  ${above}\n` : `  ${above} To change the post, fix the file and run this again${args.separate ? " without --separate" : ""}.\n  If the command then asks whether it is the same post, which it does when the text of a very short post has changed, the answer is  --same-post\n`);
}
