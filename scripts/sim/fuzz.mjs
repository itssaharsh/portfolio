#!/usr/bin/env node
/**
 * npm run fuzz            two hundred random commands, a new seed every time
 * npm run fuzz 500 17     five hundred, repeating seed 17
 *
 * Random sequences of the post command against the site in scripts/sim/site.mjs: files written
 * and rewritten, titles changed, flags thrown in, posts saved, edited and deleted at the desk,
 * kept copies put back. When the command stops and asks, the next step is often one of the
 * answers it offered, typed as printed. When it prints a way back, the next step is often that,
 * and nearly always when the run has just given a date to a post that had none.
 *
 * It keeps its own account of what is true and does not ask the code under test. Every text it
 * writes is cut from one of a few pieces, and it remembers which piece each post on the site
 * holds and which piece each kept copy holds. So it can tell that a post was turned into a
 * different piece of writing, or that the same piece went up twice, without calling the
 * functions that are supposed to prevent it. The first version borrowed those functions for
 * its checks, and stayed green with each of them broken.
 *
 * After every step it checks:
 *   A dry run or a refused run sends nothing to be saved and changes nothing.
 *   A file only turns a post into a different piece of writing with --overwrite or --same-post.
 *   The same piece never goes up twice, unless --separate says so or a kept copy is put back.
 *   A draft goes out only with --publish, or as a new post, or by --overwrite from a file.
 *   A live post comes down only with --draft, or by --overwrite from a file that says draft,
 *   or when a kept copy takes its place as a new post: the undo of an overwrite, or --overwrite.
 *   A kept copy never makes anything live by itself, and the words of a copy that was of a
 *   draft never land on a live page unless --publish says so.
 *   A kept copy only takes a post's place as a new post when it is the undo of an overwrite
 *   or is sent with --overwrite.
 *   --same-post never makes a post, and --separate never changes one.
 *   Every post that is changed has a kept copy that reads back to exactly what it was.
 *   A kept copy that is put back puts back the title, the text, the summary, the tags and
 *   the cover of the post it was taken of, and its date where it had one.
 *   The way back printed after a change, typed as printed straight away, leaves the post as it
 *   was before the change, whether it was out included. The one thing it may leave is a date
 *   on a post that had none, and only where the command said so as it printed the way back:
 *   said, and the date is still there, or not said, and it is gone.
 *   An answer the command offers, typed as printed, is not turned away by the command. Only
 *   the site may still refuse it, for a post the command had not looked at. --same-post and
 *   --overwrite then change the post the question named and no other, and an answer that
 *   makes a new post changes none.
 *   No post is made while another already carries its title.
 *   What the command says of the post a file last posted to is true of that post.
 *   What the command prints is what happened, and it never ends on a stack trace.
 *
 * One rule it reaches too seldom to be relied on for: that a post at the address which is
 * plainly this text is the one changed, whatever else the file once made. It needs two posts
 * that are both plainly the file's text. scripts/post-plan.grid.test.mjs holds that rule, in
 * every state, and this only meets it now and then.
 *
 * It leaves with 1 if any of them broke, and says at which step, so the seed can be run again.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newSite, keepFolders, refusalOf, waysOut } from "./site.mjs";
import { textToPost } from "../post-text.mjs";

const STEPS = Number(process.argv[2] ?? 200);
const SEED = Number(process.argv[3] ?? (Date.now() % 100000));
let seed = SEED;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const maybe = (p) => rnd() < p;

const site = newSite();

// ---- what gets written into files ----
const PIECES = {
  cache: ["The cache was never cleared, and for three weeks nobody noticed that it kept growing on every single request that came in.", "The fix was three lines. It removes the entry when the request finishes, whether it finished well or badly.", "I wrote this down so that I would remember what the numbers looked like before and after the change went in."],
  lock: ["A lock is a promise that one thing happens at a time, and the bug was that two parts of the program each believed they held it.", "The retry made it worse. Every failed request came back twice as often, so the queue grew faster than it drained.", "Nothing here is new. It is written down because I had to learn it by breaking something that other people were using."],
  tracing: ["Someone asked me what I work on, and I said tracing,\nand they nodded in the way people nod when they have\ndecided not to ask a second question.", "It is three things: a way to describe what a program is\ndoing, a way to carry that from one program to the next,\nand a place to send it when the request is over.", "The part I work on is the second one. It runs on every\nsingle request, so anything it wastes is wasted millions\nof times a day."],
  queue: ["A queue hides a problem for exactly as long as it takes to fill, and ours took eleven days, which was long enough for everyone to stop looking.", "By the time it was full the thing feeding it had been wrong for a week and a half, and every retry made the line behind it longer.", "What fixed it was not a bigger queue. It was refusing new work at the door while the old work was still being done."],
};
// every piece can be posted under a title of its own, a variant of it, or a title all of them share
const TITLES = {
  cache: ["Notes on the cache", "Notes on the Cache!", "Why the cache never emptied", "Weeknotes"],
  lock: ["Notes on the lock", "Notes on the lock?", "Two things held one lock", "Weeknotes"],
  tracing: ["What tracing is", "What Tracing Is", "Tracing, in three parts", "Weeknotes"],
  queue: ["Notes on the queue", "The queue that hid a week", "Weeknotes"],
};
/** a closing line that different pieces share, the way a writer signs off every post the same way */
const SIGN_OFF = "That is all for this week. Thank you for reading, and see you next Monday, same time and place.";
const FILES = ["a.txt", "b.txt", "c.txt"];
/** which piece each file holds right now */
const inFile = {};
/** give a file another title and leave the rest of it as it is */
const retitle = (name, title) => site.write(name, site.read(name).replace(/^[^\n]*/, title));

function writeFile(name) {
  const piece = pick(Object.keys(PIECES));
  const paras = PIECES[piece].map((p) => (maybe(0.25) ? p.replace(/\.$/, ", as it turned out.") : maybe(0.2) ? p.replace(/\bthe\b/, "teh") : p));
  if (maybe(0.15)) paras.push("One more paragraph, added at the end on a later day.");
  if (maybe(0.1)) paras.shift();
  if (maybe(0.3)) paras.push(SIGN_OFF);
  const settings = [];
  if (maybe(0.15)) settings.push("draft: yes");
  if (maybe(0.15)) settings.push(`tags: ${pick(["go", "go, tracing", ""])}`);
  if (maybe(0.08)) settings.push(`slug: ${pick(["notes", "notes-on-the-cache", "weeknotes"])}`);
  if (maybe(0.08)) settings.push(`summary: ${pick(["A short one.", "Mine."])}`);
  site.write(name, [pick(TITLES[piece]), ...settings, "", paras.join("\n\n"), ""].join("\n"));
  inFile[name] = piece;
}

// ---- the truth this keeps for itself ----
/** which piece each post on the site holds, by the row's id */
const pieceOf = new Map();
/** which piece each kept copy holds, by its path */
const copyHolds = new Map();
/** the post each kept copy was taken of, as it stood then. this is what putting the copy back has to bring back. */
const copyOf = new Map();

const FIELDS = ["title", "slug", "body_md", "excerpt", "tags", "published", "published_at", "cover_url"];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plain = (s) => s.replace(/\r\n?/g, "\n");
const trimmed = (s) => plain(s).replace(/^\n+|\n+$/g, "");
const when = (d) => (d ? Date.parse(d) : null);
function holdsOld(path, old) {
  let back;
  try { back = textToPost(site.keptText(path), { copy: true }); } catch { return false; }
  return back.title === old.title && back.slug === old.slug && back.draft === !old.published && same(back.tags, old.tags)
    && trimmed(back.body_md) === trimmed(old.body_md) && when(back.date) === when(old.published_at)
    && (back.cover || null) === (old.cover_url ?? null) && (back.given.summary ? back.excerpt : "") === (old.excerpt ?? "").replace(/\s+/g, " ").trim();
}
/** the address a file last posted to, as the command itself remembers it */
const remembered = (name) => {
  try { return JSON.parse(readFileSync(join(site.keep, "posted.json"), "utf8"))[join(site.work, name)]?.slug; } catch { return undefined; }
};
/**
 * Where a post differs from the post a kept copy was taken of. Whether it is out is only
 * looked at when asked for, because a copy does not change that by itself. The day it went
 * out is only looked at when the old post had one: a copy cannot say that a post had none.
 */
const differsFrom = (p, old, { state = false } = {}) => [
  p.title !== old.title && "the title",
  trimmed(p.body_md) !== trimmed(old.body_md) && "the text",
  (p.excerpt ?? "") !== (old.excerpt ?? "").replace(/\s+/g, " ").trim() && "the summary",
  !same(p.tags, old.tags) && "the tags",
  (p.cover_url ?? null) !== (old.cover_url ?? null) && "the cover",
  old.published_at && when(p.published_at) !== when(old.published_at) && "the date",
  state && p.published !== old.published && "whether it is out",
].filter(Boolean);

// ---- reading what the command printed ----
// refusalOf and waysOut, in site.mjs, read a refusal for the ways out it offers. They are
// there so that a test can hold them to the sentences the command prints: this file once
// took a sentence about where a kept copy goes for the offer of an address.
/** the site turning a post away. the command cannot see every post, so these it may still meet after an answer. */
const SITE_SAYS_NO = /A post with this title already lives at|Most of this text is already on the site|is inside this text\.|Pick another address, or say replace/;

const broke = [];
const trace = [];
/** the question the last run ended on, with the answers it offered, until the next step has had its chance to give one */
let asked = null;
/** the way back the last run printed, the post as it stood before that run, whether the run said a date would stay on it, and whether it gave the post its first date */
let wayBack = null;
/** how often each of those two was taken up, so a run that never did says so */
const took = { answers: 0, waysBack: 0 };

for (let step = 1; step <= STEPS; step++) {
  const before = site.posts();
  const keptBefore = new Set(site.kept());
  const roll = rnd();
  const answering = asked && maybe(0.6) ? asked : null;
  // The way back from a run that gave a date to a post that had none is taken nearly every
  // time. A run of two hundred steps meets that a handful of times at most, and at the usual
  // odds seven runs in a row tried none of them. It is told by what the run did to the post,
  // not by what the command printed, so it is reached whether or not the command said so.
  const undoing = !answering && wayBack && maybe(wayBack.gaveDate ? 0.9 : 0.35) ? wayBack : null;
  asked = wayBack = null;

  if (!answering && !undoing && roll < 0.14 && before.length) {            // something done at the desk, or left by the old one
    const p = pick(before);
    const what = pick(["publish", "unpublish", "save", "delete", "old line endings", "edit the text"]);
    if (what === "delete") { site.remove(p.slug); pieceOf.delete(p.id); }
    else if (what === "old line endings") site.put({ ...p, body_md: plain(p.body_md).replace(/\n/g, "\r\n") });
    else if (what === "edit the text") site.desk({ slug: p.slug, body_md: plain(p.body_md).replace(/\b(a|the|it)\b/, "$1, well,") });
    else site.desk({ slug: p.slug, published: what === "publish" ? true : what === "unpublish" ? false : p.published });
    trace.push(`${step}. desk: ${what} /blog/${p.slug}`);
    continue;
  }

  let args, restoring = false, label;
  const flags = [];
  /** the way out being taken, when this step answers the question the last one ended on */
  let way = null;
  if (answering) {                                // the same command again, with one of the answers it offered, typed as printed
    way = pick(answering.ways);
    args = answering.args;
    restoring = answering.restoring;
    flags.push(...answering.flags.filter((f) => !(way.dropOverwrite && f === "--overwrite")));
    // "some-other-words" stands for words of the writer's own, so a new address is made up each time
    flags.push(...way.flags.map((f) => (f === "some-other-words" ? `some-other-words-${step}` : f)));
    if (way.ownAddress && !way.flags.includes("--slug")) flags.push("--slug", `an-address-of-its-own-${step}`);
    if (way.ownTitle) retitle(args[0], `${site.read(args[0]).split("\n")[0]}, take ${step}`);
    label = `${restoring ? `put back ${args[0].split("/").pop()}` : `${args[0]} [${site.read(args[0]).split("\n\n")[0].replace(/\n/g, " | ")}] (${inFile[args[0]]})`} answering "${way.said}":`;
  } else if (undoing) {                           // the way back the last run printed, typed as printed
    args = [undoing.path];
    restoring = true;
    flags.push(...undoing.flags);
    label = `put back ${undoing.path.split("/").pop()}, as printed:`;
  } else if (roll < 0.24 && keptBefore.size) {    // put a kept copy back
    const k = pick([...keptBefore]);
    args = [k];
    restoring = true;
    label = `put back ${k.split("/").pop()}`;
  } else {
    const f = pick(FILES);
    if (!inFile[f] || maybe(0.6)) writeFile(f);
    // now and then a file takes the title of a post that is already there, so that two posts are in play at once
    else if (before.length && maybe(0.3)) retitle(f, pick(before).title);
    args = [f];
    label = `${f} [${site.read(f).split("\n\n")[0].replace(/\n/g, " | ")}] (${inFile[f]})`;
  }
  if (!answering && !undoing) {
    if (maybe(0.12)) flags.push("--draft"); else if (maybe(0.12)) flags.push("--publish");
    if (maybe(0.12)) flags.push("--overwrite");
    else if (maybe(0.08)) flags.push("--separate");
    else if (maybe(0.1)) flags.push("--same-post");
    if (!restoring && maybe(0.08)) flags.push("--slug", pick(["notes", ...before.map((p) => p.slug)]));
    if (!restoring && maybe(0.06)) flags.push("--tags", pick(["go", "", "tracing, go"]));
  }
  const dry = !answering && !undoing && maybe(0.08);
  if (dry) flags.push("--dry-run");

  const head = (restoring ? site.keptText(args[0]) : site.read(args[0])).split("\n\n")[0];
  const saysDraft = /^draft: yes$/m.test(head);
  const keptWhy = restoring ? head.match(/^kept: (\w+)$/m)?.[1] : null;
  /** the piece being sent: what the file holds, or what the copy was taken of */
  const sending = restoring ? copyHolds.get(args[0]) : inFile[args[0]];
  const lastPostedTo = restoring ? undefined : remembered(args[0]);
  const { code, out, sent } = site.post(...args, ...flags);
  const after = site.posts();
  const verdict = (out.match(/^  (Published|Saved as a draft|Updated[^\n]*|Taken off[^\n]*|Replaced[^\n]*|Nothing to change[^\n]*)$/m) ?? out.trim().split("\n").filter((l) => /\S/.test(l)).slice(-1))[0]?.trim().slice(0, 100);
  trace.push(`${step}. post ${label} ${flags.join(" ")}  -> exit ${code}: ${verdict}`);

  const posts = sent.filter((w) => w.method === "POST");
  const byId = new Map(before.map((p) => [p.id, p]));
  const inserted = after.filter((p) => !byId.has(p.id));
  const changed = after.filter((p) => byId.has(p.id) && FIELDS.some((f) => !same(p[f], byId.get(p.id)[f])));
  const sentFresh = posts.some((w) => w.body.fresh);
  const say = (what) => broke.push({ step, what, cmd: `${label} ${flags.join(" ")}`, out: out.trim().split("\n").filter((l) => /\S/.test(l)).slice(-8).join("\n") });

  // It has to end on words of its own. Without this, a command that could not even start would
  // pass every check below, because a run that does nothing breaks no rule about what it did.
  if (/\n\s+at .+\(node:|node:internal\//.test(out)) say("the command fell over instead of answering");
  if (dry && (sent.length || !same(before, after) || site.kept().length !== keptBefore.size)) say("a dry run sent or changed something");
  if (code !== 0 && !same(before, after)) say("a refused run changed the site");
  if (inserted.length + changed.length > 1) say("more than one post changed");
  if (flags.includes("--same-post") && inserted.length) say("--same-post made a new post");
  if (flags.includes("--separate") && changed.length) say("--separate changed a post that was there");

  // ---- an answer the command offered, typed as printed ----
  if (way) {
    took.answers++;
    // the post the answer is aimed at: the one an address in the answer names, or else the one the question named
    const at = way.flags.includes("--slug") ? way.flags[way.flags.indexOf("--slug") + 1] : answering.named;
    const kind = flags.includes("--same-post") ? "--same-post" : flags.includes("--overwrite") ? "--overwrite" : restoring ? "putting the copy back" : "a new post";
    if (code !== 0) {
      if (!SITE_SAYS_NO.test(out)) say("an answer the command offered was turned away by the command when typed as printed");
    } else if (kind === "a new post") {
      if (changed.length) say("an answer that was offered for a new post changed a post that was there");
      if (!inserted.length) say("an answer that was offered for a new post made none");
    } else {
      if (inserted.length) say(`an answer that was offered to change a post made a new one (${kind})`);
      if (changed.some((p) => p.slug !== at)) say(`an answer changed a post the question did not name (${kind})`);
    }
  }
  // ---- the way back the last run printed, typed as printed ----
  if (undoing) {
    took.waysBack++;
    const now = after.find((p) => p.id === undoing.old.id);
    if (code !== 0) say("the way back that was printed was refused when typed as printed");
    else if (!now) say("the way back that was printed did not leave the post there");
    else {
      const off = differsFrom(now, undoing.old, { state: true });
      if (off.length) say(`the way back that was printed did not put back ${off.join(", ")}`);
      // a post that had no date before the change: what the command said of the date has to be what happened to it
      if (!undoing.old.published_at && Boolean(now.published_at) !== undoing.dateStays) {
        say(undoing.dateStays ? "said the way back would leave a date on the post, and it left none" : "the way back that was printed left a date on a post that had none, and nothing had said it would");
      }
    }
  }
  // what it says of the post this file last posted to has to be about that post, and true of it
  const named = out.match(/This file last posted to \S+\/blog\/([^\s,]+), which holds/)?.[1];
  if (named && named !== lastPostedTo) say("named a post as the one this file last posted to, and it is not");
  if (/[Tt]hat one was left alone/.test(out) && changed.some((p) => p.slug === lastPostedTo)) say("said the post this file last posted to was left alone, and changed it");

  for (const p of changed) {
    const old = byId.get(p.id);
    const fresh = site.kept().filter((k) => !keptBefore.has(k));
    if (old.body_md.trim() && !fresh.some((k) => holdsOld(k, old))) say("a post was changed and no copy kept in this run holds the old version");
    // the copies kept in this run hold what this post was
    for (const k of fresh) { copyHolds.set(k, pieceOf.get(p.id)); copyOf.set(k, old); }
    // and it brings back the post it was taken of, whichever way it goes back
    if (restoring && copyOf.has(args[0])) {
      const off = differsFrom(p, copyOf.get(args[0]));
      if (off.length) say(`a kept copy was put back, and it did not put back ${off.join(", ")}`);
    }
    // the way back this run printed, for the next step to try
    const printed = out.match(/To put it back: {2}\S+ "([^"]+)"((?: --[a-z-]+)*)\n/);
    if (printed) wayBack = { path: printed[1], flags: printed[2].split(" ").filter(Boolean), old, dateStays: /Putting it back does not take the date off again/.test(out), gaveDate: !old.published_at && Boolean(p.published_at) };

    const was = pieceOf.get(p.id);
    const textChanged = plain(old.body_md) !== plain(p.body_md);
    const now = textChanged ? sending : was;
    pieceOf.set(p.id, now);
    const becameAnother = was !== undefined && now !== undefined && was !== now;
    // Posting a kept copy is itself the request to put that version back at its address, so a
    // copy may change what piece a post holds. What it may not do is decide by itself that it
    // is a new post there, or put a draft's words on a live page: those are checked below.
    const copyReplaces = restoring && sentFresh;
    if (copyReplaces && keptWhy !== "overwrite" && !flags.includes("--overwrite")) say("a kept copy took a post's place as a new post, and it was neither the undo of an overwrite nor told to");
    if (becameAnother && !restoring) {
      if (!flags.includes("--overwrite") && !flags.includes("--same-post")) say(`a post was turned into a different piece of writing (${was} into ${now}) and nothing asked for that`);
      if (flags.includes("--overwrite") && !sentFresh) say("--overwrite put a different piece in a post without making it a new post");
    }
    if (restoring && saysDraft && p.published && !flags.includes("--publish") && (textChanged || old.title !== p.title)) say("the words of a copy that was of a draft landed on a live page with no --publish");
    // When the post at the address the command asked about already holds the file's title and
    // its text word for word, that is the post in hand, whatever else this file once made, and
    // no other post may be changed. The address is read off the command's own last look.
    if (!restoring && textChanged) {
      const lookedAt = decodeURIComponent(sent.filter((w) => w.method === "GET").at(-1)?.path.split("slug=")[1] ?? "");
      const here = before.find((q) => q.slug === lookedAt && q.id !== p.id && q.title.trim() === p.title.trim() && plain(q.body_md) === plain(p.body_md));
      if (here) say(`a post was changed while the one at the address, /blog/${here.slug}, already held this title and this text`);
    }

    const asNewPost = !restoring && flags.includes("--overwrite") && sentFresh;
    if (!old.published && p.published && !flags.includes("--publish") && !(asNewPost && !saysDraft)) say("a draft went out with no --publish");
    if (old.published && !p.published && !flags.includes("--draft") && !(asNewPost && saysDraft) && !copyReplaces) say("a live post came down with no --draft");
    if (restoring && !old.published && p.published && !flags.includes("--publish")) say("a kept copy made a post live by itself");
    if (sentFresh && !restoring && !flags.includes("--overwrite")) say("a post was replaced as a new one with no --overwrite");

    const did = { title: old.title !== p.title, text: textChanged, summary: !same(old.excerpt, p.excerpt), tags: !same(old.tags, p.tags), out: old.published !== p.published, date: old.published_at !== p.published_at, cover: old.cover_url !== p.cover_url };
    const line = out.match(/Changed: ([^\n]+)\./)?.[1];
    if (line) {
      const claims = { title: /the title/.test(line), text: /the text/.test(line), summary: /the summary/.test(line), tags: /the tags/.test(line), out: /whether it is out/.test(line), date: /the date/.test(line), cover: /the cover/.test(line) };
      for (const k of Object.keys(did)) {
        if (claims[k] && !did[k]) say(`said it changed ${k} and did not`);
        if (!claims[k] && did[k] && !(k === "date" && did.out)) say(`changed ${k} and did not say so`);
      }
    }
    if (!/^  (Updated|Taken off the site|Replaced what was there)/m.test(out)) say("a post was changed and the message does not say so");
    if (/Replaced what was there/.test(out) && !sentFresh) say("said Replaced on a change in place");
    if (p.published && !out.includes(`/blog/${p.slug}`)) say("the address printed is not the post that changed");
  }
  for (const p of inserted) {
    pieceOf.set(p.id, sending);
    // compared the way the site compares them: trimmed, and otherwise to the letter
    if (before.some((q) => q.title.trim() === p.title.trim())) say("a post was made while another post already carries its title");
    if (restoring && copyOf.has(args[0])) {
      const off = differsFrom(p, copyOf.get(args[0]));
      if (off.length) say(`a kept copy of a post that was gone came back, and it did not bring back ${off.join(", ")}`);
    }
    if (!/^  (Published|Saved as a draft)$/m.test(out)) say("a post was made and the message does not say so");
    if (p.published !== /^  Published$/m.test(out)) say("made in a different state from the one printed");
    // the same piece, already on the site under another address
    const twin = before.find((q) => pieceOf.get(q.id) === sending);
    if (twin && sending !== undefined && !flags.includes("--separate") && !restoring) say(`the same piece (${sending}) went up a second time, beside /blog/${twin.slug}`);
    if (restoring && p.published && !flags.includes("--publish")) say("a kept copy of a deleted post came back live with no --publish");
  }
  if (/it is a new post and that one was left alone/.test(out) && !inserted.length) say("said it is a new post and no post was made");
  if (/Nothing to change/.test(out) && (posts.length || !same(before, after))) say("said nothing to change and sent a post");
  if (!inserted.length && !changed.length && code === 0 && !dry && !/Nothing to change/.test(out)) say(posts.length ? "sent a post that changed nothing, and did not say so" : "left with 0 having done nothing and said nothing");

  // a run that stopped and offered ways out: the next step may take one of them
  if (code !== 0 && !dry) {
    const lines = refusalOf(out);
    const ways = waysOut(lines);
    if (ways.length) asked = { args, restoring, flags, ways, named: lines[0].match(/\/blog\/([a-z0-9-]+)/)?.[1] };
  }
}

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
console.log(`\n  seed ${SEED}: ${count(STEPS, "step")}, ${count(site.posts().length, "post")} at the end, ${count(site.kept().length, "kept copy", "kept copies")}`);
console.log(`  ${count(took.answers, "answer")} typed as the command printed ${took.answers === 1 ? "it" : "them"}, and ${count(took.waysBack, "way", "ways")} back`);
if (!broke.length) {
  console.log("  Nothing broke.\n");
  process.exit(0);
}
keepFolders();
const tally = {};
for (const b of broke) (tally[b.what] ??= []).push(b.step);
for (const [what, steps] of Object.entries(tally).sort()) console.log(`  ${String(steps.length).padStart(3)}  ${what}   (steps ${steps.slice(0, 6).join(", ")}${steps.length > 6 ? ", ..." : ""})`);
const first = broke[0];
console.log(`\n  The first, at step ${first.step}:  post ${first.cmd}\n${first.out.split("\n").map((l) => `    ${l}`).join("\n")}`);
console.log(`\n  What led up to it:\n${trace.slice(Math.max(0, first.step - 10), first.step).map((l) => `    ${l.slice(0, 220)}`).join("\n")}`);
console.log(`\n  Run it again with:  npm run fuzz ${STEPS} ${SEED}\n  The site it ran against is in ${site.dir}\n`);
process.exit(1);
