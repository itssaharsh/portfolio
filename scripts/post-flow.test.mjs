// npm test
// The post command, run for real, against the real /api/posts and the real writing desk code,
// with a JSON file for a database and no network. See scripts/sim/site.mjs for how.
// Each test is a sequence that once went wrong, or that a reviewer showed could.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newSite, ORIGIN, refusalOf, waysOut } from "./sim/site.mjs";
import { build } from "./sim/build.mjs";
import { mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CACHE = [
  "The cache was never cleared, and for three weeks nobody noticed that it kept growing on every single request that came in.",
  "The fix was three lines. It removes the entry when the request finishes, whether it finished well or badly.",
  "I wrote this down so that I would remember what the numbers looked like before and after the change went in.",
];
const LOCK = [
  "A lock is a promise that one thing happens at a time, and the bug was that two parts of the program each believed they held it.",
  "The retry made it worse. Every failed request came back twice as often, so the queue grew faster than it drained.",
  "Nothing here is new. It is written down because I had to learn it by breaking something that other people were using.",
];
const text = (title, paragraphs, settings = []) => [title, ...settings, "", paragraphs.join("\n\n"), ""].join("\n");
const said = (run) => run.out.split("\n").map((l) => l.trim()).filter(Boolean);
const wrote = (run) => run.sent.filter((s) => s.method === "POST");
const live = (site) => site.posts().filter((p) => p.published).map((p) => p.slug);

test("a file becomes a post, and the same file again changes nothing", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE, ["tags: go, caches"]));
  const first = site.post("notes.txt");
  assert.equal(first.code, 0);
  assert.ok(said(first).includes("Published"));
  assert.ok(said(first).includes(`${ORIGIN}/blog/notes-on-the-cache`));
  const p = site.at("notes-on-the-cache");
  assert.equal(p.published, true);
  assert.deepEqual(p.tags, ["go", "caches"]);
  assert.equal(p.body_md, CACHE.join("\n\n"));
  const again = site.post("notes.txt");
  assert.match(again.out, /Nothing to change/);
  assert.equal(wrote(again).length, 0, "nothing was sent to be saved");
});

test("a dry run asks the site nothing and sends nothing", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  const run = site.post("notes.txt", "--dry-run");
  assert.equal(run.code, 0);
  assert.equal(run.sent.length, 0);
  assert.deepEqual(site.posts(), []);
});

test("a draft whose title is corrected stays one draft, however short it is", () => {
  // this once went up as a second post, published, beside the draft it was meant to fix
  const site = newSite();
  const body = ["The cache was never cleared, and for three weeks nobody noticed.", "The fix was three lines."];
  site.write("notes.txt", text("Teh cache that never emptied", body));
  assert.ok(said(site.post("notes.txt", "--draft")).includes("Saved as a draft"));
  site.write("notes.txt", text("The cache that never emptied", body));
  const fix = site.post("notes.txt");
  assert.ok(said(fix).includes("Updated, still a draft"), fix.out);
  assert.equal(site.posts().length, 1);
  assert.equal(site.posts()[0].title, "The cache that never emptied");
  assert.deepEqual(live(site), []);
});

test("a corrected title and a typo fixed in every paragraph is still the same post", () => {
  const site = newSite();
  const rough = CACHE.map((p) => p.replace(/\bthe\b/i, "teh"));
  rough.forEach((p, i) => assert.notEqual(p, CACHE[i], "every paragraph has a typo in it"));
  site.write("notes.txt", text("Notes on teh cache", rough));
  site.post("notes.txt", "--draft");
  site.write("notes.txt", text("Notes on the cache", CACHE));
  const fix = site.post("notes.txt");
  assert.ok(said(fix).includes("Updated, still a draft"), fix.out);
  assert.equal(site.posts().length, 1);
  assert.equal(site.posts()[0].body_md, CACHE.join("\n\n"));
});

test("a new title over a half rewritten text stops and asks, and each answer does what it says", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt");
  const before = site.posts();
  site.write("notes.txt", text("Why the cache never emptied", [CACHE[0], LOCK[1], LOCK[2]]));
  const asked = site.post("notes.txt");
  assert.equal(asked.code, 1);
  assert.match(asked.out, /This file last posted to .*which holds "Notes on the cache"/);
  assert.match(asked.out, /add {2}--same-post/);
  assert.match(asked.out, /add {2}--separate/);
  assert.equal(wrote(asked).length, 0);
  assert.deepEqual(site.posts(), before, "a refused run changes nothing");

  const same = site.post("notes.txt", "--same-post");
  assert.ok(said(same).includes("Updated"), same.out);
  assert.equal(site.posts().length, 1);
  assert.equal(site.at("notes-on-the-cache").title, "Why the cache never emptied");
  assert.equal(site.at("notes-on-the-cache").published_at, before[0].published_at, "the day it went out is kept");

  // one paragraph of three kept this time: not plainly the same post, and not plainly a different one
  site.write("notes.txt", text("A second look at the cache", CACHE));
  assert.equal(site.post("notes.txt").code, 1, "mostly new again, so it asks again");
  const apart = site.post("notes.txt", "--separate");
  assert.ok(said(apart).includes("Published"), apart.out);
  assert.equal(site.posts().length, 2);
});

test("a short new post that quotes the old one does not replace it", () => {
  const site = newSite();
  const long = "The third paragraph is the long one, and it is the one that gets quoted later on. It says that the number of entries went from four hundred and twenty one down to two, that the time for one run fell by ninety nine percent, and that none of this needed anything clever at all.";
  site.write("notes.txt", text("Notes on the cache", [CACHE[0], CACHE[1], long, CACHE[2], "That is all of it, and thank you for reading as far as this."]));
  site.post("notes.txt");
  const before = site.posts();
  site.write("notes.txt", text("A correction to the cache numbers", ["Last month I wrote this:", long, "The ninety nine was right. The four hundred and twenty one was for a different list."]));
  const run = site.post("notes.txt");
  assert.equal(run.code, 1);
  assert.match(run.out, /--same-post/);
  assert.deepEqual(site.posts(), before);
});

test("a file name reused for a different piece makes a new post and leaves the old one alone", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt");
  site.write("notes.txt", text("Notes on the lock", LOCK));
  const run = site.post("notes.txt", "--draft");
  assert.ok(said(run).includes("Saved as a draft"), run.out);
  assert.match(run.out, /This file last posted to .*which holds "Notes on the cache".*left alone/);
  assert.equal(site.at("notes-on-the-cache").body_md, CACHE.join("\n\n"));
  assert.equal(site.posts().length, 2);
});

test("a file reused for a corrected copy of another post updates that post and claims nothing else", () => {
  // it used to say a new post had gone up, and to delete it, which would have deleted the post it had just updated
  const site = newSite();
  site.write("cache.txt", text("Notes on the cache", CACHE));
  site.write("scratch.txt", text("Notes on the lock", LOCK));
  site.post("cache.txt");
  site.post("scratch.txt");
  site.write("scratch.txt", text("Notes on the cache", [CACHE[0].replace("nobody", "no one"), CACHE[1], CACHE[2]]));
  const run = site.post("scratch.txt");
  assert.ok(said(run).includes("Updated"), run.out);
  assert.match(run.out, /points at this post instead/);
  assert.doesNotMatch(run.out, /new post|delete/i);
  assert.equal(site.posts().length, 2);
  assert.match(site.at("notes-on-the-cache").body_md, /no one noticed/);
  assert.equal(site.at("notes-on-the-lock").body_md, LOCK.join("\n\n"));
});

test("the same title over a wholly different text is asked about, not replaced", () => {
  const site = newSite();
  site.write("w1.txt", text("Weeknotes", CACHE));
  site.write("w2.txt", text("Weeknotes", LOCK));
  site.post("w1.txt");
  const before = site.posts();
  const asked = site.post("w2.txt");
  assert.equal(asked.code, 1);
  assert.match(asked.out, /A post called "Weeknotes" already lives at/);
  assert.deepEqual(site.posts(), before);
  const rewritten = site.post("w2.txt", "--same-post");
  assert.ok(said(rewritten).includes("Updated"), rewritten.out);
  assert.equal(site.at("weeknotes").body_md, LOCK.join("\n\n"));
  assert.equal(site.at("weeknotes").published_at, before[0].published_at);
});

test("a different post aimed at a taken address is refused, and overwrite makes it a new post there", () => {
  const site = newSite();
  site.write("a.txt", text("Notes on the cache", CACHE, ["tags: go"]));
  site.write("b.txt", text("Notes on the lock", LOCK, ["slug: notes-on-the-cache", "draft: yes"]));
  site.post("a.txt");
  const refused = site.post("b.txt");
  assert.equal(refused.code, 1);
  assert.match(refused.out, /A different post, "Notes on the cache", already lives at/);
  assert.equal(site.at("notes-on-the-cache").title, "Notes on the cache");
  const over = site.post("b.txt", "--overwrite");
  assert.ok(said(over).includes("Replaced what was there, and saved as a draft"), over.out);
  const now = site.at("notes-on-the-cache");
  assert.equal(now.title, "Notes on the lock");
  assert.equal(now.published, false, "the file says draft, and an overwrite is a new post");
  assert.deepEqual(now.tags, [], "the old tags did not carry over");
  assert.equal(now.published_at, null, "nor the old date");
});

test("undoing an overwrite puts the old post back, and makes nothing live by itself", () => {
  const site = newSite();
  site.write("a.txt", text("Notes on the cache", CACHE, ["tags: go"]));
  site.write("b.txt", text("Notes on the lock", LOCK, ["slug: notes-on-the-cache", "draft: yes"]));
  site.post("a.txt");
  const was = site.at("notes-on-the-cache");
  site.post("b.txt", "--overwrite");
  const copy = site.kept().at(-1);
  assert.match(site.keptText(copy), /^kept: overwrite$/m);
  const back = site.post(copy);
  assert.ok(said(back).includes("Replaced what was there, and saved as a draft"), back.out);
  assert.match(back.out, /The copy was of a live post.*--publish/);
  const now = site.at("notes-on-the-cache");
  assert.equal(now.published, false, "what is there now is a draft, so the old post comes back as one");
  for (const f of ["title", "body_md", "excerpt", "tags", "published_at", "cover_url"]) assert.deepEqual(now[f], was[f], f);
  const out = site.post(site.kept().at(-2), "--publish");
  assert.equal(site.at("notes-on-the-cache").published, true, out.out);
});

test("an older copy of the same post, put back after a retitle, a rework and a take down, does not publish it", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt");
  // a rework that keeps a third of the post is asked about, and --same-post is the answer for one
  site.write("notes.txt", text("Notes on the cache", [CACHE[0], LOCK[1], LOCK[2]]));
  assert.equal(site.post("notes.txt").code, 1);
  assert.ok(said(site.post("notes.txt", "--same-post")).includes("Updated"));
  const first = site.kept()[0];
  assert.match(site.keptText(first), /^kept: update$/m);
  site.write("notes.txt", text("Why the cache never emptied", [CACHE[0], LOCK[1], LOCK[2]]));
  site.post("notes.txt");
  assert.ok(said(site.post("notes.txt", "--draft")).includes("Taken off the site, and a draft now"));
  const back = site.post(first);
  assert.ok(said(back).includes("Updated, still a draft"), back.out);
  assert.match(back.out, /though the copy was of a live post/);
  assert.deepEqual(live(site), []);
  assert.equal(site.at("notes-on-the-cache").body_md, CACHE.join("\n\n"));
});

test("a kept copy knows where it belongs: no other address, and no answer that is not about it", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt");
  site.write("notes.txt", text("Notes on the cache", [CACHE[0], CACHE[1]]));
  site.post("notes.txt");
  const before = site.posts();
  for (const flags of [["--same-post"], ["--separate"], ["--slug", "somewhere-else"]]) {
    const run = site.post(site.kept()[0], ...flags);
    assert.equal(run.code, 1);
    assert.match(run.out, /copy the command kept/);
    assert.equal(wrote(run).length, 0, "nothing was sent to be saved");
  }
  assert.equal(site.post(site.kept()[0], "--slug", "somewhere-else").sent.length, 0, "and another address is refused before the site is even asked");
  assert.deepEqual(site.posts(), before);
});

test("an older copy put back where another post now lives is asked about, and goes back as a draft", () => {
  // it used to write a draft's old text straight onto the live page of the post that had taken its address
  const site = newSite();
  site.write("a.txt", text("Notes on the cache", CACHE));
  site.post("a.txt", "--draft");
  site.write("a.txt", text("Notes on the cache", [...CACHE, "One more paragraph, added on a later day."]));
  site.post("a.txt");
  const older = site.kept()[0];
  assert.match(site.keptText(older), /^kept: update$/m);
  site.write("b.txt", text("Notes on the lock", LOCK, ["slug: notes-on-the-cache"]));
  assert.ok(said(site.post("b.txt", "--overwrite")).includes("Replaced what was there, and published"));
  const before = site.posts();
  const asked = site.post(older);
  assert.equal(asked.code, 1);
  assert.match(asked.out, /"Notes on the lock", a different post from the one this copy was taken of/);
  assert.equal(wrote(asked).length, 0);
  assert.deepEqual(site.posts(), before);
  const yes = site.post(older, "--overwrite");
  assert.ok(said(yes).includes("Replaced what was there, and saved as a draft"), yes.out);
  assert.equal(site.at("notes-on-the-cache").title, "Notes on the cache");
  assert.deepEqual(live(site), [], "the page was live, and the old draft did not go out on it");
});

test("the same text from another file under a new title is refused by the site, and both answers work", () => {
  const site = newSite();
  site.write("cache.txt", text("Notes on the cache", CACHE));
  site.post("cache.txt");
  site.write("elsewhere.txt", text("Why the cache never emptied", CACHE));
  const refused = site.post("elsewhere.txt");
  assert.equal(refused.code, 1);
  assert.match(refused.out, /Most of this text is already on the site, in "Notes on the cache"/);
  assert.match(refused.out, /add {2}--slug notes-on-the-cache --same-post/);
  assert.match(refused.out, /add {2}--separate/);
  assert.equal(site.posts().length, 1);
  const same = site.post("elsewhere.txt", "--slug", "notes-on-the-cache", "--same-post");
  assert.ok(said(same).includes("Updated"), same.out);
  assert.equal(site.posts().length, 1);
  assert.equal(site.posts()[0].title, "Why the cache never emptied");
  site.write("third.txt", text("The cache, once more", CACHE));
  const apart = site.post("third.txt", "--separate", "--draft");
  assert.ok(said(apart).includes("Saved as a draft"), apart.out);
  assert.equal(site.posts().length, 2);
});

test("--same-post never makes a post and --separate never changes one", () => {
  const site = newSite();
  site.write("new.txt", text("A brand new post", CACHE));
  const nothing = site.post("new.txt", "--same-post");
  assert.equal(nothing.code, 1);
  assert.match(nothing.out, /nothing is at/);
  assert.deepEqual(site.posts(), []);
  site.post("new.txt");
  const before = site.posts();
  const taken = site.post("new.txt", "--separate");
  assert.equal(taken.code, 1);
  assert.match(taken.out, /own title/);
  assert.deepEqual(site.posts(), before);
});

test("a row the old desk left with CR LF line endings is still recognised as itself", () => {
  const site = newSite();
  const wrapped = ["Someone asked me what I work on, and I said tracing,\nand they nodded in the way people nod when they have\ndecided not to ask a second question.", "It is three things: a way to describe what a program is\ndoing, a way to carry that from one program to the next,\nand a place to send it when the request is over."];
  site.put({ slug: "what-tracing-is", title: "What tracing is", body_md: wrapped.join("\n\n").replace(/\n/g, "\r\n"), excerpt: "By hand.", published: true, published_at: "2026-08-28T21:22:05.913Z" });
  site.write("notes.txt", text("What tracing is", wrapped));
  assert.match(site.post("notes.txt").out, /Nothing to change/);
  site.write("other.txt", text("Tracing, explained", wrapped));
  assert.match(site.post("other.txt").out, /Most of this text is already on the site/);
  site.write("notes.txt", text("What tracing actually is", wrapped));
  const retitled = site.post("notes.txt", "--slug", "what-tracing-is");
  assert.ok(said(retitled).includes("Updated"), retitled.out);
  assert.ok(said(retitled).includes("Changed: the title."), retitled.out);
  assert.doesNotMatch(retitled.out, /does not carry/);
  assert.equal(site.posts().length, 1);
});

test("the desk stores plain line endings, takes a path for a cover, and refuses what the site would", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt");
  const long = Array.from({ length: 82 }, (_, i) => `word${i}`).join(" ");
  assert.equal(site.desk({ slug: "notes-on-the-cache", cover_url: "/covers/cache.png", excerpt: long }).code, 0);
  const saved = site.at("notes-on-the-cache");
  assert.equal(saved.body_md.includes("\r"), false, "a browser sends CR LF, and the desk does not keep it");
  assert.equal(saved.cover_url, "/covers/cache.png");
  assert.match(site.post("notes.txt").out, /Nothing to change/);
  const bad = site.desk({ slug: "notes-on-the-cache", cover_url: "covers/cache.png" });
  assert.equal(bad.code, 3);
  assert.match(bad.out, /cover has to be an address/);
  // a change and its undo carry the cover and the long summary there and back
  site.post("notes.txt", "--summary", "A short one.");
  assert.equal(site.at("notes-on-the-cache").excerpt, "A short one.");
  site.post(site.kept().at(-1));
  assert.equal(site.at("notes-on-the-cache").excerpt, long);
  assert.equal(site.at("notes-on-the-cache").cover_url, "/covers/cache.png");
});

test("a draft made at the desk with a title and no text is simply filled in", () => {
  const site = newSite();
  assert.equal(site.desk({ title: "Notes on the cache" }).code, 0);
  site.write("notes.txt", text("Notes on the cache", CACHE));
  const run = site.post("notes.txt");
  assert.ok(said(run).includes("Updated, still a draft"), run.out);
  assert.match(run.out, /nothing to keep a copy of/);
  assert.deepEqual(site.kept(), []);
  assert.equal(site.posts().length, 1);
});

test("a title passed in does not turn a file's own draft line into text", () => {
  const site = newSite();
  site.write("half.txt", text("Half a thought about caches", CACHE, ["draft: yes", "tags: go"]));
  const run = site.post("half.txt", "--title", "Caches, half thought through");
  assert.equal(run.code, 1);
  assert.match(run.out, /draft: yes/);
  assert.equal(run.sent.length, 0);
  assert.deepEqual(site.posts(), []);
});

test("a date and a cover in the file are stored, and a day that does not exist is refused", () => {
  const site = newSite();
  site.write("dated.txt", text("A dated post", CACHE, ["date: 2026-01-15", "cover: https://example.com/c.png"]));
  const run = site.post("dated.txt", "--draft");
  assert.match(run.out, /dated 2026-01-15/);
  assert.equal(site.at("a-dated-post").published_at, "2026-01-15T00:00:00.000Z");
  assert.equal(site.at("a-dated-post").cover_url, "https://example.com/c.png");
  site.write("bad.txt", text("Another dated post", LOCK, ["date: 2026-02-30"]));
  const bad = site.post("bad.txt");
  assert.equal(bad.code, 1);
  assert.equal(bad.sent.length, 0);
  assert.equal(site.posts().length, 1);
});

test("a draft stays a draft and a live post stays live until a flag says otherwise", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt", "--draft");
  site.write("notes.txt", text("Notes on the cache", [...CACHE, "One more paragraph, added on a later day."]));
  assert.ok(said(site.post("notes.txt")).includes("Updated, still a draft"));
  assert.ok(said(site.post("notes.txt", "--publish")).includes("Updated, and now published"));
  site.write("notes.txt", text("Notes on the cache", CACHE, ["draft: yes"]));
  const left = site.post("notes.txt");
  assert.ok(said(left).includes("Updated"), left.out);
  assert.match(left.out, /stays live/);
  assert.deepEqual(live(site), ["notes-on-the-cache"]);
  assert.ok(said(site.post("notes.txt", "--draft")).includes("Taken off the site, and a draft now"));
});

test("the brake on wrong passwords is counted for each caller, so one cannot lock out another", async () => {
  const out = mkdtempSync(join(tmpdir(), "post-sim-auth-"));
  const code = build(out);
  const auth = await import(code.auth);
  rmSync(out, { recursive: true, force: true });
  const at = 1_000_000;
  for (let i = 0; i < 20; i++) auth.noteWrongGuess("198.51.100.1", at + i);
  assert.equal(auth.tooManyWrongGuesses("198.51.100.1", at + 100), true);
  assert.equal(auth.tooManyWrongGuesses("203.0.113.9", at + 100), false, "someone else is not shut out");
  assert.equal(auth.tooManyWrongGuesses("198.51.100.1", at + 61_000), false, "and it lifts after a minute");
  assert.equal(auth.callerOf(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(auth.callerOf(new Headers()), "unknown");
});

// ---- found by the fifth review ----

test("--same-post changes the post the question named, and leaves the one the file once made alone", () => {
  const site = newSite();
  site.write("weeknotes.txt", text("Weeknotes", LOCK));
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("weeknotes.txt");
  site.post("notes.txt");
  const cache = site.at("notes-on-the-cache");
  const fresh = ["A wholly new week, about nothing that was in either of the other two posts on this site so far.", "And a second paragraph of it, which is also new from the first word to the last one in it."];
  site.write("notes.txt", text("Weeknotes", fresh));
  const asked = site.post("notes.txt");
  assert.equal(asked.code, 1);
  assert.match(asked.out, /A post called "Weeknotes" already lives at .*\/blog\/weeknotes/);
  const run = site.post("notes.txt", "--same-post");
  assert.ok(said(run).includes("Updated"), run.out);
  assert.equal(site.at("weeknotes").body_md, fresh.join("\n\n"), "the post the question was about");
  assert.deepEqual(site.at("notes-on-the-cache"), cache, "and not the one this file made before");
  assert.equal(site.posts().filter((p) => p.title === "Weeknotes").length, 1);
});

test("another file with the same title and a shared sign off does not replace the post, and its undo keeps a draft a draft", () => {
  const closing = "That is all for this week. Thank you for reading, and see you next Monday, same time and place.";
  const site = newSite();
  site.write("week1.txt", text("Weeknotes", [...CACHE, closing], ["tags: private"]));
  site.post("week1.txt", "--draft");
  const week1 = site.at("weeknotes");
  site.write("week2.txt", text("Weeknotes", [...LOCK, closing]));
  const asked = site.post("week2.txt");
  assert.equal(asked.code, 1, asked.out);
  assert.match(asked.out, /partly the same as it and partly new/);
  assert.deepEqual(site.at("weeknotes"), week1);
  // told it is a different post, it is put there as one, and the old one is kept as the undo
  const over = site.post("week2.txt", "--overwrite");
  assert.ok(said(over).includes("Replaced what was there, and published"), over.out);
  assert.deepEqual(site.at("weeknotes").tags, []);
  // the undo: week one was only ever a draft, so it must not be left on a live page
  const back = site.post(site.kept().at(-1));
  assert.ok(said(back).includes("Replaced what was there, and saved as a draft"), back.out);
  assert.equal(site.at("weeknotes").published, false);
  assert.equal(site.at("weeknotes").body_md, [...CACHE, closing].join("\n\n"));
  assert.deepEqual(site.at("weeknotes").tags, ["private"]);
});

test("an edit that keeps most of a post is not asked about, and a rewrite that keeps little of it is", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt");
  // one paragraph of three replaced: most of the old text is still there
  site.write("notes.txt", text("Notes on the cache", [CACHE[0], CACHE[1], LOCK[2]]));
  assert.ok(said(site.post("notes.txt")).includes("Updated"));
  // two of three replaced, same file, same title: it could be the post rewritten, or next week's notes
  site.write("notes.txt", text("Notes on the cache", [CACHE[0], LOCK[0], LOCK[1]]));
  const before = site.posts();
  const asked = site.post("notes.txt");
  assert.equal(asked.code, 1, asked.out);
  assert.match(asked.out, /partly the same as it and partly new/);
  assert.deepEqual(site.posts(), before);
  // the answer for a rewrite is one flag, and the post keeps its date and stays out
  const run = site.post("notes.txt", "--same-post");
  assert.ok(said(run).includes("Updated"), run.out);
  assert.equal(site.posts().length, 1);
  assert.equal(site.posts()[0].published_at, before[0].published_at);
});

test("a correction that quotes half of a three paragraph post does not replace it", () => {
  const site = newSite();
  const long = `${CACHE[1]} ${LOCK[1]} ${LOCK[2]}`;
  site.write("notes.txt", text("Notes on the cache", [CACHE[0], long, CACHE[2]]));
  site.post("notes.txt");
  const before = site.posts();
  site.write("notes.txt", text("A correction to the cache numbers", ["Last month I wrote this:", long, "The first half of that was right and the second half was not."]));
  const run = site.post("notes.txt");
  assert.equal(run.code, 1, run.out);
  assert.match(run.out, /--same-post/);
  assert.deepEqual(site.posts(), before);
});

test("every way out the command offers is one that works when typed as printed", () => {
  const site = newSite();
  site.write("w1.txt", text("Weeknotes", CACHE));
  site.post("w1.txt");
  site.write("w2.txt", text("Weeknotes", LOCK));
  const asked = site.post("w2.txt");
  // the same words in the title: the site would refuse a second post under it at any address, so --slug is not offered
  assert.doesNotMatch(asked.out, /some-other-words/);
  assert.match(asked.out, /give it its own title/);
  assert.match(site.post("w2.txt", "--separate").out, /For a second post, give it its own title/);
  site.write("w2.txt", text("Weeknotes, the second week", LOCK));
  assert.ok(said(site.post("w2.txt")).includes("Published"));
  // an address given whole, the way the command prints it, is taken
  site.write("w3.txt", text("Weeknotes", [...CACHE, "One more line, added to the first week on a later day than the rest."]));
  const whole = site.post("w3.txt", "--slug", `${ORIGIN}/blog/weeknotes`);
  assert.ok(said(whole).includes("Updated"), whole.out);
  assert.equal(site.posts().length, 2);
});

test("settings under a blank line, and a title passed in over them, cannot send a draft out", () => {
  const site = newSite();
  site.write("under.txt", ["Notes on streams", "", "draft: yes", "slug: notes on streams", "", ...CACHE].join("\n"));
  const slip = site.post("under.txt");
  assert.equal(slip.code, 1);
  assert.equal(slip.sent.length, 0);
  site.write("half.txt", ["Half a thought about caches", "", "draft: yes", "tags: go", "", CACHE.join("\n\n"), ""].join("\n"));
  assert.match(site.post("half.txt", "--dry-run").out, /saved as a draft/);
  const titled = site.post("half.txt", "--title", "Caches, half thought through");
  assert.equal(titled.code, 1);
  assert.match(titled.out, /draft: yes/);
  assert.deepEqual(site.posts(), []);
  assert.ok(said(site.post("half.txt")).includes("Saved as a draft"));
});

test("a post with a broken character in it, typed at the desk, can still be changed and put back", () => {
  const site = newSite();
  const broken = `What I${String.fromCharCode(0xfffd)}d do differently next time, written at some length so it counts.`;
  site.put({ slug: "notes-on-the-cache", title: "Notes on the cache", body_md: [broken, CACHE[1], CACHE[2]].join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  site.write("notes.txt", text("Notes on the cache", CACHE));
  const run = site.post("notes.txt");
  assert.ok(said(run).includes("Updated"), run.out);
  const back = site.post(site.kept().at(-1));
  assert.ok(said(back).includes("Updated"), back.out);
  assert.equal(site.at("notes-on-the-cache").body_md.includes(broken), true);
});

test("a title the site would refuse is refused before a copy is kept, and a refusal after one says where it is", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt");
  site.write("notes.txt", text("N".repeat(201), CACHE));
  const run = site.post("notes.txt", "--slug", "notes-on-the-cache");
  assert.equal(run.code, 1);
  assert.match(run.out, /201 characters long/);
  assert.equal(run.sent.length, 0);
  assert.deepEqual(site.kept(), []);
});

test("an empty list of tags empties them, and a copy that cannot carry everything says so", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE, ["tags: go, caches"]));
  site.post("notes.txt");
  site.post("notes.txt", "--tags", "");
  assert.deepEqual(site.at("notes-on-the-cache").tags, []);
  // a row from before tags were tidied everywhere: ten of them, one twice, and a summary over two lines
  site.put({ ...site.at("notes-on-the-cache"), tags: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "a"], excerpt: "A summary\nover two lines." });
  site.write("notes.txt", text("Notes on the cache", [...CACHE, "One more paragraph, added on a later day."]));
  const run = site.post("notes.txt");
  assert.match(run.out, /does not carry the old tags and summary exactly/);
});

test("a change to the cover is undone with the rest", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE, ["cover: /covers/first.png"]));
  site.post("notes.txt");
  site.write("notes.txt", text("Notes on the cache", CACHE, ["cover: /covers/second.png"]));
  const run = site.post("notes.txt");
  assert.ok(said(run).includes("Changed: the cover."), run.out);
  site.post(site.kept().at(-1));
  assert.equal(site.at("notes-on-the-cache").cover_url, "/covers/first.png");
});

test("saving at the desk never moves a post, and tells the writer what is wrong instead of throwing", () => {
  const site = newSite();
  const title = "What I learned from three weeks of watching a cache that never emptied on every request";
  assert.equal(site.desk({ title, body_md: CACHE.join("\n\n"), published: true }).code, 0);
  const address = site.posts()[0].slug;
  assert.equal(address.endsWith("-"), false);
  assert.equal(site.desk({ slug: address }).code, 0);
  assert.equal(site.posts()[0].slug, address, "saved again with nothing changed, it is where it was");
  // an address typed at the old desk is kept as typed for as long as nobody retypes it
  site.put({ slug: "OTel_Notes.v2", title: "OTel notes", body_md: LOCK.join("\n\n"), published: true });
  assert.equal(site.desk({ slug: "OTel_Notes.v2", tags: "go, go, tracing" }).code, 0);
  assert.ok(site.at("OTel_Notes.v2"), "still at the address it was published at");
  assert.deepEqual(site.at("OTel_Notes.v2").tags, ["go", "tracing"], "and tags are tidied the way the site tidies them");
  // a taken address and a title with nothing to make one from come back as sentences
  const taken = site.desk({ title: "Another post", newslug: address, body_md: "Text." });
  assert.equal(taken.code, 3);
  assert.match(taken.out, /Another post already has the address/);
  const none = site.desk({ title: "!!!", body_md: "Text." });
  assert.equal(none.code, 3);
  assert.match(none.out, /no letters or numbers/);
  assert.equal(site.posts().length, 2);
});

test("the site says which way round a second copy is", () => {
  const site = newSite();
  site.write("short.txt", text("The three line fix", [CACHE[0], CACHE[1]]));
  site.post("short.txt");
  site.write("long.txt", text("Everything I learned about queues", [...LOCK, CACHE[0], CACHE[1], ...LOCK.map((p) => p.replace(/a/g, "o")), ...LOCK.map((p) => p.replace(/e/g, "i"))]));
  const run = site.post("long.txt");
  assert.equal(run.code, 1);
  assert.match(run.out, /Most of "The three line fix", the post at \/blog\/the-three-line-fix, is inside this text\./);
  assert.doesNotMatch(run.out, /Most of this text is already on the site/);
});

test("a request with no password is turned away without being counted as a wrong guess", async () => {
  const out = mkdtempSync(join(tmpdir(), "post-sim-guard-"));
  const state = join(out, "state.json");
  Object.assign(process.env, { SIM_STATE: state, ADMIN_PASSWORD: "sim-only-password", SESSION_SECRET: "sim-only-secret-used-nowhere-else" });
  const code = build(out);
  const route = await import(code.route);
  const { NextRequest } = createRequire(import.meta.url)("next/server");
  const ask = (headers) => route.GET(new NextRequest("http://site.invalid/api/posts?slug=x", { headers: { "x-forwarded-for": "198.51.100.7", ...headers } }));
  // thirty requests with nothing in them, the way a page full of image tags would send them
  for (let i = 0; i < 30; i++) assert.equal((await ask({})).status, 401);
  assert.equal((await ask({ authorization: "Basic dXNlcjpwdw==" })).status, 401);
  assert.equal((await ask({ authorization: "Bearer sim-only-password" })).status, 200, "the owner is not shut out by them");
  // real wrong guesses still are counted, for the caller who makes them
  for (let i = 0; i < 20; i++) assert.equal((await ask({ authorization: "Bearer nope" })).status, 401);
  assert.equal((await ask({ authorization: "Bearer sim-only-password" })).status, 429);
  assert.equal((await route.GET(new NextRequest("http://site.invalid/api/posts?slug=x", { headers: { "x-forwarded-for": "203.0.113.9", authorization: "Bearer sim-only-password" } }))).status, 200, "someone else is not");
  rmSync(out, { recursive: true, force: true });
});

test("a copy of a draft is not written onto a live page until it is told which way to go", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  site.post("notes.txt", "--draft");
  site.write("notes.txt", text("Notes on the cache", [...CACHE, "One more paragraph, added on a later day."]));
  site.post("notes.txt", "--publish");
  const draftEra = site.kept()[0];
  assert.match(site.keptText(draftEra), /^draft: yes$/m);
  const before = site.posts();
  const asked = site.post(draftEra);
  assert.equal(asked.code, 1);
  assert.match(asked.out, /This copy is of a draft, and what is at .* now is live/);
  assert.equal(wrote(asked).length, 0);
  assert.deepEqual(site.posts(), before);
  const out = site.post(draftEra, "--publish");
  assert.ok(said(out).includes("Updated"), out.out);
  assert.deepEqual(live(site), ["notes-on-the-cache"]);
  assert.equal(site.at("notes-on-the-cache").body_md, CACHE.join("\n\n"));
});

// ---- found by the sixth review ----

const QUEUE = [
  "A queue hides a problem for exactly as long as it takes to fill, and ours took eleven days, which was long enough for everyone to stop looking.",
  "By the time it was full the thing feeding it had been wrong for a week and a half, and every retry made the line behind it longer.",
  "What fixed it was not a bigger queue. It was refusing new work at the door while the old work was still being done.",
];
/** the way back a run printed, as the arguments to type: the kept copy, and any flags it said to add */
const wayBack = (run) => {
  const m = run.out.match(/To put it back: {2}\S+ "([^"]+)"((?: --[a-z-]+)*)\n/);
  assert.ok(m, `no way back was printed:\n${run.out}`);
  return [m[1], ...m[2].split(" ").filter(Boolean)];
};
/**
 * What a line of a refusal says to add, as arguments to type, so the test types it exactly as
 * printed. A line can offer two ways with ", or " between them, and `way` says which.
 */
const toAdd = (run, line, way = 0) => {
  const found = run.out.split("\n").find((l) => line.test(l));
  assert.ok(found, `no line like ${line} in:\n${run.out}`);
  return found.split(", or ")[way].match(/(?:add|address:) {2}((?:--slug \S+|--[a-z-]+)(?: (?:--slug \S+|--[a-z-]+))*)/)[1].split(" ");
};
const fields = (p) => ({ title: p.title, slug: p.slug, body_md: p.body_md, excerpt: p.excerpt, tags: p.tags, published: p.published, published_at: p.published_at, cover_url: p.cover_url });

test("a setting line the reader would never reach stops the command, and nothing goes out", () => {
  const site = newSite();
  const layouts = {
    "tags, a blank line, the draft line": ["Notes on the cache", "tags: go, caches", "", "draft: yes", "", ...CACHE],
    "the header of a markdown file, a blank line, the draft line": ["title: Notes on the cache", "format: markdown", "slug: notes-on-the-cache", "tags: go, caches", "", "draft: yes", "", CACHE.join("\n\n")],
    "a wrapped summary with the draft line under it": ["Notes on the cache", "summary: A long summary that an editor wrapped at a fixed width so that", "it carries on to a second line here.", "draft: yes", "", ...CACHE],
    // a summary that stands alone is read as a paragraph, and the block under it was not looked at
    "a blank line, a summary alone, a blank line, the draft line": ["Notes on the cache", "", "summary: What three weeks of a growing cache taught me.", "", "draft: yes", "", ...CACHE],
    "the same with the summary called an excerpt": ["Notes on the cache", "", "excerpt: What three weeks of a growing cache taught me.", "", "draft: yes", "", ...CACHE],
  };
  for (const [name, lines] of Object.entries(layouts)) {
    site.write("notes.txt", lines.join("\n"));
    const run = site.post("notes.txt");
    assert.equal(run.code, 1, `${name}:\n${run.out}`);
    assert.match(run.out, /would be published as text:\n\s+draft: yes\n/, name);
    assert.equal(run.sent.length, 0, `${name}: the site was not even asked`);
  }
  assert.deepEqual(site.posts(), [], "each of those used to be published, with draft: yes as its opening words");
  // with a title passed in, a file whose own title is underlined hid its draft line the same way
  site.write("half.txt", ["Half a thought about caches", "===========================", "draft: yes", "", ...LOCK].join("\n"));
  const titled = site.post("half.txt", "--title", "Caches, half thought through");
  assert.equal(titled.code, 1);
  assert.match(titled.out, /setting line of its own:\n\s+draft: yes/);
  assert.deepEqual(site.posts(), []);
  // and so did a summary that stands alone, with the draft line under a blank line under it
  site.write("apart.txt", ["Half a thought about caches", "", "summary: Not ready yet.", "", "tags: go, caches", "draft: yes", "", ...LOCK].join("\n"));
  for (const flags of [[], ["--title", "Caches, half thought through"]]) {
    const apart = site.post("apart.txt", ...flags);
    assert.equal(apart.code, 1, apart.out);
    assert.match(apart.out, /would be published as text[:,]/);
    assert.match(apart.out, /\n\s+tags: go, caches\n/, "the first of the two lines it would have published is shown");
    assert.equal(apart.sent.length, 0);
  }
  assert.deepEqual(site.posts(), []);
  // A file with no title line at all, its settings first. With a title passed in it is refused,
  // and the way out it is given is not to leave the title off: that would make draft: yes the title.
  site.write("bare.txt", ["draft: yes", "tags: go", "", ...QUEUE].join("\n"));
  const bare = site.post("bare.txt", "--title", "Notes on the queue");
  assert.equal(bare.code, 1);
  assert.match(bare.out, /setting line of its own:\n\s+draft: yes\n.*Take the setting lines out, or word them another way if they belong to the text\./);
  assert.doesNotMatch(bare.out, /Leave --title off/);
  // and with the title left off all the same, it is stopped, where it used to go out under the title "draft: yes"
  const untitled = site.post("bare.txt");
  assert.equal(untitled.code, 1, untitled.out);
  assert.match(untitled.out, /The first line of a file is its title, and this one looks like a setting:\n\s+draft: yes\n\s+Put the title on a line above it\./);
  assert.equal(untitled.sent.length, 0);
  assert.deepEqual(site.posts(), []);
  // put with the others as the error says, and written with a slip the rules allow for, the line is read
  site.write("notes.txt", ["Notes on the cache", "tags: go, caches", ' draft: "yes"', "", ...CACHE].join("\n"));
  assert.ok(said(site.post("notes.txt")).includes("Saved as a draft"));
  assert.deepEqual(live(site), []);
});

test("the way back that is printed puts things back as they were, whether or not the post was out", () => {
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE, ["tags: go"]));
  site.post("notes.txt", "--draft");
  const draft = fields(site.at("notes-on-the-cache"));
  // --publish with nothing else changed. the copy says draft, and put back with no flag it left the page live and said nothing.
  const out = site.post("notes.txt", "--publish");
  assert.ok(said(out).includes("Changed: whether it is out."), out.out);
  assert.deepEqual(wayBack(out).slice(1), ["--draft"]);
  const mute = site.post(wayBack(out)[0]);
  assert.match(mute.out, /Nothing to change/);
  assert.match(mute.out, /The copy was of a draft, but the post is live and stays live\. --draft takes it off the site\./);
  assert.equal(wrote(mute).length, 0);
  const back = site.post(...wayBack(out));
  assert.ok(said(back).includes("Taken off the site, and a draft now"), back.out);
  assert.deepEqual(fields(site.at("notes-on-the-cache")), { ...draft, published_at: site.at("notes-on-the-cache").published_at });
  assert.deepEqual(live(site), []);

  // the other way round, with an edit and new tags in the same run. the way back from the run above put it out again.
  site.post(...wayBack(back));
  const was = fields(site.at("notes-on-the-cache"));
  assert.equal(was.published, true);
  site.write("notes.txt", text("Notes on the cache", [...CACHE, "One more paragraph, added on a later day."], ["tags: go, caches"]));
  const down = site.post("notes.txt", "--draft");
  assert.ok(said(down).includes("Taken off the site, and a draft now"), down.out);
  assert.deepEqual(wayBack(down).slice(1), ["--publish"]);
  site.post(...wayBack(down));
  assert.deepEqual(fields(site.at("notes-on-the-cache")), was, "the text, the tags and the summary are back, and it is live again");
});

test("the way back says the one thing it cannot put back: a date on a post that had none", () => {
  // A draft that has never been out has no date. Going out gives it one, and the site keeps a
  // date once a post has one, so the copy, which has no date to give, leaves it there. Put
  // back as printed, the draft was dated the day of the slip, and nothing had said so.
  const stays = /\n {2}To put it back: [^\n]+\n {2}Putting it back does not take the date off again\. The post had none before this run, and the site keeps a date once a post has one\. A line like {2}date: 2026-08-28 {2}under the title sets another\.\n/;
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE, ["tags: go"]));
  site.post("notes.txt", "--draft");
  const draft = fields(site.at("notes-on-the-cache"));
  assert.equal(draft.published_at, null);
  // an edit that leaves it a draft gives it no date, so there is nothing to say
  site.write("notes.txt", text("Notes on the cache", [...CACHE, "One more paragraph, added on a later day."], ["tags: go"]));
  const edit = site.post("notes.txt");
  assert.ok(said(edit).includes("Updated, still a draft"), edit.out);
  assert.doesNotMatch(edit.out, /does not take the date off/);
  site.post(...wayBack(edit));
  assert.deepEqual(fields(site.at("notes-on-the-cache")), draft);

  const out = site.post("notes.txt", "--publish");
  assert.ok(said(out).includes("Updated, and now published"), out.out);
  assert.match(out.out, stays);
  const back = site.post(...wayBack(out));
  assert.ok(said(back).includes("Taken off the site, and a draft now"), back.out);
  const dated = site.at("notes-on-the-cache").published_at;
  assert.notEqual(dated, null, "the date is still there, which is what it said");
  assert.deepEqual(fields(site.at("notes-on-the-cache")), { ...draft, published_at: dated }, "and everything else is back");
  // by then the post had a date, so the run that took it down can be put back whole, and nothing is said
  assert.doesNotMatch(back.out, /does not take the date off/);
  // The way it gives to set another day works. The post has a date already, so nothing is said this time either.
  site.write("notes.txt", text("Notes on the cache", CACHE, ["tags: go", "date: 2026-08-28"]));
  const set = site.post("notes.txt");
  assert.ok(said(set).includes("Changed: the date."), set.out);
  assert.equal(site.at("notes-on-the-cache").published_at, "2026-08-28T00:00:00.000Z");
  assert.doesNotMatch(set.out, /does not take the date off/);

  // a date: line gives a draft a date as well, without sending it out, and that stays the same way
  const lined = newSite();
  lined.write("notes.txt", text("Notes on the cache", CACHE));
  lined.post("notes.txt", "--draft");
  lined.write("notes.txt", text("Notes on the cache", CACHE, ["date: 2026-08-28"]));
  const given = lined.post("notes.txt");
  assert.ok(said(given).includes("Updated, still a draft"), given.out);
  assert.match(given.out, stays);
  lined.post(...wayBack(given));
  assert.equal(lined.at("notes-on-the-cache").published_at, "2026-08-28T00:00:00.000Z");

  // With a title passed in, a file can hold no setting lines, so "under the title" would send
  // the writer to a line the command refuses. There it says where such a line can go.
  const titled = newSite();
  titled.write("body.txt", `${CACHE.join("\n\n")}\n`);
  titled.post("body.txt", "--title", "Notes on the cache", "--draft");
  const sent = titled.post("body.txt", "--title", "Notes on the cache", "--publish");
  assert.ok(said(sent).includes("Updated, and now published"), sent.out);
  assert.match(sent.out, /\n {2}Putting it back does not take the date off again\. The post had none before this run, and the site keeps a date once a post has one\. A line like {2}date: 2026-08-28 {2}sets another, but only under a title that is the first line of the file, since a file posted with --title can hold no setting lines\.\n/);
  assert.doesNotMatch(sent.out, /under the title sets another/);
  // which is so: beside --title the line is refused, and under a title of the file's own it is read
  titled.write("body.txt", `date: 2026-08-28\n\n${CACHE.join("\n\n")}\n`);
  const beside = titled.post("body.txt", "--title", "Notes on the cache");
  assert.equal(beside.code, 1);
  assert.match(beside.out, /setting line of its own:\n\s+date: 2026-08-28/);
  titled.write("body.txt", text("Notes on the cache", CACHE, ["date: 2026-08-28"]));
  const own = titled.post("body.txt");
  assert.ok(said(own).includes("Changed: the date."), own.out);
  assert.equal(titled.at("notes-on-the-cache").published_at, "2026-08-28T00:00:00.000Z");
  assert.equal(titled.posts().length, 1);

  // An overwrite starts the post clean, and so does the way back from one. There the date
  // does go, so nothing is said.
  const clean = newSite();
  clean.write("a.txt", text("Notes on the cache", CACHE));
  clean.post("a.txt", "--draft");
  const was = fields(clean.at("notes-on-the-cache"));
  clean.write("b.txt", text("Notes on the lock", LOCK, ["slug: notes-on-the-cache"]));
  const over = clean.post("b.txt", "--overwrite");
  assert.ok(said(over).includes("Replaced what was there, and published"), over.out);
  assert.notEqual(clean.at("notes-on-the-cache").published_at, null);
  assert.doesNotMatch(over.out, /does not take the date off/);
  clean.post(...wayBack(over));
  assert.deepEqual(fields(clean.at("notes-on-the-cache")), was, "back as it was, with no date");
  // the same where --same-post put the file onto another post altogether: that way back is an overwrite too
  const forced = clean.post("b.txt", "--same-post", "--publish");
  assert.ok(said(forced).includes("Updated, and now published"), forced.out);
  assert.deepEqual(wayBack(forced).slice(1), ["--overwrite", "--draft"]);
  assert.doesNotMatch(forced.out, /does not take the date off/);
  clean.post(...wayBack(forced));
  assert.deepEqual(fields(clean.at("notes-on-the-cache")), was);
});

test("the way back from --same-post onto a post that shares nothing with the file is printed with the flags it needs", () => {
  const site = newSite();
  site.write("a.txt", text("Notes on the cache", CACHE, ["tags: go"]));
  site.post("a.txt");
  const was = fields(site.at("notes-on-the-cache"));
  site.write("b.txt", text("Notes on the lock", LOCK));
  const forced = site.post("b.txt", "--slug", "notes-on-the-cache", "--same-post");
  assert.ok(said(forced).includes("Updated"), forced.out);
  // the copy is an older version of a post that now has another title and other text. put back bare, it is asked about.
  assert.deepEqual(wayBack(forced).slice(1), ["--overwrite", "--publish"]);
  const bare = site.post(wayBack(forced)[0]);
  assert.equal(bare.code, 1);
  assert.match(bare.out, /a different post from the one this copy was taken of/);
  const back = site.post(...wayBack(forced));
  assert.equal(back.code, 0, back.out);
  assert.deepEqual(fields(site.at("notes-on-the-cache")), was, "typed as printed, the post is back as it was, live and with its date");
});

test("the question about the post a file last made offers answers that work when typed as printed", () => {
  // the corrected title flow, then a rework: the post this file made carries the file's own title, at an address the title does not make
  const site = newSite();
  site.write("notes.txt", text("Teh cache that never emptied", CACHE));
  site.post("notes.txt");
  site.write("notes.txt", text("The cache that never emptied", CACHE));
  assert.ok(said(site.post("notes.txt")).includes("Updated"));
  site.write("notes.txt", text("The cache that never emptied", [CACHE[0], LOCK[1], LOCK[2]]));
  const before = site.posts();
  const asked = site.post("notes.txt");
  assert.equal(asked.code, 1);
  assert.match(asked.out, /This file last posted to .*\/blog\/teh-cache-that-never-emptied, which holds "The cache that never emptied"/);
  assert.match(asked.out, /If it is a new post, give it its own title and add {2}--separate/);
  // the bare flag is what it used to offer here, and the site turns it away, with a way out that fits --separate
  const refused = site.post("notes.txt", "--separate");
  assert.equal(refused.code, 1);
  assert.match(refused.out, /A post with this title already lives at \/blog\/teh-cache-that-never-emptied/);
  assert.match(refused.out, /For a second post, give it its own title/);
  assert.deepEqual(site.posts(), before);
  // as printed: its own title, and --separate
  site.write("notes.txt", text("The cache, a second look", [CACHE[0], LOCK[1], LOCK[2]]));
  const apart = site.post("notes.txt", ...toAdd(asked, /If it is a new post/));
  assert.ok(said(apart).includes("Published"), apart.out);
  assert.equal(site.posts().length, 2);
  assert.equal(site.at("teh-cache-that-never-emptied").body_md, CACHE.join("\n\n"), "and the post it was asked about is as it was");
});

test("--overwrite does not answer the question about the post a file last made, and the way it prints to the post at the address works", () => {
  const pair = () => {
    const site = newSite();
    site.write("a.txt", text("Notes on the cache", CACHE));
    site.write("q.txt", text("Notes on the queue", QUEUE));
    site.post("a.txt");
    site.post("q.txt");
    // a.txt takes the other post's title and keeps one of its own three paragraphs
    site.write("a.txt", text("Notes on the queue", [CACHE[0], LOCK[1], LOCK[2]]));
    return site;
  };
  const site = pair();
  const before = site.posts();
  const over = site.post("a.txt", "--overwrite");
  assert.equal(over.code, 1, "it still asks: the question is not about the post at the address");
  assert.match(over.out, /This file last posted to .*\/blog\/notes-on-the-cache, which holds "Notes on the cache"/);
  assert.match(over.out, /take --overwrite off and add {2}--same-post/);
  assert.match(over.out, /take --overwrite off, give it its own title and add {2}--separate/);
  assert.match(over.out, /--overwrite replaces what is at an address, and this question is about another post\. To replace "Notes on the queue" at .*\/blog\/notes-on-the-queue with this one, add {2}--slug notes-on-the-queue --overwrite/);
  assert.deepEqual(site.posts(), before, "nothing has changed so far");
  const there = site.post("a.txt", "--overwrite", ...toAdd(over, /--overwrite replaces what is at an address/));
  assert.ok(said(there).includes("Replaced what was there, and published"), there.out);
  assert.equal(site.at("notes-on-the-queue").body_md, [CACHE[0], LOCK[1], LOCK[2]].join("\n\n"));
  assert.equal(site.at("notes-on-the-cache").body_md, CACHE.join("\n\n"), "and the post the question was about is as it was");

  // with no flag the same question offers --same-post, and that goes to the post the question named
  const two = pair();
  const asked = two.post("a.txt");
  assert.match(asked.out, /If it is a new post, give it its own title and add {2}--separate/, "something sits at the address the title makes, so the bare flag would be refused");
  const same = two.post("a.txt", ...toAdd(asked, /If it is a new version of that post/));
  assert.ok(said(same).includes("Updated"), same.out);
  assert.equal(two.at("notes-on-the-cache").title, "Notes on the queue");
  assert.equal(two.at("notes-on-the-queue").body_md, QUEUE.join("\n\n"));
});

test("a different post at an address that holds most of its text goes beside it with the flags as printed", () => {
  const site = newSite();
  site.write("w1.txt", text("Weeknotes", [...CACHE, ...LOCK]));
  site.post("w1.txt");
  // another file, a title that makes the same address, and three of that post's six paragraphs with one of its own
  site.write("w2.txt", text("Weeknotes!", [...CACHE, QUEUE[0]]));
  const asked = site.post("w2.txt");
  assert.equal(asked.code, 1);
  assert.match(asked.out, /A post called "Weeknotes" already lives at/);
  assert.match(asked.out, /If it is a different post, give it its own title and add {2}--separate, or add {2}--slug some-other-words --separate/);
  // what it used to print, --slug alone, is refused by the site, which asks for --separate
  const alone = site.post("w2.txt", "--slug", "some-other-words");
  assert.equal(alone.code, 1);
  assert.match(alone.out, /Most of this text is already on the site, in "Weeknotes"/);
  assert.equal(site.posts().length, 1);
  // the second way it offers, as printed
  assert.deepEqual(toAdd(asked, /If it is a different post/, 1), ["--slug", "some-other-words", "--separate"]);
  const apart = site.post("w2.txt", ...toAdd(asked, /If it is a different post/, 1));
  assert.ok(said(apart).includes("Published"), apart.out);
  assert.ok(site.at("some-other-words"));
  assert.equal(site.at("weeknotes").body_md, [...CACHE, ...LOCK].join("\n\n"));
  // and the first: its own title, and --separate
  site.write("w3.txt", text("Weeknotes, cut down", [...CACHE, QUEUE[1]]));
  const titled = site.post("w3.txt", ...toAdd(asked, /If it is a different post/, 0));
  assert.ok(said(titled).includes("Published"), titled.out);
  assert.equal(site.posts().length, 3);
});

test("an address pasted with a hash or a question mark on the end is the address it was copied from", () => {
  const site = newSite();
  site.write("a.txt", text("Notes on the cache", CACHE));
  site.post("a.txt");
  site.write("b.txt", text("Notes on the lock", LOCK));
  const before = site.posts();
  // each of these once published a new post, at /blog/notes-on-the-cache-the-fix and the like. the plain address stops and asks, and so do they.
  for (const tail of ["#the-fix", "?utm_source=x", "#main"]) {
    const asked = site.post("b.txt", "--slug", `${ORIGIN}/blog/notes-on-the-cache${tail}`);
    assert.equal(asked.code, 1, `${tail}:\n${asked.out}`);
    assert.match(asked.out, /A different post, "Notes on the cache", already lives at/, tail);
    assert.deepEqual(site.posts(), before, tail);
  }
  const over = site.post("b.txt", "--slug", `${ORIGIN}/blog/notes-on-the-cache#the-fix`, "--overwrite", "--draft");
  assert.ok(said(over).includes("Replaced what was there, and saved as a draft"), over.out);
  assert.equal(site.posts().length, 1, "the post it was aimed at is the one replaced");
  assert.equal(site.at("notes-on-the-cache").title, "Notes on the lock");
});

test("a post at an address with a space in it can be reached with what the command prints", () => {
  const stored = { slug: "Go Notes", title: "Go notes", body_md: CACHE.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" };
  const corrected = text("Notes on Go, corrected", [CACHE[0].replace("nobody", "no one"), CACHE[1], CACHE[2]]);
  const site = newSite();
  site.put(stored);
  site.write("f.txt", corrected);
  const refused = site.post("f.txt");
  assert.equal(refused.code, 1);
  assert.match(refused.out, /Most of this text is already on the site, in "Go notes" at \/blog\/Go Notes\./);
  // it used to print --slug Go Notes, which is two words to a shell and is refused in quotes
  assert.deepEqual(toAdd(refused, /If this is a new version of that post/), ["--slug", "go-notes", "--same-post"]);
  const run = site.post("f.txt", ...toAdd(refused, /If this is a new version of that post/));
  assert.ok(said(run).includes("Updated"), run.out);
  assert.match(site.at("Go Notes").body_md, /no one noticed/);
  assert.equal(site.posts().length, 1);

  // With another post stored at exactly the tidied address, the tidied form would reach that
  // one. So the address is printed whole, the way a browser shows it, and that reaches the right post.
  const two = newSite();
  two.put(stored);
  two.put({ slug: "go-notes", title: "Go, in brief", body_md: LOCK.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  two.write("f.txt", corrected);
  const hint = toAdd(two.post("f.txt"), /If this is a new version of that post/);
  assert.deepEqual(hint, ["--slug", `${ORIGIN}/blog/Go%20Notes`, "--same-post"]);
  const exact = two.post("f.txt", ...hint);
  assert.ok(said(exact).includes("Updated"), exact.out);
  assert.match(two.at("Go Notes").body_md, /no one noticed/, "the post the site named is the one changed");
  assert.equal(two.at("go-notes").body_md, LOCK.join("\n\n"), "and not the one that only shares its tidied address");
  // the same address pasted as a browser shows it, with nothing printed to copy from
  two.write("g.txt", text("Notes on Go, corrected", [...CACHE, "One more paragraph, added on a later day."]));
  const pasted = two.post("g.txt", "--slug", `${ORIGIN}/blog/Go%20Notes?ref=home`);
  assert.ok(said(pasted).includes("Updated"), pasted.out);
  assert.match(two.at("Go Notes").body_md, /One more paragraph/);
  assert.equal(two.at("go-notes").body_md, LOCK.join("\n\n"));
});

test("a post at an address with a slash in it can be reached with what the command prints", () => {
  // No page can show such an address and nothing stores one any more. A row the old desk left
  // can still hold one, and what the command prints for it has to be something --slug takes.
  const site = newSite();
  site.put({ slug: "notes/2019", title: "Notes from 2019", body_md: CACHE.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  site.put({ slug: "notes-2019", title: "The year in brief", body_md: LOCK.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  site.write("f.txt", text("Notes from 2019, corrected", [CACHE[0].replace("nobody", "no one"), CACHE[1], CACHE[2]]));
  const refused = site.post("f.txt");
  assert.equal(refused.code, 1);
  assert.match(refused.out, /Most of this text is already on the site, in "Notes from 2019" at \/blog\/notes\/2019\./);
  // another post is stored at exactly the tidied address, so this one is printed whole, with its slash written as %2F
  const hint = toAdd(refused, /If this is a new version of that post/);
  assert.deepEqual(hint, ["--slug", `${ORIGIN}/blog/notes%2F2019`, "--same-post"]);
  const run = site.post("f.txt", ...hint);
  assert.ok(said(run).includes("Updated"), run.out);
  assert.match(site.at("notes/2019").body_md, /no one noticed/, "the post the site named is the one changed");
  assert.equal(site.at("notes-2019").body_md, LOCK.join("\n\n"), "and not the one that only shares its tidied address");
  assert.equal(site.posts().length, 2);
});

test("a post at an address a shell would not leave alone can be reached with what the command prints", () => {
  // Typed bare after --slug, Q&A is one command sent to the background and another called A.
  const stored = { slug: "Q&A", title: "Questions and answers", body_md: CACHE.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" };
  const corrected = text("Questions, answered", [CACHE[0].replace("nobody", "no one"), CACHE[1], CACHE[2]]);
  const site = newSite();
  site.put(stored);
  site.write("f.txt", corrected);
  const refused = site.post("f.txt");
  assert.equal(refused.code, 1);
  assert.match(refused.out, /Most of this text is already on the site, in "Questions and answers" at \/blog\/Q&A\./);
  // nothing else is stored at the tidied address, so the tidied address is what is printed
  assert.deepEqual(toAdd(refused, /If this is a new version of that post/), ["--slug", "q-a", "--same-post"]);
  const run = site.post("f.txt", ...toAdd(refused, /If this is a new version of that post/));
  assert.ok(said(run).includes("Updated"), run.out);
  assert.match(site.at("Q&A").body_md, /no one noticed/);
  assert.equal(site.posts().length, 1);

  // with another post stored at exactly the tidied address, it is printed whole, with the ampersand written as %26
  const two = newSite();
  two.put(stored);
  two.put({ slug: "q-a", title: "A short list", body_md: LOCK.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  two.write("f.txt", corrected);
  const hint = toAdd(two.post("f.txt"), /If this is a new version of that post/);
  assert.deepEqual(hint, ["--slug", `${ORIGIN}/blog/Q%26A`, "--same-post"]);
  const exact = two.post("f.txt", ...hint);
  assert.ok(said(exact).includes("Updated"), exact.out);
  assert.match(two.at("Q&A").body_md, /no one noticed/, "the post the site named is the one changed");
  assert.equal(two.at("q-a").body_md, LOCK.join("\n\n"), "and not the one that only shares its tidied address");
});

test("the site lets no second post in under a title that is already there, and each way out it is given works", () => {
  const site = newSite();
  site.write("w1.txt", text("Weeknotes", CACHE, ["slug: week-one"]));
  site.post("w1.txt");
  site.write("w2.txt", text("Weeknotes", LOCK));
  const refused = site.post("w2.txt");
  assert.equal(refused.code, 1);
  assert.match(refused.out, /A post with this title already lives at \/blog\/week-one\. Send it to that address to change it, or give this one a different title\./);
  assert.equal(site.posts().length, 1, "it used to be possible to break this rule with every test still passing");
  // --separate says it is a new post, so the way out is a title, and the address of the other one is not offered
  const apart = site.post("w2.txt", "--separate");
  assert.equal(apart.code, 1);
  assert.match(apart.out, /For a second post, give it its own title/);
  assert.doesNotMatch(apart.out, /--slug/);
  // --overwrite found nothing at the address the title makes
  const over = site.post("w2.txt", "--overwrite");
  assert.equal(over.code, 1);
  assert.match(over.out, /--overwrite replaces what is at an address, and nothing is at .*\/blog\/weeknotes\. To replace that post with this one, add {2}--slug week-one/);
  assert.equal(site.posts().length, 1);
  // with no answer given, the way to change that post is printed whole, and typed as printed it does
  assert.deepEqual(toAdd(refused, /To change that post from this file/), ["--slug", "week-one", "--same-post"]);
  const same = site.post("w2.txt", ...toAdd(refused, /To change that post from this file/));
  assert.ok(said(same).includes("Updated"), same.out);
  assert.equal(site.at("week-one").body_md, LOCK.join("\n\n"));
  assert.equal(site.posts().length, 1);

  // a kept copy of a post since deleted, going back beside a post that has its title
  const copy = wayBack(same)[0];
  site.remove("week-one");
  site.put({ slug: "week-three", title: "Weeknotes", body_md: QUEUE.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  const stopped = site.post(copy);
  assert.equal(stopped.code, 1);
  assert.match(stopped.out, /A post with this title already lives at \/blog\/week-three\./);
  assert.match(stopped.out, /A kept copy goes back to its own address, and this stops it\. Give that post another title at the desk, or change the title: line at the top of the copy, then run this again\./);
  assert.equal(site.posts().length, 1);
  // done as it says: the other post gets another title at the desk, and the copy goes back, as a draft
  assert.equal(site.desk({ slug: "week-three", title: "Weeknotes, the third week" }).code, 0);
  const back = site.post(copy);
  assert.ok(said(back).includes("Saved as a draft"), back.out);
  assert.equal(site.at("week-one").body_md, CACHE.join("\n\n"));
  // the other way it gives: the title: line at the top of the copy
  site.remove("week-one");
  assert.equal(site.desk({ slug: "week-three", title: "Weeknotes" }).code, 0);
  assert.equal(site.post(copy).code, 1, "the title is taken again, so it is stopped again");
  const path = join(site.work, copy);
  assert.match(readFileSync(path, "utf8"), /^title: Weeknotes\n/);
  writeFileSync(path, readFileSync(path, "utf8").replace(/^title: Weeknotes\n/, "title: Weeknotes, the first week\n"));
  const renamed = site.post(copy);
  assert.ok(said(renamed).includes("Saved as a draft"), renamed.out);
  assert.equal(site.at("week-one").title, "Weeknotes, the first week");
  assert.equal(site.at("week-three").title, "Weeknotes");
});

test("--overwrite with nothing at the address is stopped by the site as a second copy, and each way out printed then works", () => {
  const site = newSite();
  site.write("cache.txt", text("Notes on the cache", CACHE));
  site.post("cache.txt", "--draft");
  const first = site.at("notes-on-the-cache");
  site.write("again.txt", text("Why the cache never emptied", [...CACHE, "One more paragraph, added on a later day."]));
  const refused = site.post("again.txt", "--overwrite");
  assert.equal(refused.code, 1);
  // a draft counts: this is the same writing arriving twice, whether or not the first is out yet
  assert.match(refused.out, /Most of this text is already on the site, in "Notes on the cache" at \/blog\/notes-on-the-cache, a draft\./);
  assert.match(refused.out, /--overwrite replaces what is at an address, and nothing is at .*\/blog\/why-the-cache-never-emptied\. To replace that post with this one, add {2}--slug notes-on-the-cache/);
  // the two other answers cannot stand beside --overwrite on one line, so each says to take it off
  assert.match(refused.out, /If this is a new version of that post, take --overwrite off and add {2}--slug notes-on-the-cache --same-post/);
  assert.match(refused.out, /If it is a new post, take --overwrite off and add {2}--separate/);
  assert.equal(site.posts().length, 1);
  // each of the three, typed as printed, from the same starting point
  const there = site.post("again.txt", "--overwrite", ...toAdd(refused, /--overwrite replaces what is at an address/));
  assert.equal(there.code, 0, there.out);
  assert.equal(site.at("notes-on-the-cache").title, "Why the cache never emptied");
  site.put(first);
  const same = site.post("again.txt", ...toAdd(refused, /If this is a new version of that post/));
  assert.ok(said(same).includes("Updated, still a draft"), same.out);
  site.put(first);
  const apart = site.post("again.txt", ...toAdd(refused, /If it is a new post/));
  assert.ok(said(apart).includes("Published"), apart.out);
  assert.equal(site.posts().length, 2);
  assert.equal(site.at("notes-on-the-cache").title, "Notes on the cache");
});

test("a title that only tidies to a stored address finds the post there, and a copy put back in place restores the tags", () => {
  const site = newSite();
  // typed at the old desk, and kept as typed. the address the title makes is otel-notes-v2.
  site.put({ slug: "OTel_Notes.v2", title: "OTel notes", body_md: LOCK.join("\n\n"), tags: ["go", "tracing"], published: true, published_at: "2026-08-28T21:22:05.913Z" });
  site.write("otel.txt", text("OTel notes v2", [...LOCK, "One more paragraph, added on a later day."], ["tags: go"]));
  const run = site.post("otel.txt");
  assert.ok(said(run).includes("Updated"), run.out);
  assert.equal(site.posts().length, 1, "it is that post that was changed, and no second one was made");
  assert.equal(site.at("OTel_Notes.v2").title, "OTel notes v2");
  assert.deepEqual(site.at("OTel_Notes.v2").tags, ["go"]);
  // the copy goes back in place, and what it puts back includes the tags it was kept with
  const back = site.post(...wayBack(run));
  assert.ok(said(back).some((l) => /^Changed: .*the tags/.test(l)), back.out);
  assert.deepEqual(site.at("OTel_Notes.v2").tags, ["go", "tracing"]);
  assert.equal(site.at("OTel_Notes.v2").title, "OTel notes");
  assert.equal(site.at("OTel_Notes.v2").body_md, LOCK.join("\n\n"));
});

test("what a dry run says is what the real run then does", () => {
  const rulesOf = (run) => run.out.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("|")).join(" ");
  // --same-post with nothing there: it said "if nothing is there, it is a new post", which the real run refuses
  const site = newSite();
  site.write("notes.txt", text("Notes on the cache", CACHE));
  const same = rulesOf(site.post("notes.txt", "--dry-run", "--same-post"));
  assert.doesNotMatch(same, /it is a new post/);
  assert.match(same, /never makes a new one\..*If nothing is there, the command stops\./);
  // --separate: it said the same post would be changed where it is
  const apart = rulesOf(site.post("notes.txt", "--dry-run", "--separate"));
  assert.doesNotMatch(apart, /changed where it is/);
  assert.match(apart, /If a post is already at that address, the command stops/);
  // a title with nothing to make an address from, in a file that last posted somewhere
  site.post("notes.txt");
  site.write("notes.txt", text("!!!", LOCK));
  const bare = rulesOf(site.post("notes.txt", "--dry-run"));
  assert.match(bare, /The title makes no address, so it can only go to the post this file last posted to, \/blog\/notes-on-the-cache\./);
  assert.doesNotMatch(bare, /it is a new post/);
  assert.match(bare, /the command stops as well: a new post needs an address\. Pass --slug with one\./);
  const real = site.post("notes.txt");
  assert.equal(real.code, 1);
  assert.match(real.out, /no letters or numbers to make an address from/);
  assert.equal(site.posts().length, 1);

  // three posts through one address, and the copy kept of the first: it said it would stop and ask, and it never does
  const three = newSite();
  three.write("a.txt", text("Notes on the cache", CACHE));
  three.write("b.txt", text("Notes on the lock", LOCK, ["slug: notes-on-the-cache"]));
  three.write("c.txt", text("Notes on the queue", QUEUE, ["slug: notes-on-the-cache"]));
  three.post("a.txt");
  const cacheCopy = wayBack(three.post("b.txt", "--overwrite"))[0];
  three.post("c.txt", "--overwrite");
  const undo = rulesOf(three.post(cacheCopy, "--dry-run"));
  assert.match(undo, /it takes the place of whatever is at that address now, without asking\. It goes back live if the page there is live now/);
  assert.doesNotMatch(undo, /stops and asks/);
  const back = three.post(cacheCopy);
  assert.ok(said(back).includes("Replaced what was there, and published"), back.out);
  assert.equal(three.at("notes-on-the-cache").title, "Notes on the cache");

  // A post typed at the old desk, stored as Go Notes. The title of the file makes go-notes, and
  // the site finds the stored post for that. It said only "It would go to .../blog/go-notes."
  const old = newSite();
  old.put({ slug: "Go Notes", title: "Go notes", body_md: CACHE.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  old.write("go.txt", text("Go notes", [...CACHE, "One more paragraph, added on a later day."]));
  const dry = rulesOf(old.post("go.txt", "--dry-run"));
  assert.ok(dry.includes(`It would go to ${ORIGIN}/blog/go-notes, or to a post the site already holds under another spelling of that address, which keeps the spelling it has.`), dry);
  const went = old.post("go.txt");
  assert.ok(said(went).includes("Updated"), went.out);
  assert.ok(said(went).includes(`${ORIGIN}/blog/Go Notes`), "the post under the other spelling is the one it went to");
  assert.deepEqual(old.posts().map((p) => p.slug), ["Go Notes"], "and it kept its spelling: nothing new was made at go-notes");
  assert.match(old.at("Go Notes").body_md, /One more paragraph/);
  // with --separate nothing that is already there is gone to, so only the one address is named, and the real run stops
  const alone = rulesOf(old.post("go.txt", "--dry-run", "--separate"));
  assert.ok(alone.includes(`It would go to ${ORIGIN}/blog/go-notes. With --separate`), alone);
  assert.doesNotMatch(alone, /another spelling/);
  const stopped = old.post("go.txt", "--separate");
  assert.equal(stopped.code, 1);
  assert.match(stopped.out, /--separate puts this beside what is already on the site, and "Go notes" already lives at .*\/blog\/Go Notes\./);
  assert.equal(old.posts().length, 1);
});

test("a very short post is asked about after a typo is fixed, and the command says what the answer is before it happens", () => {
  const site = newSite();
  const sixteen = "The cache was never cleared, and for three weeks nobody noticed taht it kept growing.";
  site.write("notes.txt", text("The cache that never emptied", [sixteen]));
  const first = site.post("notes.txt");
  assert.match(first.out, /Only 15 words\. Is this the whole post\?/);
  // it used to end "run this again to update the post", which is not what happens next
  assert.doesNotMatch(first.out, /to update the post/);
  assert.match(first.out, /Posted with the warning above\. To change the post, fix the file and run this again\.\n {2}If the command then asks whether it is the same post, which it does when the text of a very short post has changed, the answer is {2}--same-post\n/);
  site.write("notes.txt", text("The cache that never emptied", [sixteen.replace("taht", "that")]));
  const again = site.post("notes.txt");
  assert.equal(again.code, 1, "it asks, as it said it would");
  assert.match(again.out, /If this is that post rewritten, add {2}--same-post/);
  const fixed = site.post("notes.txt", "--same-post");
  assert.ok(said(fixed).includes("Updated"), fixed.out);
  // a title put right over the same few words is not a change to the text, and is not asked about
  site.write("notes.txt", text("The cache that never emptied, at last", [sixteen.replace("taht", "that")]));
  assert.ok(said(site.post("notes.txt")).includes("Updated"));
  assert.equal(site.posts().length, 1);
  // a kept copy goes back as it was kept, so nothing is said about fixing it
  const back = site.post(...wayBack(fixed));
  assert.match(back.out, /Posted with the warning above\.\n/);
  assert.doesNotMatch(back.out, /fix the file|--same-post/);
  // after --separate, the same command again would be refused, so it says to leave the flag off, and that works
  site.write("other.txt", text("A short aside", ["Shipped the fix on a Tuesday."]));
  assert.match(site.post("other.txt", "--separate").out, /fix the file and run this again without --separate\./);
  site.write("other.txt", text("A short aside", ["Shipped the fix on a Tuesday, in the end."]));
  assert.equal(site.post("other.txt", "--same-post").code, 0);
  assert.equal(site.posts().length, 2);
});

test("a site made in a temp folder that is reached through a link is spelt the way the command spells it", () => {
  // The command reads where it stands as a real path. A site that spelt its folders through
  // the link had the command remember a file under one spelling while scripts/sim/fuzz.mjs
  // looked for it under the other, and a true sentence was reported as false. The temp folder
  // on a Mac is a link of this kind.
  const real = mkdtempSync(join(tmpdir(), "post-sim-real-"));
  const link = `${real}-link`;
  symlinkSync(real, link);
  // both go when the process ends, after the site inside them has been swept
  process.on("exit", () => { rmSync(link, { force: true }); rmSync(real, { recursive: true, force: true }); });
  const usual = process.env.TMPDIR;
  process.env.TMPDIR = link;
  let site;
  try {
    site = newSite();
  } finally {
    if (usual === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = usual;
  }
  assert.equal(site.dir, realpathSync(site.dir), "no link is left in the spelling of its folder");
  assert.ok(site.dir.startsWith(realpathSync(real)), "and it was made where it was asked to be");
  site.write("notes.txt", text("Notes on the cache", CACHE));
  assert.ok(said(site.post("notes.txt")).includes("Published"));
  // the command's own note of where each file last posted to, which the random tester reads by this spelling
  const posted = JSON.parse(readFileSync(join(site.keep, "posted.json"), "utf8"));
  assert.deepEqual(Object.keys(posted), [join(site.work, "notes.txt")]);
});

// ---- found when the fixes for the sixth review were checked a second time ----

test("a draft line under an indent that the reader takes off stops the command, and nothing goes out", () => {
  // Every paragraph indented is a file typed like a letter, and its indents come off. So a
  // draft line indented like the rest is not code, and it used to open the post.
  const site = newSite();
  const indented = (indent, paragraphs) => paragraphs.map((p) => `${indent}${p}`).join("\n\n");
  const layouts = {
    "the title at the margin, the rest indented by four spaces": ["Notes on the cache", "    draft: yes", "", indented("    ", CACHE)],
    "the whole file indented by a tab, title and all": ["\tNotes on the cache", "\tdraft: yes", "", indented("\t", CACHE)],
    "the draft line under a blank line": ["Notes on the cache", "", "    draft: yes", "", indented("    ", CACHE)],
    "tags and the draft line, both indented": ["Notes on the cache", "    tags: go, caches", "    draft: yes", "", indented("    ", CACHE)],
  };
  for (const [name, lines] of Object.entries(layouts)) {
    site.write("notes.txt", `${lines.join("\n")}\n`);
    const run = site.post("notes.txt");
    assert.equal(run.code, 1, `${name}:\n${run.out}`);
    assert.match(run.out, /every paragraph in this file is indented and loses its indent, so it would be published as text:\n\s+(draft: yes|tags: go, caches)\n/, name);
    assert.equal(run.sent.length, 0, `${name}: the site was not even asked`);
  }
  assert.deepEqual(site.posts(), [], "each of those used to be published, with draft: yes among its opening words");
  // The other indent that comes off: on the first line of a paragraph, when no other line of
  // it is indented. A draft line indented like that, with the text straight under it, went out too.
  site.write("notes.txt", `${["Notes on the cache", "    draft: yes", CACHE[0], "", CACHE[1], "", CACHE[2]].join("\n")}\n`);
  const book = site.post("notes.txt");
  assert.equal(book.code, 1, book.out);
  assert.match(book.out, /an indent on only the first line of a paragraph is not code and comes off, so it would be published as text:\n\s+draft: yes\n/);
  assert.equal(book.sent.length, 0);
  assert.deepEqual(site.posts(), []);
  // with a title passed in, a file with no title line of its own went out the same way
  site.write("bare.txt", `${["    draft: yes", "", indented("    ", LOCK)].join("\n")}\n`);
  const titled = site.post("bare.txt", "--title", "Notes on the lock");
  assert.equal(titled.code, 1, titled.out);
  assert.match(titled.out, /setting line of its own:\n\s+draft: yes\n.*Take the setting lines out, or word them another way if they belong to the text\./);
  assert.equal(titled.sent.length, 0);
  assert.deepEqual(site.posts(), []);
  // written straight under the title with no indent, as the error says, the line is read, and the letter loses its indents
  site.write("notes.txt", `${["Notes on the cache", "draft: yes", "", indented("    ", CACHE)].join("\n")}\n`);
  assert.ok(said(site.post("notes.txt")).includes("Saved as a draft"));
  assert.deepEqual(live(site), []);
  assert.equal(site.at("notes-on-the-cache").body_md, CACHE.join("\n\n"));
});

test("a file with no title line, a summary first and tags under it, stops the command instead of going out under the summary as its title", () => {
  const site = newSite();
  const top = ["summary: What a week and a half of a full queue taught me.", "tags: go, queues"];
  site.write("notes.txt", `${[...top, "", QUEUE.join("\n\n")].join("\n")}\n`);
  const run = site.post("notes.txt");
  assert.equal(run.code, 1, run.out);
  assert.match(run.out, /The first line of a file is its title, and this one looks like a setting:\n\s+summary: What a week and a half of a full queue taught me\.\n\s+Put the title on a line above it\./);
  assert.equal(run.sent.length, 0, "the site was not even asked");
  assert.deepEqual(site.posts(), []);
  // with the title on a line above it, as it says, both lines are the settings they were meant as
  site.write("notes.txt", `${["Notes on the queue", ...top, "", QUEUE.join("\n\n")].join("\n")}\n`);
  assert.ok(said(site.post("notes.txt")).includes("Published"));
  const p = site.at("notes-on-the-queue");
  assert.equal(p.excerpt, "What a week and a half of a full queue taught me.");
  assert.deepEqual(p.tags, ["go", "queues"]);
  assert.equal(p.body_md, QUEUE.join("\n\n"));
  assert.equal(site.posts().length, 1);
});

test("a refusal is read for the ways out it offers, and a sentence that only says where a kept copy goes offers none", () => {
  // The random tester answers a refusal with what it reads off it. It once read "its own
  // address", in a sentence about where a kept copy goes, as the offer of an address, typed
  // --slug after the copy, and called the refusal that followed a fault of the command.
  const site = newSite();
  site.write("w1.txt", text("Weeknotes", CACHE, ["slug: week-one"]));
  site.post("w1.txt");
  site.write("w1.txt", text("Weeknotes", [...CACHE, "One more paragraph, added at the end on a later day."], ["slug: week-one"]));
  const copy = wayBack(site.post("w1.txt"))[0];
  site.remove("week-one");
  site.put({ slug: "week-three", title: "Weeknotes", body_md: QUEUE.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  // a kept copy of a post that is gone, going back while another post carries its title
  const stopped = site.post(copy);
  assert.equal(stopped.code, 1);
  assert.match(stopped.out, /A kept copy goes back to its own address, and this stops it\. Give that post another title at the desk, or change the title: line at the top of the copy, then run this again\./);
  assert.deepEqual(waysOut(refusalOf(stopped.out)), [], "neither way out it gives is a flag, or a title or an address for the copy");
  // --slug after a copy is refused before anything else is printed, so that refusal stands alone
  const slugged = site.post(copy, "--slug", "an-address-of-its-own");
  assert.equal(slugged.code, 1);
  assert.deepEqual(refusalOf(slugged.out), ["This file is a copy the command kept, and it goes back to its own address. --slug does not go with it."]);
  assert.deepEqual(waysOut(refusalOf(slugged.out)), [], "its one line is what was refused, and offers nothing");
  assert.equal(site.posts().length, 1);

  // what is offered is still read: a title and an address of its own, with no flag
  site.write("w3.txt", text("Weeknotes", LOCK, ["slug: week-three"]));
  const apart = site.post("w3.txt", "--separate");
  assert.equal(apart.code, 1);
  assert.deepEqual(waysOut(refusalOf(apart.out)), [{ said: "For a second post, give it its own title and its own address", flags: [], dropOverwrite: false, ownTitle: true, ownAddress: true }]);
  // and a question with every kind of answer in it: a flag, a title and a flag, an address and a flag
  site.write("w4.txt", text("Weeknotes", [QUEUE[0], LOCK[1], LOCK[2]]));
  site.remove("week-three");
  site.put({ slug: "weeknotes", title: "Weeknotes!", body_md: QUEUE.join("\n\n"), published: true, published_at: "2026-08-28T21:22:05.913Z" });
  const asked = site.post("w4.txt");
  assert.equal(asked.code, 1);
  assert.deepEqual(waysOut(refusalOf(asked.out)).map((w) => [w.flags.join(" "), w.ownTitle, w.ownAddress]), [
    ["--same-post", false, false],
    ["--separate", true, false],
    ["--slug some-other-words --separate", false, false],
    ["--overwrite", false, false],
  ], asked.out);
});
