// npm test
// What the command decides before it sends anything: how it reads its flags, and what it
// will and will not change on the site. Every case here is a way a post was once nearly lost
// or nearly published by accident.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readArgs, plan, relate, dryRun } from "./post-plan.mjs";
import { textToPost, keptCopy, autoSummary, likeness } from "./post-text.mjs";

const long = (seed) => Array.from({ length: 30 }, (_, i) => `${seed}${i}`).join(" ") + ".";
const SITE = "https://example.test";

/** a post as the site hands it back */
const onSite = (over = {}) => {
  const body_md = over.body_md ?? `${long("alpha")}\n\n${long("gamma")}\n\n${long("omega")}`;
  return {
    slug: "a-post", title: "A post", body_md, excerpt: autoSummary(body_md), tags: ["go"],
    published: true, published_at: "2026-08-28T21:22:05.913Z", cover_url: null, ...over,
  };
};
const file = (text, opts) => textToPost(text, opts);
const decide = (over) => plan({ site: SITE, atTarget: null, made: null, ...over });
const body3 = `${long("alpha")}\n\n${long("gamma")}\n\n${long("omega")}`;
const other2 = `${long("delta")}\n\n${long("kappa")}`;

// ---- reading the flags ----

test("a file name and a switch", () => {
  assert.deepEqual(readArgs(["notes.txt", "--draft"]), { files: ["notes.txt"], draft: true });
  assert.deepEqual(readArgs(["notes.txt", "--dry-run"]), { files: ["notes.txt"], "dry-run": true });
});

test("a value can follow its flag or sit behind an equals sign", () => {
  assert.equal(readArgs(["f.txt", "--tags", "go, otel"]).tags, "go, otel");
  assert.equal(readArgs(["f.txt", "--title=A better title"]).title, "A better title");
  assert.equal(readArgs(["f.txt", "--title=--force is a lie"]).title, "--force is a lie");
  assert.equal(readArgs(["f.txt", "--title=a = b"]).title, "a = b");
});

test("a flag that lost its value does not swallow the next flag", () => {
  // this one would have published a post tagged --dry-run
  assert.throws(() => readArgs(["f.txt", "--tags", "--dry-run"]), /--tags needs something after it/);
  assert.throws(() => readArgs(["f.txt", "--tags"]), /--tags needs something after it/);
  assert.throws(() => readArgs(["f.txt", "--title", ""]), /--title needs something after it/);
  assert.throws(() => readArgs(["f.txt", "--slug="]), /--slug needs something after it/);
});

test("an empty list of tags is a real answer, and clears them", () => {
  assert.equal(readArgs(["f.txt", "--tags", ""]).tags, "");
});

test("a switch given a value is refused, not quietly switched on", () => {
  assert.throws(() => readArgs(["f.txt", "--draft=false"]), /--draft takes nothing after it/);
  assert.throws(() => readArgs(["f.txt", "--dry-run=no"]), /--dry-run takes nothing after it/);
});

test("a flag that does not exist stops the command", () => {
  assert.throws(() => readArgs(["f.txt", "--darft"]), /There is no --darft/);
  assert.throws(() => readArgs(["f.txt", "--replace"]), /--overwrite/);
  assert.throws(() => readArgs(["f.txt", "--local"]), /--localhost/);
  assert.throws(() => readArgs(["f.txt", "-d"]), /two dashes/);
});

test("a double dash typed out of habit from the npm form is ignored", () => {
  assert.deepEqual(readArgs(["f.txt", "--", "--draft"]), { files: ["f.txt"], draft: true });
});

test("help has a short form", () => {
  assert.equal(readArgs(["-h"]).help, true);
});

test("flags npm kept for itself are read back from what it leaves behind", () => {
  assert.equal(readArgs(["f.txt"], { npm_config_draft: "true" }).draft, true);
  assert.equal(readArgs(["f.txt"], { npm_config_dry_run: "true" })["dry-run"], true);
  assert.equal(readArgs(["f.txt"], { npm_config_tags: "go, otel" }).tags, "go, otel");
  // what was typed after the double dash wins over what npm kept
  assert.equal(readArgs(["f.txt", "--tags", "typed"], { npm_config_tags: "kept" }).tags, "typed");
  assert.equal(readArgs(["f.txt"], { npm_config_draft: "" }).draft, undefined);
});

test("a value npm lost on the way stops the command", () => {
  assert.throws(() => readArgs(["f.txt"], { npm_config_tags: "true" }), /npm kept --tags/);
  assert.throws(() => readArgs(["f.txt"], { npm_config_replace_registry_host: "true" }), /--overwrite/);
  assert.throws(() => readArgs(["f.txt"], { npm_config_replace_registry_host: "--dry-run" }), /--overwrite/);
  assert.doesNotThrow(() => readArgs(["f.txt"], { npm_config_replace_registry_host: "npmjs" }));
});

test("the three answers to a question the command asks are flags, and they exclude each other", () => {
  assert.equal(readArgs(["f.txt", "--same-post"])["same-post"], true);
  assert.equal(readArgs(["f.txt"], { npm_config_same_post: "true" })["same-post"], true);
  assert.throws(() => readArgs(["f.txt", "--same-post", "--separate"]), /cannot both be right/);
  assert.throws(() => readArgs(["f.txt", "--same-post", "--overwrite"]), /cannot both be right/);
  assert.throws(() => readArgs(["f.txt", "--separate", "--overwrite"]), /cannot both be right/);
  assert.throws(() => readArgs(["f.txt", "--draft", "--publish"]), /cannot both be right/);
});

// ---- a post that is not on the site yet ----

test("a new post goes out unless the file or a flag says draft", () => {
  const p = file("A post\n\nBody text that is long enough to be a sentence.\n");
  assert.equal(decide({ post: p }).send.published, true);
  assert.equal(decide({ post: p, published: false }).send.published, false);
  const d = file("A post\ndraft: yes\n\nBody text that is long enough to be a sentence.\n");
  assert.equal(decide({ post: d }).send.published, false);
  assert.equal(decide({ post: d, published: true }).send.published, true, "--publish wins over the file");
});

test("a new post sends its summary, and tags only when some were given", () => {
  const p = file("A post\n\nBody text that is long enough to be a sentence.\n");
  const { send, keep, existing } = decide({ post: p });
  assert.equal(send.slug, "a-post");
  assert.equal(send.excerpt, "Body text that is long enough to be a sentence.");
  assert.equal("tags" in send, false);
  assert.equal(keep, false);
  assert.equal(existing, null);
  assert.deepEqual(decide({ post: file("A post\ntags: go\n\nBody.\n") }).send.tags, ["go"]);
});

test("a date and a cover written in the file are sent, and nothing is sent when they are not", () => {
  const p = file("A post\ndate: 2026-08-28\ncover: https://example.com/a.png\n\nBody text.\n");
  const { send } = decide({ post: p });
  assert.equal(send.published_at, "2026-08-28");
  assert.equal(send.cover_url, "https://example.com/a.png");
  const bare = decide({ post: file("A post\n\nBody text.\n") }).send;
  assert.equal("published_at" in bare, false);
  assert.equal("cover_url" in bare, false);
});

// ---- the same post, sent again ----

test("the same file again changes nothing and says so", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`A post\ntags: go\n\n${atTarget.body_md}\n`), atTarget });
  assert.equal(r.same, true);
});

test("line endings alone are not a change", () => {
  // the desk stores what a browser sends, which is CR LF
  const atTarget = onSite({ body_md: body3.replace(/\n/g, "\r\n") });
  atTarget.excerpt = "By hand.";
  const r = decide({ post: file(`A post\n\n${body3}\n`), atTarget });
  assert.equal(r.same, true);
});

test("an edit updates the text, keeps a copy, and leaves a live post live", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`A post\n\n${atTarget.body_md.replace("alpha0", "alpha zero")}\n`), atTarget });
  assert.equal(r.refuse, undefined);
  assert.equal("published" in r.send, false, "whether it is out is not touched");
  assert.equal("fresh" in r.send, false);
  assert.equal("tags" in r.send, false, "tags not mentioned in the file stay as they are");
  assert.equal(r.keep, true);
  assert.equal(r.why, "update");
  assert.deepEqual(r.changes, ["the text", "the summary"]);
  assert.equal(r.wasLive, true);
  assert.equal(r.existing, atTarget);
});

test("a draft stays a draft until a flag says otherwise", () => {
  const atTarget = onSite({ published: false });
  const edited = file(`A post\n\n${atTarget.body_md}\n\nOne more paragraph at the end of it.\n`);
  const quiet = decide({ post: edited, atTarget });
  assert.equal("published" in quiet.send, false);
  assert.match(quiet.notes.join("\n"), /draft on the site and stays one/);
  assert.equal(decide({ post: edited, atTarget, published: true }).send.published, true);
});

test("a draft line left in the file does not take a live post down", () => {
  const atTarget = onSite();
  const edited = file(`A post\ndraft: yes\n\n${atTarget.body_md}\n\nOne more paragraph at the end of it.\n`);
  const r = decide({ post: edited, atTarget });
  assert.equal("published" in r.send, false);
  assert.match(r.notes.join("\n"), /stays live/);
  assert.equal(decide({ post: edited, atTarget, published: false }).send.published, false, "--draft does");
});

test("a flag alone is a change, and is worth a copy", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`A post\ntags: go\n\n${atTarget.body_md}\n`), atTarget, published: false });
  assert.equal(r.same, undefined);
  assert.deepEqual(r.changes, ["whether it is out"]);
  assert.equal(r.keep, true);
});

test("a summary written by hand is left alone, and one this command made is kept in step", () => {
  const byHand = onSite({ excerpt: "Written at the desk, by hand." });
  const edited = (ex) => file(`A post\n\n${ex.body_md.replace("alpha0", "A new opening word")}\n`);
  const kept = decide({ post: edited(byHand), atTarget: byHand });
  assert.equal("excerpt" in kept.send, false);
  // it says what it knows, that the summary is not the one it would cut, and shows it, so a stale one is seen
  assert.match(kept.notes.join("\n"), /left as it is.*It reads: "Written at the desk, by hand\."/);
  const auto = onSite();
  assert.match(decide({ post: edited(auto), atTarget: auto }).send.excerpt, /^A new opening word/);
  const told = decide({ post: file(`A post\nsummary: Mine now.\n\n${byHand.body_md}\n`), atTarget: byHand });
  assert.equal(told.send.excerpt, "Mine now.");
});

test("only the tags changing is still a change worth a copy", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`A post\ntags: go, benchmarks\n\n${atTarget.body_md}\n`), atTarget });
  assert.equal(r.same, undefined);
  assert.equal(r.keep, true);
  assert.deepEqual(r.changes, ["the tags"]);
});

test("a draft made at the desk with a title and no text is simply filled in", () => {
  const atTarget = onSite({ body_md: "", excerpt: null, published: false, tags: [] });
  const r = decide({ post: file(`A post\n\n${body3}\n`), atTarget });
  assert.equal(r.refuse, undefined);
  assert.equal(r.existing, atTarget);
  assert.equal("published" in r.send, false);
});

// ---- the title changed ----

test("a corrected title on an unchanged text updates the post this file made, however short the post", () => {
  // this went up as a second post, published, beside the draft it was meant to fix
  const text = "The cache was never cleared, and for three weeks nobody noticed.\n\nThe fix was three lines.";
  const made = onSite({ slug: "teh-cache-that-never-emptied", title: "Teh cache that never emptied", body_md: text, published: false });
  const r = decide({ post: file(`The cache that never emptied\n\n${text}\n`), made });
  assert.equal(r.refuse, undefined);
  assert.equal(r.existing, made);
  assert.equal(r.send.slug, "teh-cache-that-never-emptied");
  assert.equal(r.send.replace, true);
  assert.equal("published" in r.send, false, "a draft stays a draft");
  assert.equal("fresh" in r.send, false);
  assert.match(r.notes.join("\n"), /address did not/);
  assert.deepEqual(r.changes, ["the title"]);
});

test("a corrected title and a typo fixed in every paragraph is still the same post", () => {
  const made = onSite({ slug: "what-opentelemetry-actualy-is", title: "What OpenTelemetry actualy is", published: false });
  const fixed = made.body_md.replace("alpha3", "alpha three").replace("gamma3", "gamma three").replace("omega3", "omega three");
  const r = decide({ post: file(`What OpenTelemetry actually is\n\n${fixed}\n`), made });
  assert.equal(r.existing, made);
  assert.equal("published" in r.send, false);
});

test("a new title over a text that is half the old one is not guessed at", () => {
  const made = onSite();
  const half = file(`A post, reworked\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`);
  const r = decide({ post: half, made });
  assert.match(r.refuse, /This file last posted to https:\/\/example\.test\/blog\/a-post, which holds "A post"/);
  assert.match(r.refuse, /--same-post/);
  assert.match(r.refuse, /--separate/);
  assert.equal(r.send, undefined);
  // each answer does what it says
  const same = decide({ post: half, made, samePost: true });
  assert.equal(same.existing, made);
  assert.equal("published" in same.send, false);
  assert.equal("fresh" in same.send, false);
  const apart = decide({ post: half, made, separate: true });
  assert.equal(apart.existing, null);
  assert.equal(apart.send.slug, "a-post-reworked");
  assert.equal(apart.send.separate, true);
});

test("a short new post that quotes the old one does not replace it", () => {
  const old = ["a", "b", "c", "d", "e"].map(long).join("\n\n");
  const made = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache", body_md: old });
  const correction = file(`A correction to the cache numbers\n\nLast month I wrote this:\n\n${long("c")}\n\nThat number was wrong, and this is the right one.\n`);
  const r = decide({ post: correction, made });
  assert.match(r.refuse, /--same-post/);
  assert.equal(r.send, undefined);
});

test("a file name reused for a wholly different piece makes a new post and leaves the old one alone", () => {
  const made = onSite();
  const r = decide({ post: file(`Something else\n\n${other2}\n`), made });
  assert.equal(r.refuse, undefined);
  assert.equal(r.existing, null);
  assert.equal(r.send.slug, "something-else");
  assert.equal("separate" in r.send, false);
  assert.match(r.notes.join("\n"), /This file last posted to .*which holds "A post"/);
  assert.match(r.notes.join("\n"), /left alone/);
});

test("a reused file whose new text is a newer version of another post updates that post, and says nothing about a new one", () => {
  // it used to say a new post went up and to delete it, which would have deleted the post just updated
  const made = onSite({ slug: "notes-on-the-lock", title: "Notes on the lock", body_md: other2 });
  const atTarget = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache" });
  const r = decide({ post: file(`Notes on the cache\n\n${atTarget.body_md.replace("alpha0", "alpha zero")}\n`), made, atTarget });
  assert.equal(r.existing, atTarget);
  const said = r.notes.join("\n");
  assert.match(said, /points at this post/);
  assert.doesNotMatch(said, /new post|delete/);
});

test("the post this file made, still at the address its title makes, is just the post", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`A post\n\n${atTarget.body_md.replace("alpha0", "alpha zero")}\n`), atTarget, made: atTarget });
  assert.equal(r.existing, atTarget);
  assert.deepEqual(r.notes, []);
});

// ---- something else is at the address ----

test("the same title over a wholly different text is asked about, not replaced", () => {
  const atTarget = onSite({ slug: "weeknotes", title: "Weeknotes" });
  const next = file(`Weeknotes\n\n${other2}\n`);
  const r = decide({ post: next, atTarget });
  assert.match(r.refuse, /A post called "Weeknotes" already lives at https:\/\/example\.test\/blog\/weeknotes/);
  assert.match(r.refuse, /--same-post/);
  assert.match(r.refuse, /--overwrite/);
  assert.equal(r.send, undefined);
  const rewritten = decide({ post: next, atTarget, samePost: true });
  assert.equal(rewritten.existing, atTarget);
  assert.equal("published" in rewritten.send, false);
  assert.equal("fresh" in rewritten.send, false);
});

test("a different post at the address is refused, and nothing is planned", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`Something else\nslug: a-post\n\n${other2}\n`), atTarget });
  assert.match(r.refuse, /A different post, "A post", already lives at https:\/\/example\.test\/blog\/a-post/);
  assert.match(r.refuse, /--overwrite/);
  assert.match(r.refuse, /--same-post/);
  assert.equal(r.send, undefined);
});

test("overwriting with a different post starts clean, and is out or not as a new post would be", () => {
  const other = `Something else\nslug: a-post\n\n${other2}\n`;
  const live = decide({ post: file(other), atTarget: onSite({ published: false }), overwrite: true });
  assert.equal(live.send.fresh, true);
  assert.equal(live.send.replace, true);
  assert.equal(live.send.published, true, "the old post was a draft. the new one is a new post, and goes out");
  assert.deepEqual(live.send.tags, [], "the old tags do not carry over");
  assert.equal(live.keep, true);
  assert.equal(live.why, "overwrite");
  const held = decide({ post: file(other.replace("slug: a-post", "slug: a-post\ndraft: yes")), atTarget: onSite(), overwrite: true });
  assert.equal(held.send.published, false, "the old post was live. the new one says draft, and is one");
  // the same title this time: fresh still needs the site to be told it is a replacement
  const twin = decide({ post: file(`A post\n\n${other2}\n`), atTarget: onSite(), overwrite: true });
  assert.equal(twin.send.fresh, true);
  assert.equal(twin.send.replace, true);
});

test("overwrite does nothing to a post that is plainly the same one", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`A post\n\n${atTarget.body_md.replace("alpha0", "alpha zero")}\n`), atTarget, overwrite: true });
  assert.equal("fresh" in r.send, false);
  assert.equal(r.why, "update");
});

test("a retitled post sent to its own address is the same post: updated where it is, with nothing reset", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`A post, with a better title\nslug: a-post\n\n${atTarget.body_md}\n`), atTarget });
  assert.equal(r.refuse, undefined);
  assert.equal(r.send.replace, true, "the site is told the new title is meant");
  assert.equal("fresh" in r.send, false, "and that it is not a different post");
  assert.equal(r.send.slug, "a-post");
  assert.match(r.notes.join("\n"), /address did not/);
  assert.deepEqual(r.changes, ["the title"]);
});

test("a file that names an address is not second guessed by what it made before", () => {
  const made = onSite({ slug: "old-home", title: "Old home" });
  const r = decide({ post: file(`A new piece\nslug: new-home\n\n${other2}\n`), made });
  assert.equal(r.refuse, undefined);
  assert.equal(r.existing, null);
  assert.equal(r.send.slug, "new-home");
  assert.deepEqual(r.notes, []);
});

// ---- saying which it is ----

test("--same-post never makes a new post", () => {
  const p = file(`A post\n\n${body3}\n`);
  assert.match(decide({ post: p, samePost: true }).refuse, /nothing is at https:\/\/example\.test\/blog\/a-post/);
  assert.match(decide({ post: file(`A post\nslug: typo-in-the-address\n\n${body3}\n`), samePost: true, made: onSite() }).refuse, /typo-in-the-address/);
});

test("--separate never changes a post that is there", () => {
  const atTarget = onSite();
  const r = decide({ post: file(`A post\n\n${other2}\n`), atTarget, separate: true });
  assert.match(r.refuse, /--separate/);
  assert.match(r.refuse, /own title/);
  // with the title changed it goes beside the post this file made, and the site is told it is meant
  const beside = decide({ post: file(`A post, part two\n\n${atTarget.body_md}\n`), made: atTarget, separate: true });
  assert.equal(beside.existing, null);
  assert.equal(beside.send.slug, "a-post-part-two");
  assert.equal(beside.send.separate, true);
});

test("posting it as a separate post is passed on only when asked", () => {
  const p = file("A post\n\nBody text.\n");
  assert.equal(decide({ post: p, separate: true }).send.separate, true);
  assert.equal("separate" in decide({ post: p }).send, false);
});

// ---- putting a kept copy back ----

test("undoing an overwrite puts the old post back as it was, and never makes it live by itself", () => {
  const old = onSite({ published: false, tags: [], excerpt: null, cover_url: "https://example.com/c.png" });
  const now = onSite({ title: "Something else", body_md: other2, tags: ["x"], published: true });
  const r = decide({ post: file(keptCopy(old, "overwrite")), atTarget: now, restoring: true });
  assert.equal(r.refuse, undefined, "the undo is never refused");
  assert.equal(r.send.fresh, true);
  assert.equal(r.send.replace, true);
  assert.equal(r.send.published, false, "it was a draft when it was replaced, so it is not left live at a live address");
  assert.deepEqual(r.send.tags, []);
  assert.equal(r.send.excerpt, "", "it had no summary, so it gets none");
  assert.equal(r.send.cover_url, "https://example.com/c.png");
  assert.equal(r.send.published_at, "2026-08-28T21:22:05.913Z");
  assert.equal(r.keep, true, "and what is there now is kept first");
  assert.equal(r.why, "overwrite");
  // a live post replaced by a draft comes back as a draft, with a word about how to put it out
  const wasLive = decide({ post: file(keptCopy(onSite(), "overwrite")), atTarget: onSite({ title: "Something else", body_md: other2, published: false }), restoring: true });
  assert.equal(wasLive.send.published, false);
  assert.match(wasLive.notes.join("\n"), /--publish/);
  assert.equal(decide({ post: file(keptCopy(onSite(), "overwrite")), atTarget: onSite({ title: "Something else", body_md: other2, published: false }), restoring: true, published: true }).send.published, true);
  // live then, and live now: still live
  const both = decide({ post: file(keptCopy(onSite(), "overwrite")), atTarget: now, restoring: true });
  assert.equal(both.send.published, true);
});

test("putting back an older version of the same post never changes whether it is out, however much the post has changed since", () => {
  // the post was live, was reworked and retitled, and was then taken down on purpose
  const old = onSite({ published: true });
  const now = onSite({ title: "Why the cache never emptied", body_md: `${long("sigma")}\n\n${long("theta")}\n\n${long("omega")}`, published: false });
  const r = decide({ post: file(keptCopy(old, "update")), atTarget: now, restoring: true });
  assert.equal("published" in r.send, false, "putting the old text back does not publish it");
  assert.equal("fresh" in r.send, false);
  assert.match(r.notes.join("\n"), /draft on the site and stays one/);
  assert.equal(decide({ post: file(keptCopy(old, "update")), atTarget: now, restoring: true, published: true }).send.published, true);
  // The mirror: a copy of a draft, and the page is live now. In place, its text would be out for
  // the first time. Taken down, a live post would vanish. So it asks, and each answer is one flag.
  const live = { ...now, published: true };
  const draftCopy = file(keptCopy(onSite({ published: false }), "update"));
  const asked = decide({ post: draftCopy, atTarget: live, restoring: true });
  assert.match(asked.refuse, /This copy is of a draft, and what is at .* now is live/);
  assert.match(asked.refuse, /--publish/);
  assert.match(asked.refuse, /--draft/);
  assert.equal(decide({ post: draftCopy, atTarget: live, restoring: true, published: true }).send.published, true);
  assert.equal(decide({ post: draftCopy, atTarget: live, restoring: true, published: false }).send.published, false);
  // word for word what is there already: nothing to put back, so nothing to ask
  const sameText = onSite({ published: true });
  assert.equal(decide({ post: file(keptCopy({ ...sameText, published: false }, "update")), atTarget: sameText, restoring: true }).same, true);
});

test("a kept copy goes back where it came from, so --same-post and --separate do not apply to it", () => {
  const atTarget = onSite({ title: "Something else", body_md: other2 });
  for (const flag of ["samePost", "separate"]) {
    const r = decide({ post: file(keptCopy(onSite())), atTarget, restoring: true, [flag]: true });
    assert.match(r.refuse, /copy the command kept/);
    assert.equal(r.send, undefined);
  }
});

test("an older version put back where another post now lives is asked about, and comes back as a draft", () => {
  // the draft's old text used to be written straight onto the live page of the post that had taken its address
  const copy = keptCopy(onSite({ published: false }), "update");
  const there = onSite({ title: "Notes on the lock", body_md: other2, published: true });
  const asked = decide({ post: file(copy), atTarget: there, restoring: true });
  assert.match(asked.refuse, /"Notes on the lock", a different post from the one this copy was taken of/);
  assert.match(asked.refuse, /--overwrite/);
  assert.equal(asked.send, undefined);
  const yes = decide({ post: file(copy), atTarget: there, restoring: true, overwrite: true });
  assert.equal(yes.send.fresh, true);
  assert.equal(yes.send.published, false, "the page was live, and the copy goes back as a draft all the same");
  assert.equal(yes.why, "overwrite");
  assert.equal(decide({ post: file(keptCopy(onSite(), "update")), atTarget: there, restoring: true, overwrite: true }).send.published, false, "even a copy of a live post");
  assert.equal(decide({ post: file(copy), atTarget: there, restoring: true, overwrite: true, published: true }).send.published, true);
});

test("the undo of an overwrite under the same title is still an undo", () => {
  // two posts called Weeknotes. the second overwrote the first, a draft. taking the undo for an edit left the draft's text live.
  const first = onSite({ title: "Weeknotes", slug: "weeknotes", published: false, tags: ["private"] });
  const second = onSite({ title: "Weeknotes", slug: "weeknotes", body_md: other2, published: true });
  const r = decide({ post: file(keptCopy(first, "overwrite")), atTarget: second, restoring: true });
  assert.equal(r.send.fresh, true);
  assert.equal(r.send.published, false);
  assert.deepEqual(r.send.tags, ["private"]);
  // and when the two shared a sign off, so the overwrite was of a partly matching text
  const closing = "That is all for this week. Thank you for reading, and see you next Monday, same time.";
  const a = onSite({ title: "Weeknotes", slug: "weeknotes", body_md: `${body3}\n\n${closing}`, published: false });
  const b = onSite({ title: "Weeknotes", slug: "weeknotes", body_md: `${other2}\n\n${closing}`, published: true });
  assert.equal(decide({ post: file(keptCopy(a, "overwrite")), atTarget: b, restoring: true }).send.published, false);
});

test("a kept copy of a post since deleted comes back as a draft unless told otherwise", () => {
  const draft = decide({ post: file(keptCopy(onSite({ published: false }))), restoring: true });
  assert.equal(draft.send.published, false);
  assert.equal(draft.send.slug, "a-post");
  assert.equal(draft.send.published_at, "2026-08-28T21:22:05.913Z");
  const live = decide({ post: file(keptCopy(onSite())), restoring: true });
  assert.equal(live.send.published, false, "a copy does not publish anything by itself");
  assert.equal(live.send.separate, true, "and the site is not to stop the undo for looking like another post");
  assert.match(live.notes.join("\n"), /--publish/);
  assert.equal(decide({ post: file(keptCopy(onSite())), restoring: true, published: true }).send.published, true);
});

// ---- found by the fifth review: which post gets changed ----

test("--same-post changes the post the question was about, not another one the file once made", () => {
  // the question named Weeknotes, and the answer rewrote a live post it had never mentioned
  const made = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache" });
  const atTarget = onSite({ slug: "weeknotes", title: "Weeknotes", body_md: `${long("sigma")}\n\n${long("theta")}` });
  const next = file(`Weeknotes\n\n${other2}\n`);
  const asked = decide({ post: next, made, atTarget });
  assert.match(asked.refuse, /A post called "Weeknotes" already lives at https:\/\/example\.test\/blog\/weeknotes/);
  const r = decide({ post: next, made, atTarget, samePost: true });
  assert.equal(r.existing, atTarget, "the post the question named");
  assert.equal(r.send.slug, "weeknotes");
  // when the text is partly the post this file made, that is the question that was asked, and the answer goes there
  const half = file(`A post, reworked\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`);
  assert.equal(decide({ post: half, made: onSite(), atTarget: null, samePost: true }).send.slug, "a-post");
  // and with nothing at the address, the post this file made is the only one it can mean
  assert.equal(decide({ post: file(`Something new\n\n${other2}\n`), made, atTarget: null, samePost: true }).existing, made);
});

test("the same title is not enough from another file: a partly matching text is asked about", () => {
  // week two, from a file that never made week one, shares its opening line and its sign off
  const closing = "That is all for this week. Thank you for reading, and see you next Monday, same time.";
  const week1 = onSite({ slug: "weeknotes", title: "Weeknotes", body_md: `${body3}\n\n${closing}` });
  const week2 = file(`Weeknotes\n\n${other2}\n\n${long("sigma")}\n\n${closing}\n`);
  assert.equal(relate(week1, week2), "unsure");
  const asked = decide({ post: week2, atTarget: week1 });
  assert.match(asked.refuse, /A post called "Weeknotes" already lives at .*partly the same as it and partly new/);
  assert.equal(asked.send, undefined);
  // nor is the file that made the post let through: the same file and title are how next week's notes arrive
  assert.match(decide({ post: week2, atTarget: week1, made: week1 }).refuse, /partly the same/);
  const pinned = file(`Weeknotes\nslug: weeknotes\n\n${other2}\n\n${long("sigma")}\n\n${closing}\n`);
  assert.match(decide({ post: pinned, atTarget: week1, made: week1 }).refuse, /partly the same/);
  // the answer for a heavy rewrite of the same post is one flag, and it keeps everything the post had
  const rewritten = decide({ post: week2, atTarget: week1, made: week1, samePost: true });
  assert.equal(rewritten.existing, week1);
  assert.equal("fresh" in rewritten.send, false);
  assert.equal("published" in rewritten.send, false);
  // an edit that keeps most of the old text is never asked about
  const edited = file(`Weeknotes\n\n${body3.replace(long("omega"), long("sigma"))}\n\n${closing}\n`);
  assert.equal(decide({ post: edited, atTarget: week1 }).existing, week1);
});

test("--overwrite is honoured whenever the text is not plainly the same post", () => {
  const closing = "That is all for this week. Thank you for reading, and see you next Monday, same time.";
  const week1 = onSite({ slug: "weeknotes", title: "Weeknotes", body_md: `${body3}\n\n${closing}`, published: false, tags: ["private"] });
  const week2 = file(`Weeknotes\n\n${other2}\n\n${long("sigma")}\n\n${closing}\n`);
  for (const made of [null, week1]) {
    const r = decide({ post: week2, atTarget: week1, made, overwrite: true });
    assert.equal(r.send.fresh, true, "it was called a different post, and it is put there as one");
    assert.equal(r.send.published, true);
    assert.deepEqual(r.send.tags, []);
  }
});

test("two titles that make the same address are not thereby the same post", () => {
  const c = onSite({ slug: "notes-on-c", title: "Notes on C", body_md: `${long("alpha")}\n\n${long("gamma")}\n\n${long("omega")}` });
  const cpp = file(`Notes on C++\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`);
  assert.match(decide({ post: cpp, atTarget: c }).refuse, /A post called "Notes on C" already lives at/);
});

test("under a new title, text that holds half of the old post is not called the same post", () => {
  // a correction that quotes the long middle paragraph of a three paragraph post
  const quoted = `${long("gamma")} ${long("gammb")} ${long("gammc")}`;
  const made = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache", body_md: `${long("alpha")}\n\n${quoted}\n\n${long("omega")}` });
  const correction = file(`A correction to the cache numbers\n\nLast month I wrote this:\n\n${quoted}\n\nThat number was wrong, and this is the right one.\n`);
  // measured, so the sentence below is true of it: well over half of the old post, and nearly all of the new text is old
  const shares = likeness(made.body_md, correction.body_md);
  assert.ok(shares.ofPrev > 0.55 && shares.ofPrev < 0.7 && shares.ofNext > 0.82, JSON.stringify(shares));
  assert.equal(relate(made, correction), "unsure", "most of the old post is in it, and that is not enough under a new title");
  // the same thing the other way about: a cut down copy, three of a post's five paragraphs under a new title
  const five = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache", body_md: ["a", "b", "c", "d", "e"].map(long).join("\n\n") });
  const three = { title: "The short version", body_md: ["a", "b", "c"].map(long).join("\n\n") };
  assert.ok(likeness(five.body_md, three.body_md).ofPrev < 0.65 && likeness(five.body_md, three.body_md).ofNext === 1);
  assert.equal(relate(five, three), "unsure", "all of the new text is old, and two fifths of the old post is gone");
  assert.match(decide({ post: file(`${three.title}\n\n${three.body_md}\n`), made: five }).refuse, /--same-post/);
  assert.match(decide({ post: correction, made }).refuse, /--same-post/);
  // a long follow up that quotes a short post whole
  const short = onSite({ slug: "the-fix", title: "The fix", body_md: long("alpha") });
  const followUp = file(`Everything since the fix\n\n${long("alpha")}\n\n${body3.replace(/alpha/g, "beta")}\n\n${other2}\n`);
  assert.equal(relate(short, followUp), "unsure");
  // under its own title the old rule stands: most of the old text still there is the same post
  assert.equal(relate(made, { title: "Notes on the cache", body_md: `${long("alpha")}\n\n${quoted}\n\n${long("delta")}` }), "same");
  // and a fixed title over a typo fixed in each paragraph is still plainly the same
  assert.equal(relate(onSite({ title: "Notes on teh cache" }), { title: "Notes on the cache", body_md: body3.replace("alpha3", "alpha three").replace("gamma3", "gamma three").replace("omega3", "omega three") }), "same");
});

test("the way out it offers is one the site will take", () => {
  const atTarget = onSite({ slug: "weeknotes", title: "Weeknotes" });
  // the same words in the title: another address would still be refused by the site, so only a new title is offered
  const sameWords = decide({ post: file(`Weeknotes\n\n${other2}\n`), atTarget }).refuse;
  assert.match(sameWords, /give it its own title\n/);
  assert.doesNotMatch(sameWords, /some-other-words/);
  assert.match(decide({ post: file(`Weeknotes\n\n${other2}\n`), atTarget, separate: true }).refuse, /For a second post, give it its own title$/);
  // titles that only make the same address: either works
  assert.match(decide({ post: file(`Weeknotes!\n\n${other2}\n`), atTarget }).refuse, /own title, or add {2}--slug some-other-words/);
  // an address the file names itself is not moved by a new title
  assert.match(decide({ post: file(`Something else\nslug: weeknotes\n\n${other2}\n`), atTarget }).refuse, /give it its own address: {2}--slug some-other-words/);
  assert.match(decide({ post: file(`Weeknotes\nslug: weeknotes\n\n${other2}\n`), atTarget }).refuse, /its own title and its own address/);
});

test("--slug takes a whole address too, since that is how the command prints them", () => {
  assert.equal(readArgs(["f.txt", "--slug", "https://itssaharsh.vercel.app/blog/notes-on-the-cache"]).slug, "notes-on-the-cache");
  assert.equal(readArgs(["f.txt", "--slug", "/blog/notes-on-the-cache/"]).slug, "notes-on-the-cache");
  assert.equal(readArgs(["f.txt", "--slug=notes-on-the-cache"]).slug, "notes-on-the-cache");
  assert.equal(readArgs(["f.txt"], { npm_config_slug: "http://localhost:3000/blog/notes" }).slug, "notes");
  assert.throws(() => readArgs(["f.txt", "--slug", "https://example.com/somewhere/else/entirely"]), /last part of an address/);
  assert.throws(() => readArgs(["f.txt", "--slug", "two words"]), /last part of an address/);
});

// ---- found by the sixth review ----

test("--slug takes an address as a browser hands it over: cut at a question mark or a hash, with %20 read back as the space it stands for", () => {
  const slug = (v) => readArgs(["f.txt", "--slug", v]).slug;
  // with the hash on the end this once published a new post at /blog/notes-on-the-cache-the-fix
  for (const tail of ["#the-fix", "?utm_source=x", "#main", "/?a=b#c", "?a=b/c", "#"]) {
    assert.equal(slug(`http://site.invalid/blog/notes-on-the-cache${tail}`), "notes-on-the-cache", tail);
    assert.equal(slug(`/blog/notes-on-the-cache${tail}`), "notes-on-the-cache", tail);
  }
  assert.equal(readArgs(["f.txt"], { npm_config_slug: "http://localhost:3000/blog/notes#top" }).slug, "notes");
  assert.equal(readArgs(["f.txt", "--slug=http://site.invalid/blog/notes?x=1"]).slug, "notes");
  // An address typed at the old desk can hold a space, and a browser shows that as %20. It is
  // tidied to the form the flag takes, which the site matches to the stored one.
  for (const pasted of ["http://site.invalid/blog/Go%20Notes", "/blog/Go%20Notes", "blog/Go%20Notes/", "http://site.invalid/blog/Go Notes", "http://site.invalid/blog/Go%20Notes?x=1#y"]) {
    const args = readArgs(["f.txt", "--slug", pasted]);
    assert.equal(args.slug, "go-notes", pasted);
    assert.equal(args.pasted, "Go Notes", `${pasted}: what was pasted is kept too, so the site can be asked for exactly that first`);
  }
  // The same for a slash, which a browser shows as %2F. It is read back only once the last
  // part has been taken, so it is never taken for one more part of the address.
  for (const pasted of ["http://site.invalid/blog/notes%2F2019", "/blog/notes%2F2019", "blog/notes%2f2019/", "http://site.invalid/blog/notes%2F2019?x=1#y"]) {
    const args = readArgs(["f.txt", "--slug", pasted]);
    assert.equal(args.slug, "notes-2019", pasted);
    assert.equal(args.pasted, "notes/2019", pasted);
  }
  // one the flag takes as it stands is kept as it stands, and nothing more is remembered
  for (const [given, want] of [["http://site.invalid/blog/OTel_Notes.v2", "OTel_Notes.v2"], ["/blog/notes-on-the-cache", "notes-on-the-cache"], ["notes-on-the-cache", "notes-on-the-cache"]]) {
    const args = readArgs(["f.txt", "--slug", given]);
    assert.equal(args.slug, want);
    assert.equal("pasted" in args, false, given);
  }
  // a percent sign that stands for no character is taken as it was typed
  assert.equal(slug("/blog/100%"), "100");
});

test("--slug still refuses what is not the last part of an address", () => {
  const refused = /--slug takes the last part of an address/;
  // typed bare, none of these is an address, and each would have made a new post somewhere unexpected
  for (const v of ["notes?x=1", "notes#top", "Go%20Notes", "two words", "a:b", "notes/on/the/cache", "?", "#top"]) {
    assert.throws(() => readArgs(["f.txt", "--slug", v]), refused, v);
  }
  // an address with more to it than one part, or with nothing where the part should be
  for (const v of ["https://example.com/somewhere/else/entirely", "http://site.invalid/blog/", "http://site.invalid/blog/#top", "/blog/?x=1", "/blog/a/b", "/blog/a%2Fb/c", "/blog/%20", "http://site.invalid/admin/edit/123"]) {
    assert.throws(() => readArgs(["f.txt", "--slug", v]), refused, v);
  }
});

test("a copy of a draft that changes nothing on a live page still says the page stays live", () => {
  // the copy and the page hold the same title and text, so nothing is asked. it used to say nothing at all.
  const page = onSite({ published: true });
  const r = decide({ post: file(keptCopy({ ...page, published: false }, "update")), atTarget: page, restoring: true });
  assert.equal(r.same, true);
  assert.deepEqual(r.notes, ["The copy was of a draft, but the post is live and stays live. --draft takes it off the site."]);
  // the same when only the tags differ, which is a change and still not one that is asked about
  const tagged = decide({ post: file(keptCopy({ ...page, published: false, tags: ["go", "caches"] }, "update")), atTarget: page, restoring: true });
  assert.deepEqual(tagged.changes, ["the tags"]);
  assert.match(tagged.notes.join("\n"), /The copy was of a draft, but the post is live and stays live/);
  // with a flag there is nothing to explain, and a copy of a live post on a live page has nothing to say
  assert.deepEqual(decide({ post: file(keptCopy({ ...page, published: false }, "update")), atTarget: page, restoring: true, published: false }).notes, []);
  assert.deepEqual(decide({ post: file(keptCopy(page, "update")), atTarget: page, restoring: true }).notes, []);
  // an ordinary file keeps its own wording
  assert.match(decide({ post: file(`A post\ndraft: yes\n\n${page.body_md}\n`), atTarget: page }).notes.join("\n"), /^The file says draft: yes, but the post is live and stays live\. --draft takes it off the site\.$/);
});

test("the question about the post a file last made offers --separate only where --separate will be taken", () => {
  const half = (title) => file(`${title}\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`);
  const cache = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache" });
  // nothing at the address the new title makes, and the titles differ: the answer is the bare flag, as it always was
  assert.match(decide({ post: half("A second look"), made: cache }).refuse, /\n {2}If it is a new post, add {2}--separate$/);
  assert.equal(decide({ post: half("A second look"), made: cache, separate: true }).existing, null);

  // another post sits at the address the new title makes: --separate as it stands would be refused
  const queue = onSite({ slug: "notes-on-the-queue", title: "Notes on the queue", body_md: other2 });
  const asked = decide({ post: half("Notes on the queue"), made: cache, atTarget: queue });
  assert.match(asked.refuse, /^This file last posted to https:\/\/example\.test\/blog\/notes-on-the-cache, which holds "Notes on the cache"/);
  assert.match(asked.refuse, /\n {2}If it is a new post, give it its own title and add {2}--separate$/);
  assert.match(decide({ post: half("Notes on the queue"), made: cache, atTarget: queue, separate: true }).refuse, /--separate puts this beside/, "the bare flag really is refused here");
  const apart = decide({ post: half("A title of its own"), made: cache, separate: true });
  assert.equal(apart.existing, null, "and under its own title it is taken");
  assert.equal(apart.send.separate, true);
  assert.equal(decide({ post: half("Notes on the queue"), made: cache, atTarget: queue, samePost: true }).existing, cache, "--same-post goes to the post the question named");

  // the post it last made carries the file's own title at another address, as it does once a corrected title has been posted.
  // the site lets no second post in under that title, so the bare flag would be refused there too.
  const corrected = onSite({ slug: "teh-cache-that-never-emptied", title: "The cache that never emptied" });
  assert.match(decide({ post: half("The cache that never emptied"), made: corrected }).refuse, /\n {2}If it is a new post, give it its own title and add {2}--separate$/);

  // a title with nothing to make an address from: a new post needs an address given as well
  const bare = decide({ post: half("!!!"), made: cache });
  assert.match(bare.refuse, /\n {2}If it is a new post, add {2}--slug some-other-words --separate$/);
  assert.equal(decide({ post: file(`!!!\nslug: some-other-words\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`), separate: true }).send.slug, "some-other-words");
  assert.match(decide({ post: half("!!!"), samePost: true }).refuse, /this title makes no address to look for one at\.\n/);
});

test("--overwrite cannot answer the question about the post a file last made, and says where it does reach", () => {
  const half = file(`Notes on the queue\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`);
  const cache = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache" });
  const queue = onSite({ slug: "notes-on-the-queue", title: "Notes on the queue", body_md: other2 });
  const asked = decide({ post: half, made: cache, atTarget: queue, overwrite: true });
  assert.equal(asked.send, undefined, "it still asks: replacing the post at the address would replace one the question never named");
  assert.match(asked.refuse, /^This file last posted to .*\/blog\/notes-on-the-cache, which holds "Notes on the cache"/);
  // the two answers are flags that cannot stand beside --overwrite, so it says to take it off
  assert.match(asked.refuse, /\n {2}If it is a new version of that post, take --overwrite off and add {2}--same-post\n/);
  assert.match(asked.refuse, /\n {2}If it is a new post, take --overwrite off, give it its own title and add {2}--separate\n/);
  assert.match(asked.refuse, /\n {2}--overwrite replaces what is at an address, and this question is about another post\. To replace "Notes on the queue" at https:\/\/example\.test\/blog\/notes-on-the-queue with this one, add {2}--slug notes-on-the-queue --overwrite$/);
  // typed as printed, the file names the address, and the post there is replaced as a new post
  const there = decide({ post: file(`Notes on the queue\nslug: notes-on-the-queue\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`), atTarget: queue, overwrite: true });
  assert.equal(there.existing, queue);
  assert.equal(there.send.fresh, true);

  // with nothing at the address the title makes, the only post in play is the one the question names
  const alone = decide({ post: half, made: cache, overwrite: true });
  assert.match(alone.refuse, /\n {2}If it is a new post, take --overwrite off and add {2}--separate\n/);
  assert.match(alone.refuse, /\n {2}--overwrite replaces what is at an address, and nothing is at https:\/\/example\.test\/blog\/notes-on-the-queue\. To replace the post this file last posted to with this one, add {2}--slug notes-on-the-cache --overwrite$/);
  const replaced = decide({ post: file(`Notes on the queue\nslug: notes-on-the-cache\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`), atTarget: cache, overwrite: true });
  assert.equal(replaced.existing, cache);
  assert.equal(replaced.send.fresh, true);

  // an address from the old desk that the flag would refuse is printed whole, which the flag does take
  const old = onSite({ slug: "Go Notes", title: "Go notes" });
  const odd = decide({ post: half, made: old, overwrite: true }).refuse;
  assert.match(odd, /add {2}--slug https:\/\/example\.test\/blog\/Go%20Notes --overwrite$/);
  const typed = readArgs(["f.txt", ...odd.match(/add {2}(--slug \S+ --overwrite)$/)[1].split(" ")]);
  assert.equal(typed.pasted, "Go Notes", "and it reads back as the stored address, to be asked for exactly");
  assert.equal(typed.overwrite, true);
  // so is one with a slash in it, which the last part of an address can only hold written as %2F
  const slashed = onSite({ slug: "notes/2019", title: "Notes from 2019" });
  const far = decide({ post: half, made: slashed, overwrite: true }).refuse;
  assert.match(far, /add {2}--slug https:\/\/example\.test\/blog\/notes%2F2019 --overwrite$/);
  assert.equal(readArgs(["f.txt", ...far.match(/add {2}(--slug \S+ --overwrite)$/)[1].split(" ")]).pasted, "notes/2019");
});

test("an address printed for the writer to type is one a shell leaves alone, and it reads back as the stored address", () => {
  const half = file(`Notes on the queue\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`);
  const offered = (stored) => decide({ post: half, made: onSite({ slug: stored, title: "Notes on the cache" }), overwrite: true }).refuse.split("\n").at(-1);
  // A row the old desk left can hold anything. Typed bare after --slug, an ampersand ends the
  // command there, a quote opens a string, and a star is matched against the names of files.
  for (const stored of ["Q&A", "it's-here", "notes;draft", "a|b", "cost-in-$", "notes(2019)", "notes*", "wow!", "a`b", 'say-"hi"', "a<b", "a>b", "a\\b", "~notes", "notes[1]", "a{b}", "--notes"]) {
    const flags = offered(stored).match(/add {2}(--slug \S+ --overwrite)$/)?.[1].split(" ");
    assert.ok(flags, `${stored}: ${offered(stored)}`);
    assert.match(flags[1], /^https:\/\/example\.test\/blog\/[A-Za-z0-9._~%-]+$/, `${stored} is printed whole, with nothing in it that a shell reads as its own`);
    const typed = readArgs(["f.txt", ...flags]);
    assert.equal(typed.pasted ?? typed.slug, stored, `${stored} reads back as itself, so the site is asked for exactly that`);
  }
  // one made of letters, digits, dots, dashes and underscores is printed as it stands
  for (const stored of ["notes-on-the-cache", "OTel_Notes.v2", "2019"]) assert.ok(offered(stored).endsWith(`add  --slug ${stored} --overwrite`), offered(stored));
});

test("the question about the post at the address offers --separate with a new title or address when the text is partly that post's", () => {
  // six paragraphs on the site, and a file under a title that makes the same address, holding three of them and one of its own
  const six = `${body3}\n\n${other2}\n\n${long("sigma")}`;
  const atTarget = onSite({ slug: "weeknotes", title: "Weeknotes", body_md: six });
  const mostly = (head) => file(`${head}\n\n${body3}\n\n${long("theta")}\n`);
  assert.equal(likeness(six, mostly("Weeknotes!").body_md).ofNext > 0.7, true, "most of the file is that post's, so the site would refuse a new post without --separate");
  assert.match(decide({ post: mostly("Weeknotes!"), atTarget }).refuse, /\n {2}If it is a different post, give it its own title and add {2}--separate, or add {2}--slug some-other-words --separate\n/);
  assert.match(decide({ post: mostly("Weeknotes"), atTarget }).refuse, /\n {2}If it is a different post, give it its own title and add {2}--separate\n/);
  assert.match(decide({ post: mostly("Something else\nslug: weeknotes"), atTarget }).refuse, /\n {2}If it is a different post, give it its own address: {2}--slug some-other-words --separate\n/);
  assert.match(decide({ post: mostly("Weeknotes\nslug: weeknotes"), atTarget }).refuse, /\n {2}If it is a different post, give it its own title and its own address, and add {2}--separate\n/);
  // typed as printed it is a new post, and the site is told it is meant
  const apart = decide({ post: mostly("Weeknotes!\nslug: some-other-words"), separate: true });
  assert.equal(apart.existing, null);
  assert.equal(apart.send.separate, true);
  // where next to none of the text is that post's, nothing has changed: no --separate is needed, and none is offered
  assert.doesNotMatch(decide({ post: file(`Weeknotes!\n\n${long("theta")}\n\n${long("zeta")}\n`), atTarget }).refuse, /--separate/);
  // the post this file last made is on the site too, so its title is in the way of a new address just the same
  const twin = onSite({ slug: "week-one", title: "Weeknotes!", body_md: `${long("theta")}\n\n${long("kappa")}\n\n${long("omega")}` });
  const blocked = decide({ post: file(`Weeknotes!\n\n${long("delta")}\n\n${long("gamma")}\n`), atTarget: onSite({ slug: "weeknotes", title: "Weeknotes", body_md: `${long("zeta")}\n\n${long("eta")}` }), made: twin }).refuse;
  assert.match(blocked, /\n {2}If it is a different post, give it its own title\n/);
  assert.doesNotMatch(blocked, /some-other-words/);
});

test("what --overwrite is said to make of a post is what it makes of it", () => {
  const atTarget = onSite();
  const said = (head, over = {}) => decide({ post: file(`${head}\n\n${other2}\n`), atTarget, ...over }).refuse.split("\n").at(-1).trim();
  const done = (head, over = {}) => decide({ post: file(`${head}\n\n${other2}\n`), atTarget, overwrite: true, ...over }).send;
  const lead = "To replace that post with this one, add  --overwrite. It goes up as a new post: ";
  assert.equal(said("Something else\nslug: a-post"), `${lead}published, and dated today.`);
  assert.equal(done("Something else\nslug: a-post").published, true);
  assert.equal("published_at" in done("Something else\nslug: a-post"), false, "no date is sent, so the site dates it the day it goes out");
  // it used to say "dated today, and published unless it says draft" whatever the file and the flags said
  assert.equal(said("Something else\nslug: a-post\ndraft: yes"), `${lead}saved as a draft, and dated the day it goes out.`);
  assert.equal(done("Something else\nslug: a-post\ndraft: yes").published, false);
  assert.equal(said("Something else\nslug: a-post", { published: false }), `${lead}saved as a draft, and dated the day it goes out.`);
  assert.equal(done("Something else\nslug: a-post", { published: false }).published, false);
  assert.equal(said("Something else\nslug: a-post\ndraft: yes", { published: true }), `${lead}published, and dated today.`);
  assert.equal(done("Something else\nslug: a-post\ndraft: yes", { published: true }).published, true);
  assert.equal(said("Something else\nslug: a-post\ndate: 2026-01-15"), `${lead}published, and dated as the file says.`);
  assert.equal(done("Something else\nslug: a-post\ndate: 2026-01-15").published_at, "2026-01-15");
  assert.equal(said("Something else\nslug: a-post\ndate: 2026-01-15\ndraft: yes"), `${lead}saved as a draft, and dated as the file says.`);
});

test("--overwrite with nothing at the address is an ordinary new post, and the site may still stop it as a second copy", () => {
  const r = decide({ post: file(`A post\n\n${body3}\n`), overwrite: true });
  assert.equal(r.existing, null);
  assert.equal("separate" in r.send, false, "only --separate tells the site that a second copy is meant");
  assert.equal("fresh" in r.send, false);
});

// ---- the way back that is printed ----

/** what the site holds once it has taken what was sent, worked out here by hand and not by asking the code */
const afterwards = (existing, send) => ({
  ...existing, title: send.title, body_md: send.body_md,
  excerpt: "excerpt" in send ? send.excerpt || null : send.fresh ? null : existing.excerpt,
  tags: "tags" in send ? send.tags : send.fresh ? [] : existing.tags,
  published: "published" in send ? send.published : send.fresh ? false : existing.published,
});
/** run the put back the way it was printed: the kept copy, and whatever flags the run said to add */
const putBack = (run) => {
  const now = afterwards(run.existing, run.send);
  const flags = { overwrite: run.undo.includes("--overwrite"), published: run.undo.includes("--publish") ? true : run.undo.includes("--draft") ? false : undefined };
  const back = decide({ post: file(keptCopy(run.existing, run.why), { copy: true }), atTarget: now, restoring: true, ...flags });
  return { back, now, ends: back.refuse ? null : afterwards(now, back.send) };
};

test("the flags printed with the way back are the ones that put the post back as it was", () => {
  const body = onSite().body_md;
  const edited = `A post\n\n${body}\n\nOne more paragraph at the end of it.\n`;
  // a change that leaves it out or not as it was needs nothing but the copy
  for (const published of [true, false]) {
    const run = decide({ post: file(edited), atTarget: onSite({ published }) });
    assert.deepEqual(run.undo, [], `published: ${published}`);
    assert.equal(putBack(run).ends.published, published);
  }
  // --publish on a draft: the copy says draft, and put back with no flag it would leave the page live and say there is nothing to change
  const out = decide({ post: file(`A post\n\n${body}\n`), atTarget: onSite({ published: false }), published: true });
  assert.deepEqual(out.changes, ["whether it is out"]);
  assert.deepEqual(out.undo, ["--draft"]);
  assert.equal(putBack(out).ends.published, false, "typed as printed, it is a draft again");
  assert.equal(decide({ post: file(keptCopy(out.existing, out.why), { copy: true }), atTarget: afterwards(out.existing, out.send), restoring: true }).same, true, "and without the flag it would have done nothing");
  // --draft on a live post, with an edit as well
  const down = decide({ post: file(edited), atTarget: onSite({ published: true }), published: false });
  assert.deepEqual(down.undo, ["--publish"]);
  const up = putBack(down);
  assert.equal(up.ends.published, true);
  assert.equal(up.ends.body_md, body);

  // an overwrite that changed whether the address is live
  const other = `Something else\nslug: a-post\n\n${other2}\n`;
  const overLive = decide({ post: file(other.replace("slug: a-post", "slug: a-post\ndraft: yes")), atTarget: onSite({ published: true }), overwrite: true });
  assert.deepEqual(overLive.undo, ["--publish"], "the old post was live and the address holds a draft now, so the undo alone would bring it back as a draft");
  assert.equal(putBack(overLive).ends.published, true);
  assert.equal(putBack(overLive).ends.title, "A post");
  const overDraft = decide({ post: file(other), atTarget: onSite({ published: false }), overwrite: true });
  assert.deepEqual(overDraft.undo, ["--draft"]);
  assert.equal(putBack(overDraft).ends.published, false);
  // and one that did not: the undo of an overwrite brings a live post back live when the address is live
  const overSame = decide({ post: file(other), atTarget: onSite({ published: true }), overwrite: true });
  assert.deepEqual(overSame.undo, []);
  assert.equal(putBack(overSame).ends.published, true);

  // --same-post onto a post with another title and none of this text. the copy is kept as an older version, and
  // put back it would be asked about as another post altogether, so the way back needs --overwrite, and --publish to stay live.
  for (const published of [true, false]) {
    const forced = decide({ post: file(other), atTarget: onSite({ published }), samePost: true });
    assert.equal(forced.why, "update");
    assert.deepEqual(forced.undo, published ? ["--overwrite", "--publish"] : ["--overwrite"], `published: ${published}`);
    const { back, ends } = putBack(forced);
    assert.equal(back.refuse, undefined);
    assert.equal(ends.published, published);
    assert.equal(ends.title, "A post");
    assert.equal(ends.body_md, body);
    assert.deepEqual(ends.tags, ["go"]);
    // without them it is stopped, which is why they are printed
    assert.match(decide({ post: file(keptCopy(forced.existing, forced.why), { copy: true }), atTarget: afterwards(forced.existing, forced.send), restoring: true }).refuse, /--overwrite/);
  }
  // putting a copy back keeps a copy too, and the way back from that is held to the same
  const older = decide({ post: file(keptCopy(onSite({ published: false }), "update"), { copy: true }), atTarget: onSite({ body_md: `${body}\n\nOne more paragraph at the end of it.`, published: true }), restoring: true, published: false });
  assert.deepEqual(older.undo, ["--publish"]);
  assert.equal(putBack(older).ends.published, true);
});

test("what a copy over another post is told about --overwrite is true for the flags it came with", () => {
  const copy = file(keptCopy(onSite({ published: true }), "update"), { copy: true });
  const there = onSite({ title: "Notes on the lock", body_md: other2, published: true });
  const told = (over) => decide({ post: copy, atTarget: there, restoring: true, ...over }).refuse.split("\n").at(-1).trim();
  const done = (over) => decide({ post: copy, atTarget: there, restoring: true, overwrite: true, ...over }).send.published;
  assert.equal(told({}), "To replace it with this copy, add  --overwrite. It goes back as a draft unless you also add --publish.");
  assert.equal(done({}), false);
  assert.equal(done({ published: true }), true, "and adding --publish as well does put it back live");
  // With --draft already typed it used to say the same, and --publish added to --draft is
  // refused: the two cannot both be right.
  assert.equal(told({ published: false }), "To replace it with this copy, add  --overwrite. With --draft it goes back as a draft.");
  assert.equal(done({ published: false }), false);
  assert.throws(() => readArgs(["copy.txt", "--draft", "--overwrite", "--publish"]), /--draft and --publish cannot both be right/);
  assert.equal(told({ published: true }), "To replace it with this copy, add  --overwrite. With --publish it goes back live.");
});

// ---- what a dry run says ----

/** the rules as one run of sentences. each rule starts a line of its own, and a long one is wrapped. */
const rules = (o) => dryRun({ site: SITE, ...o }).join(" ");

test("a dry run of an ordinary file says the rules for the flags it was given, and no line contradicts another", () => {
  const post = file(`Notes on the cache\n\n${body3}\n`);
  const said = (over) => rules({ post, target: "notes-on-the-cache", ...over });
  const there = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache", published: false });
  const plain = said({});
  // A post typed at the old desk can be stored under another spelling of the address, Go Notes
  // for go-notes, and the site finds it for this one. A dry run has not asked, so it says both.
  assert.ok(plain.startsWith("It would go to https://example.test/blog/notes-on-the-cache, or to a post the site already holds under another spelling of that address, which keeps the spelling it has. "), plain);
  assert.ok(plain.includes("If nothing is there, it is a new post, and it is published."));
  assert.ok(plain.includes("If the same post is there, it is changed where it is, and it stays a draft or stays live unless --draft or --publish says otherwise. A draft: line in the file does not count then."));
  assert.ok(plain.includes("If another post is there, or the command cannot tell whether it is the same one, it stops and asks."));
  // what each of those says is what happens
  assert.equal(decide({ post }).send.published, true);
  assert.equal(decide({ post, atTarget: there }).same, true);
  assert.match(decide({ post, atTarget: onSite({ slug: "notes-on-the-cache", title: "Notes on the lock", body_md: other2 }) }).refuse, /^A different post, /, "another post: it stops and asks");
  assert.match(decide({ post, atTarget: onSite({ slug: "notes-on-the-cache", title: "Notes on the cache", body_md: `${long("alpha")}\n\n${other2}` }) }).refuse, /partly the same as it and partly new/, "it cannot tell: it stops and asks");
  assert.ok(said({ published: false }).includes("it is a new post, saved as a draft."));
  assert.ok(rules({ post: file(`Notes on the cache\ndraft: yes\n\n${body3}\n`), target: "notes-on-the-cache" }).includes("it is a new post, saved as a draft."));
  assert.ok(said({ published: true }).includes("it is changed where it is, and --publish puts it out if it is a draft."));
  assert.ok(said({ published: false }).includes("it is changed where it is, and --draft makes it a draft, so a live post comes off the site."));
  assert.doesNotMatch(said({ published: false }), /stays a draft or stays live/, "with a flag given, the rule for no flag is not the one that applies");

  // --same-post never makes a post, so nothing here may say it does. it used to say both.
  const same = said({ samePost: true });
  assert.doesNotMatch(same, /it is a new post/);
  assert.doesNotMatch(same, /stops and asks/);
  assert.ok(same.includes("another spelling of that address, which keeps the spelling it has. With --same-post it changes the post at that address, where it is, and never makes a new one."), same);
  assert.ok(same.includes("It stays a draft or stays live unless --draft or --publish says otherwise. A draft: line in the file does not count then."));
  assert.ok(said({ samePost: true, published: true }).includes("never makes a new one. --publish puts it out if it is a draft."));
  assert.ok(same.includes("If nothing is there, the command stops."));
  assert.match(decide({ post, samePost: true }).refuse, /nothing is at/, "and it does stop");

  // --separate never changes a post
  const apart = said({ separate: true });
  assert.doesNotMatch(apart, /changed where it is/);
  assert.doesNotMatch(apart, /stops and asks/);
  assert.ok(apart.startsWith("It would go to https://example.test/blog/notes-on-the-cache. With --separate it goes up as a new post there, and it is published."), apart);
  assert.doesNotMatch(apart, /another spelling/, "a new post gets the address as the site makes it, and no post that is already there is gone to");
  assert.ok(apart.includes("If a post is already at that address, the command stops and says what a second post needs: its own title, its own address, or both."));
  assert.match(decide({ post, separate: true, atTarget: there }).refuse, /--separate puts this beside/);
  // which of the three it is depends on what is there, which a dry run does not know. it used to say "its own title or its own address".
  const needs = (head, titleThere) => decide({ post: file(`${head}\n\n${body3}\n`), separate: true, atTarget: onSite({ slug: "notes-on-the-cache", title: titleThere }) }).refuse.split("\n").at(-1).trim();
  assert.equal(needs("Notes on the cache", "Notes on the cache"), "For a second post, give it its own title");
  assert.equal(needs("Notes on the cache\nslug: notes-on-the-cache", "Another title"), "For a second post, give it its own address:  --slug some-other-words");
  assert.equal(needs("Notes on the cache\nslug: notes-on-the-cache", "Notes on the cache"), "For a second post, give it its own title and its own address");

  // --overwrite is the answer, so there is no question left to stop for at that address
  const over = said({ overwrite: true });
  assert.doesNotMatch(over, /stops and asks/);
  assert.ok(over.includes("If nothing is there, it is a new post, and it is published."));
  assert.ok(over.includes("With --overwrite, any other post at that address is replaced by this one as a new post: published, and dated today."));
  assert.ok(said({ overwrite: true, published: false }).includes("replaced by this one as a new post: saved as a draft, and dated the day it goes out."));
  // no line runs off the side of a terminal
  for (const o of [{}, { samePost: true }, { separate: true }, { overwrite: true }]) for (const line of dryRun({ site: SITE, post, target: "notes-on-the-cache", remembered: "an-older-address", ...o })) assert.ok(line.length <= 96, line);
});

test("a dry run says what the post a file last posted to has to do with it", () => {
  const post = file(`Notes on the queue\n\n${body3}\n`);
  const said = (over) => rules({ post, target: "notes-on-the-queue", remembered: "notes-on-the-cache", ...over });
  assert.ok(said({}).includes("This file last posted to /blog/notes-on-the-cache. Unless the post at the address above is plainly this text, that one comes first: if this text is plainly a new version of it, it is the one changed, and if it is only partly the same, the command stops and asks."));
  // which is what happens: the post at the address wins when it is plainly this text, and otherwise the remembered one is looked at first
  const cache = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache" });
  const queue = onSite({ slug: "notes-on-the-queue", title: "Notes on the queue" });
  assert.equal(decide({ post, made: cache, atTarget: queue }).existing, queue);
  assert.equal(decide({ post, made: cache }).existing, cache);
  // --overwrite does not answer the question about that post, and the dry run does not pretend it does
  assert.ok(said({ overwrite: true }).includes("the command stops and asks. --overwrite does not answer that question."));
  // --same-post: which post is changed is said exactly
  assert.ok(said({ samePost: true }).includes("This file last posted to /blog/notes-on-the-cache. That post is the one changed instead when nothing is at the address above, or when this text is at least partly that post's and the post at the address above is not plainly this text."));
  assert.ok(said({ samePost: true }).includes("If neither post is there, the command stops."));
  const partly = file(`Notes on the queue\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`);
  assert.equal(decide({ post: partly, made: cache, atTarget: onSite({ slug: "notes-on-the-queue", title: "Notes on the queue", body_md: other2 }), samePost: true }).existing, cache);
  assert.equal(decide({ post: file(`Notes on the queue\n\n${other2}\n`), made: cache, samePost: true }).existing, cache, "nothing at the address above");
  assert.equal(decide({ post, made: cache, atTarget: queue, samePost: true }).existing, queue, "the post at the address above is plainly this text");
  assert.match(decide({ post, samePost: true }).refuse, /nothing is at/, "neither is there");
  // --separate looks at neither, and says nothing about it. nor does a file that last posted to the address its title makes.
  assert.doesNotMatch(said({ separate: true }), /last posted/);
  assert.doesNotMatch(rules({ post, target: "notes-on-the-queue", remembered: "notes-on-the-queue" }), /last posted/);
});

test("a dry run of a file whose title makes no address never promises a new post", () => {
  const post = file(`!!!\n\n${body3}\n`);
  const said = (over) => rules({ post, target: "", remembered: "notes-on-the-cache", ...over });
  assert.ok(said({}).startsWith("The title makes no address, so it can only go to the post this file last posted to, /blog/notes-on-the-cache. "));
  for (const over of [{}, { samePost: true }, { separate: true }, { overwrite: true }]) assert.doesNotMatch(said(over), /it is a new post/, JSON.stringify(over));
  assert.ok(said({}).includes("If this text is plainly a new version of that post, it is changed where it is, and it stays a draft or stays live unless --draft or --publish says otherwise."));
  assert.ok(said({}).includes("If it is only partly the same, the command stops and asks."));
  assert.ok(said({}).includes("If it shares next to nothing with that post, or that post is gone, the command stops as well: a new post needs an address. Pass --slug with one."));
  assert.ok(said({ samePost: true }).includes("With --same-post that post is changed where it is, and it stays a draft or stays live unless --draft or --publish says otherwise."));
  assert.ok(said({ samePost: true }).includes("If that post is gone, the command stops."));
  assert.ok(said({ separate: true }).includes("With --separate it has to be a new post, and a new post needs an address. Pass --slug with one."));
  assert.ok(said({ overwrite: true }).includes("--overwrite replaces what is at an address, and this title makes none, so it changes nothing here."));
  // and plan() agrees: plainly the same is changed, partly the same is asked about, and nothing else has anywhere to go
  const cache = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache" });
  assert.equal(decide({ post, made: cache }).existing, cache);
  assert.equal(decide({ post, made: cache, samePost: true }).existing, cache);
  assert.match(decide({ post: file(`!!!\n\n${long("alpha")}\n\n${long("sigma")}\n\n${long("theta")}\n`), made: cache }).refuse, /partly the same/);
  assert.equal(decide({ post: file(`!!!\n\n${other2}\n`), made: cache }).send.slug, "", "a new post with no address, which the command refuses to send");
  assert.equal(decide({ post, separate: true }).send.slug, "");
});

test("a dry run of a kept copy says the rule for that kind of copy", () => {
  const copyOf = (published, why, strip = false) => {
    const text = keptCopy(onSite({ slug: "notes-on-the-cache", title: "Notes on the cache", published }), why ?? "update");
    return file(strip ? text.replace(/^kept: .*\n/m, "") : text, { copy: true });
  };
  const said = (post, over = {}) => rules({ post, target: "notes-on-the-cache", restoring: true, ...over });
  const stranger = onSite({ slug: "notes-on-the-cache", title: "Notes on the lock", body_md: other2, published: true });

  // kept before an overwrite: it asks nothing, and the dry run used to say it would
  const undoLive = said(copyOf(true, "overwrite"));
  assert.ok(undoLive.startsWith("This file is a copy the command kept. Posting it puts that version back at https://example.test/blog/notes-on-the-cache. "));
  assert.ok(undoLive.includes("It was kept before an overwrite, so it is the undo of that one: it takes the place of whatever is at that address now, without asking. It goes back live if the page there is live now, and as a draft if it is not."));
  assert.doesNotMatch(undoLive, /stops and asks/);
  assert.equal(decide({ post: copyOf(true, "overwrite"), atTarget: stranger, restoring: true }).send.published, true);
  assert.equal(decide({ post: copyOf(true, "overwrite"), atTarget: { ...stranger, published: false }, restoring: true }).send.published, false);
  const undoDraft = said(copyOf(false, "overwrite"));
  assert.ok(undoDraft.includes("without asking. It goes back as a draft."));
  assert.equal(decide({ post: copyOf(false, "overwrite"), atTarget: stranger, restoring: true }).send.published, false);
  // unless what is there is plainly its own post, where it is an older version, and a copy of a draft asks which way a live page goes
  assert.ok(undoDraft.includes("If what is there is plainly this copy's own post, it is changed as an older version of it instead, and stays a draft or stays live as it is. The copy is of a draft, so if that post is live and the copy would change its title or its text, the command stops and asks for --publish or --draft."));
  assert.equal(undoDraft.match(/stops and asks/g).length, 1, "that is the only thing it is ever asked: over any other post it goes back as a draft, without asking");
  const ownPost = onSite({ slug: "notes-on-the-cache", title: "Notes on the cache", body_md: body3.replace("alpha3", "alpha three"), published: true });
  assert.match(decide({ post: copyOf(false, "overwrite"), atTarget: ownPost, restoring: true }).refuse, /This copy is of a draft/);
  assert.doesNotMatch(undoLive, /--publish or --draft/, "a copy of a live post is never asked that");

  // kept before an update, or with no kept: line at all: asked about in the two cases the code asks
  for (const post of [copyOf(true, "update"), copyOf(true, "update", true)]) {
    const older = said(post);
    assert.ok(older.includes("It goes back as an older version of the post at that address: the post is changed where it is, and stays a draft or stays live as it is."));
    assert.ok(older.includes("If what sits at that address now is another post altogether, the command stops and asks for --overwrite instead."));
    assert.doesNotMatch(older, /without asking/);
    assert.doesNotMatch(older, /--publish or --draft/);
    assert.match(decide({ post, atTarget: stranger, restoring: true }).refuse, /--overwrite/);
  }
  // A copy of a draft is asked one of two things, and which one depends on what is there. The
  // line about --publish or --draft used to come last and speak of "the page there", so it
  // read as if it held over another post altogether too.
  const draftCopy = said(copyOf(false, "update"));
  const asksState = "This copy is of a draft. If that post is live now and the copy would change its title or its text, the command stops and asks for --publish or --draft.";
  const asksOverwrite = "If what sits at that address now is another post altogether, the command stops and asks for --overwrite instead.";
  assert.ok(draftCopy.includes(asksState), draftCopy);
  assert.ok(draftCopy.includes(asksOverwrite), draftCopy);
  assert.ok(draftCopy.indexOf(asksState) < draftCopy.indexOf(asksOverwrite), "the first is said of the copy's own post, and the second of any other post, instead");
  assert.match(decide({ post: copyOf(false, "update"), atTarget: ownPost, restoring: true }).refuse, /This copy is of a draft/);
  const overStranger = decide({ post: copyOf(false, "update"), atTarget: stranger, restoring: true }).refuse;
  assert.match(overStranger, /add {2}--overwrite/);
  assert.doesNotMatch(overStranger, /This copy is of a draft|add {2}--publish|add {2}--draft/, "over another post altogether it is the other question, and only that one");
  // and --overwrite answers it with nothing more to ask, though the copy is of a draft and the page is live
  const withOverwrite = said(copyOf(false, "update"), { overwrite: true });
  assert.ok(withOverwrite.includes("With --overwrite, another post altogether at that address is replaced by this copy instead, which goes back as a draft unless --publish is added."), withOverwrite);
  assert.ok(withOverwrite.indexOf(asksState) < withOverwrite.indexOf("With --overwrite, another post altogether"));
  assert.equal(decide({ post: copyOf(false, "update"), atTarget: stranger, restoring: true, overwrite: true }).send.published, false);
  assert.equal(decide({ post: copyOf(true, "update"), atTarget: stranger, restoring: true, overwrite: true }).send.published, false);
  assert.ok(said(copyOf(true, "update"), { overwrite: true, published: true }).includes("With --overwrite, another post altogether at that address is replaced by this copy instead."));
  // every kind: nothing live by itself, and what a flag does instead
  for (const post of [copyOf(true, "overwrite"), copyOf(false, "update"), copyOf(true, "update", true)]) {
    assert.ok(said(post).includes("It never makes a post live by itself."));
    assert.ok(said(post).includes("If nothing is at that address any more, the post comes back as a draft."));
    assert.ok(said(post, { published: true }).includes("With --publish it goes back live."));
    assert.ok(said(post, { published: true }).includes("If nothing is at that address any more, the post comes back live."));
    assert.doesNotMatch(said(post, { published: true }), /stays a draft|--publish or --draft|by itself|as a draft/);
    assert.ok(said(post, { published: false }).includes("With --draft it goes back as a draft, and a live page there comes off the site."));
    assert.ok(said(post, { samePost: true }).includes("--same-post does not go with a kept copy, so the command would stop. Leave it off."));
    assert.ok(said(post, { separate: true }).includes("--separate does not go with a kept copy, so the command would stop. Leave it off."));
    for (const line of dryRun({ site: SITE, post, target: "notes-on-the-cache", restoring: true })) assert.ok(line.length <= 96, line);
  }
  assert.equal(decide({ post: copyOf(true, "overwrite"), restoring: true }).send.published, false, "nothing there: back as a draft");
  assert.equal(decide({ post: copyOf(true, "overwrite"), restoring: true, published: true }).send.published, true);
});
