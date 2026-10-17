// npm test
// What a plain text file has to turn into before it is allowed anywhere near the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { textToPost, autoSummary, slugify, keptCopy, version, secondCopy, sameTitle, isDay, tidyTags } from "./post-text.mjs";

// thirty different words on one long line, the way a paragraph looks when the editor does not wrap
const long = (seed) => Array.from({ length: 30 }, (_, i) => `${seed}${i}`).join(" ") + ".";

test("the first line is the title, and a leading # is dropped", () => {
  const p = textToPost("# My first post\n\nHello there. This is it.\n");
  assert.equal(p.title, "My first post");
  assert.equal(p.body_md, "Hello there. This is it.");
});

test("a row of equals signs under the title is thrown away", () => {
  const p = textToPost("My first post\n=============\n\nHello there.\n");
  assert.equal(p.title, "My first post");
  assert.equal(p.body_md, "Hello there.");
});

test("blank lines separate paragraphs", () => {
  assert.equal(textToPost("Title\n\nOne.\n\n\n\nTwo.\n").body_md, "One.\n\nTwo.");
});

test("a short line with no full stop, standing alone, becomes a heading", () => {
  const p = textToPost("Title\n\nAn opening paragraph.\n\nWhy it broke\n\nIt broke because of the cache.\n");
  assert.equal(p.body_md, "An opening paragraph.\n\n## Why it broke\n\nIt broke because of the cache.");
  assert.deepEqual(p.headings, ["Why it broke"]);
});

test("a line that is only bold becomes a heading without the stars", () => {
  const p = textToPost("Title\n\nAn opening paragraph.\n\n**Why it broke**\n\nIt broke.\n");
  assert.match(p.body_md, /\n\n## Why it broke\n\n/);
});

test("the last line is never a heading, and neither is a sentence", () => {
  const last = textToPost("Title\n\nAn opening paragraph.\n\nThanks for reading\n");
  assert.doesNotMatch(last.body_md, /##/);
  const sentence = textToPost("Title\n\nAn opening paragraph.\n\nThat is it.\n\nAnd some more after it.\n");
  assert.doesNotMatch(sentence.body_md, /##/);
});

test("a link or a lower case aside on its own line is not a heading", () => {
  const p = textToPost("Title\n\nAn opening paragraph.\n\nhttps://example.com/thing\n\nand that was that\n\nThe end of it.\n");
  assert.doesNotMatch(p.body_md, /##/);
});

test("short lines that are not headings are left as they are", () => {
  const cases = [
    // a remark in brackets
    "Title\n\nAn opening paragraph.\n\nIt worked (mostly)\n\nAnd then the rest of the story goes here.\n",
    // a dateline straight under the title
    "Title\n\nPune, October 2026\n\nThe post proper starts here and carries on for a while.\n",
    // a pasted line of numbers
    "Title\n\nAn opening paragraph.\n\nBenchmarkGenerate-8   2889   412700 ns/op   421 allocs/op\n\nThat is the line that matters.\n",
    // a sign off: two short lines in a row are a sign off, not two headings
    "Title\n\nAn opening paragraph.\n\nThanks to everyone who reviewed this\n\nSaharsh\n\nP.S. I will write up the numbers next week.\n",
  ];
  for (const input of cases) assert.doesNotMatch(textToPost(input).body_md, /##/, JSON.stringify(input));
});

test("one paragraph per line, with no blank lines between, still gives paragraphs", () => {
  const a = long("alpha"), b = long("beta");
  assert.equal(textToPost(`Title\n${a}\n${b}\n`).body_md, `${a}\n\n${b}`);
});

test("short notes, one per line with no blank lines, are separate paragraphs", () => {
  const notes = [
    "The first note is about the cache and why it was never cleared.",
    "The second note is about the lock and who was holding it then.",
    "The third note is about the retry and why it made things worse.",
    "The fourth note is about the fix, which was three lines in all.",
  ];
  assert.equal(textToPost(`Title\n${notes.join("\n")}\n`).body_md, notes.join("\n\n"));
});

test("a heading between unspaced paragraphs is still found", () => {
  const a = long("alpha"), b = long("beta");
  assert.equal(textToPost(`Title\n${a}\nWhat changed\n${b}\n`).body_md, `${a}\n\n## What changed\n\n${b}`);
});

test("paragraphs wrapped at a fixed width are left as they are", () => {
  const wrapped = [
    "This paragraph was typed in an editor that breaks every line at a",
    "fixed width, the way email and terminals have always done it, and",
    "none of those breaks mean anything at all to the person reading.",
  ].join("\n");
  const p = textToPost(`Title\n\n${wrapped}\n\nA second paragraph that is short.\n`);
  assert.equal(p.body_md, `${wrapped}\n\nA second paragraph that is short.`);
});

test("one long line somewhere does not break up the wrapped paragraphs around it", () => {
  const wrapped = [
    "I spent a week reading one function. It runs on every single",
    "web request, and it claimed memory three times before doing",
    "any work at all.",
    "OpenTelemetry calls this the hot path, and the people who",
    "run it at scale notice when it gets heavier.",
  ].join("\n");
  const link = "The code is [here](https://github.com/open-telemetry/opentelemetry-go-compile-instrumentation/blob/main/pkg/instrumentation/nethttp/server/handler.go).";
  const p = textToPost(`Title\n\n${wrapped}\n\n${link}\n\nThe fix was small.\n`);
  assert.equal(p.body_md, `${wrapped}\n\n${link}\n\nThe fix was small.`);
  assert.deepEqual(p.headings, []);
  assert.equal(p.excerpt, "I spent a week reading one function. It runs on every single web request, and it claimed memory three times before doing any work at all.");
});

test("a paragraph indented with a tab is a paragraph, and indented code is still code", () => {
  const prose = textToPost("Title\n\n\tFirst paragraph, starting with a tab the way a typewriter would.\n\n\tSecond paragraph, the same as the first one was.\n");
  assert.equal(prose.body_md, "First paragraph, starting with a tab the way a typewriter would.\n\nSecond paragraph, the same as the first one was.");
  assert.equal(prose.excerpt, "First paragraph, starting with a tab the way a typewriter would.");
  const code = textToPost("Title\n\nRun this and read the last line.\n\n    go test -bench=. ./internal/\n\nThat is all.\n");
  assert.match(code.body_md, /\n\n    go test -bench=\. \.\/internal\/\n\n/);
});

test("markdown that is already there is left alone, code included", () => {
  const body = "## Existing heading\n\n- one\n- two\n\n```\nshort line\n\nAnother Short Line\n```\n\nThe end of it.";
  const p = textToPost(`Title\n\n${body}\n`);
  assert.equal(p.body_md, body);
  assert.deepEqual(p.headings, ["Existing heading"]);
});

test("two spaces at the end of a line, which markdown reads as a line break, survive", () => {
  const address = "Saharsh Tibrewala  \nPune, India  \nOctober 2026";
  assert.equal(textToPost(`Title\n\nAn opening paragraph.\n\n${address}\n\nThe end of it.\n`).body_md, `An opening paragraph.\n\n${address}\n\nThe end of it.`);
});

test("a table typed without the outer bars is kept together and is not a heading", () => {
  const table = "Name | Before | After\n--- | --- | ---\nallocations | 421 | 2";
  const p = textToPost(`Title\n${long("alpha")}\n${table}\n${long("beta")}\n`);
  assert.equal(p.body_md, `${long("alpha")}\n\n${table}\n\n${long("beta")}`);
  assert.deepEqual(p.headings, []);
});

test("bullets typed with a dot become a list", () => {
  assert.equal(textToPost("Title\n\nThree things:\n\n• one\n• two\n").body_md, "Three things:\n\n- one\n- two");
});

test("lines straight under the title can carry tags, a summary and draft", () => {
  const p = textToPost("Title\ntags: go, OpenTelemetry\nsummary: A short one.\ndraft: yes\n\nBody text here.\n");
  assert.deepEqual(p.tags, ["go", "OpenTelemetry"]);
  assert.equal(p.excerpt, "A short one.");
  assert.equal(p.draft, true);
  assert.equal(p.body_md, "Body text here.");
  assert.deepEqual(p.given, { tags: true, summary: true, slug: false, draft: true, cover: false });
});

test("a first sentence that only looks like one of those lines stays in the post", () => {
  const p = textToPost("Notes on drafts\nDraft: the first one is always the worst, and that is fine.\nTags: these are not tags. They are a sentence about tags.\n\nThe second paragraph.\n");
  assert.equal(p.draft, false);
  assert.deepEqual(p.tags, []);
  assert.match(p.body_md, /^Draft: the first one is always the worst/);
  assert.match(p.body_md, /Tags: these are not tags/);
  assert.deepEqual(p.given, { tags: false, summary: false, slug: false, draft: false, cover: false });
});

test("what is passed on the command line wins over the file, and with a title given the whole file is the post", () => {
  const p = textToPost("The first line here is just a sentence.\n\nBody two.\n", { title: "Given", tags: ["x"], summary: "Mine." });
  assert.equal(p.title, "Given");
  assert.equal(p.body_md, "The first line here is just a sentence.\n\nBody two.");
  assert.deepEqual(p.tags, ["x"]);
  assert.equal(p.excerpt, "Mine.");
  assert.equal(p.draft, false);
  assert.deepEqual(p.warnings.filter((w) => /title passed in/.test(w)), []);
});

test("with a title given, a file that has setting lines of its own is refused, because a draft would go out", () => {
  // under the file's own first line: this one used to publish, with draft: yes as its opening words
  assert.throws(() => textToPost("Half a thought about caches\ndraft: yes\ntags: go, caches\n\nThe first paragraph.\n", { title: "Caches, half thought through" }), /draft: yes/);
  // and at the very top
  assert.throws(() => textToPost("tags: left alone\n\nBody two.\n", { title: "Given" }), /tags: left alone/);
  // a sentence that only starts like one is still a sentence
  assert.doesNotThrow(() => textToPost("Summary: this is about caches, mostly.\n\nBody two.\n", { title: "Given" }));
  assert.doesNotThrow(() => textToPost("Draft: the first one is always the worst.\n\nBody two.\n", { title: "Given" }));
});

test("with a title given, a first line that was written as a title is pointed out", () => {
  const p = textToPost("My working title\n\nThe first paragraph of the post is a sentence.\n", { title: "A better title" });
  assert.equal(p.title, "A better title");
  assert.match(p.body_md, /^My working title/);
  assert.ok(p.warnings.some((w) => w.includes('"My working title"')), "nothing said about the old title line");
});

test("a file marked as markdown is passed through untouched", () => {
  const body = "Short intro line\n\nA paragraph that the desk user wrapped\nover two lines\n\n**Note**\n\n" + long("gamma") + "\n\nThe end.";
  const p = textToPost(`A post from the desk\nslug: What_OTel\ndraft: yes\nformat: markdown\n\n${body}\n`);
  assert.equal(p.body_md, body);
  assert.equal(p.slug, "What_OTel");
  assert.equal(p.draft, true);
});

test("with no summary given, one is cut from the opening at the end of a sentence", () => {
  const opening = "This is the first sentence of the post and it is a fairly ordinary length. " +
    "This is the second sentence, which pushes the paragraph a good way past the limit for a summary. " +
    "This is the third sentence and it should never be seen in the summary at all.";
  const p = textToPost(`Title\n\n${opening}\n\nMore.\n`);
  assert.ok(p.excerpt.length <= 200, `summary is ${p.excerpt.length} long`);
  assert.ok(opening.startsWith(p.excerpt));
  assert.match(p.excerpt, /\.$/);
  assert.equal(autoSummary(p.body_md), p.excerpt, "the summary can be worked out again from the stored post");
});

test("the summary carries no markdown, keeps names with underscores whole, and does not stop at an abbreviation", () => {
  assert.equal(textToPost("Title\n\nThis has a [link](https://x.example) and **bold** and `code` in it.\n").excerpt, "This has a link and bold and code in it.");
  assert.equal(
    textToPost("Title\n\nThe fix was to cast the config in to_tsvector and wrap array_to_string, then set BLOG_STORE again.\n").excerpt,
    "The fix was to cast the config in to_tsvector and wrap array_to_string, then set BLOG_STORE again.",
  );
  const opening = "Some of this code is far worse than the rest, e.g. the part that runs once for every single request and claims memory each time it does. " +
    "That part is what this post is about, and it takes a while to explain properly so bear with me.";
  assert.doesNotMatch(textToPost(`Title\n\n${opening}\n`).excerpt, /e\.g\.$/);
});

test("a doubled word has to be inside one paragraph to count", () => {
  const none = (text) => assert.deepEqual(textToPost(text).warnings.filter((w) => /Doubled/.test(w)), []);
  none("Notes on Go\n\nGo is the language most of this is written in, and it shows in places.\n");
  none("Title\n\nA first paragraph that says something at reasonable length here.\n\nResults\n\nResults came in on the Tuesday, and they were better than anyone expected.\n");
  // across one line break it is still the same sentence
  const wrapped = textToPost("Title\n\nThis sentence was wrapped by the editor right at the point where the\nthe word was typed twice by mistake, which happens to everybody.\n\nA second paragraph of ordinary length, so that the file has a blank line in it.\n");
  assert.match(wrapped.body_md, /where the\nthe word/, "the wrapped paragraph stayed one paragraph");
  assert.ok(wrapped.warnings.some((w) => w.includes('"the the"')));
});

test("each dash warning can stand alone", () => {
  const only = (text) => textToPost(text).warnings.filter((w) => /dash|hyphen/.test(w));
  assert.deepEqual(only("Title\n\nOne thing - and another thing, said at some length in this line.\n"), ["1 hyphen used as a dash. The site keeps dashes out of prose."]);
  assert.deepEqual(only("Title\n\nOne thing -- and another thing, said at some length in this line.\n"), ["1 place where two hyphens stand in for a dash. The site keeps dashes out of prose."]);
  const both = only("Title\n\nOne thing - and another -- said at some length in this line of text.\n");
  assert.equal(both.length, 2);
  assert.match(both[0], /keeps dashes out of prose/);
  assert.match(both[1], /Same rule\.$/);
});

test("dashes and doubled words are pointed out, not silently posted", () => {
  const p = textToPost("Title\n\nThis is the the thing — really. It is here - and there. It broke -- twice -- and nobody noticed.\n");
  assert.ok(p.warnings.some((w) => /em or en dash/i.test(w)), "no dash warning");
  assert.ok(p.warnings.some((w) => /hyphen/i.test(w)), "no hyphen warning");
  assert.ok(p.warnings.some((w) => /two hyphens/i.test(w)), "no double hyphen warning");
  assert.ok(p.warnings.some((w) => w.includes("the the")), "no doubled word warning");
});

test("clean text raises nothing, and a flag written in prose is not a dash", () => {
  const p = textToPost(`Title\n\n${long("word")}\n\nRun it with --draft first, then again with --publish when it reads well.\n`);
  assert.deepEqual(p.warnings, []);
});

test("words and minutes match the way the site counts them", () => {
  const p = textToPost(`Title\n\n${"word ".repeat(440).trim()}.\n`);
  assert.equal(p.words, 440);
  assert.equal(p.minutes, 2);
});

test("an empty file is refused", () => {
  assert.throws(() => textToPost("   \n\n"), /empty/i);
  assert.throws(() => textToPost("Only a title\n"), /nothing under the title/i);
});

test("the address made from a title matches the one the site makes", () => {
  // the same rule as slugify in lib/posts.ts. if that changes, this has to.
  assert.equal(slugify("What OpenTelemetry actually is"), "what-opentelemetry-actually-is");
  assert.equal(slugify("C++ in production!"), "c-in-production");
  assert.equal(slugify("  --Hello,   World--  "), "hello-world");
  assert.equal(slugify("x".repeat(100)).length, 80);
});

// ---- found by the second review ----

test("a tag may hold a full stop, and the settings under it still count", () => {
  const p = textToPost("Notes on streams\ntags: go, node.js\ndraft: yes\n\nThe first paragraph of the post is here and it is a sentence.\n\nThe second paragraph.\n");
  assert.deepEqual(p.tags, ["go", "node.js"]);
  assert.equal(p.draft, true);
  assert.match(p.body_md, /^The first paragraph/);
});

test("a setting that cannot be read stops the post instead of being published as its first line", () => {
  assert.throws(
    () => textToPost("Notes on streams\nslug: notes on streams\ndraft: yes\n\nThe first paragraph of the post is here and it is a sentence.\n"),
    /slug: notes on streams/,
  );
});

test("settings still count with a blank line between them and the title", () => {
  const p = textToPost("Notes on streams\n\ntags: go, streams\ndraft: yes\n\nThe first paragraph of the post is here and it is a sentence.\n\nThe second paragraph.\n");
  assert.deepEqual(p.tags, ["go", "streams"]);
  assert.equal(p.draft, true);
  assert.match(p.body_md, /^The first paragraph/);
});

test("a sign off at the very end is not a heading either", () => {
  for (const end of ["Thanks to everyone who reviewed this\n\nSaharsh\n", "Thanks for reading\n\nSaharsh\n", "Best wishes\n\nSaharsh\n"]) {
    assert.doesNotMatch(textToPost(`Title\n\nAn opening paragraph.\n\n${end}`).body_md, /##/, end);
  }
});

test("indented code stays code even when it opens with a comment that reads like a sentence", () => {
  const p = textToPost("Title\n\nRun this and read the last column.\n\n    # Run the benchmark ten times and keep the last column.\n    go test -bench=. -count=10 ./internal/\n\nThat is the whole of it.\n");
  assert.match(p.body_md, /\n\n    # Run the benchmark ten times and keep the last column\.\n    go test/);
  assert.deepEqual(p.headings, []);
});

test("a file where every paragraph is indented is a typewriter file, whatever the punctuation", () => {
  const p = textToPost("Title\n\n\tI spent a week reading one function; it runs on every single web request.\n\n\tTwo parts matter.\n\n\tThe first is the tag, which every request carries with it.\n");
  assert.equal(p.body_md, "I spent a week reading one function; it runs on every single web request.\n\nTwo parts matter.\n\nThe first is the tag, which every request carries with it.");
  assert.equal(p.excerpt, "I spent a week reading one function; it runs on every single web request.");
});

test("an indent on only the first line of a paragraph is a paragraph indent", () => {
  const p = textToPost("Title\n\n    The first line of this wrapped paragraph is indented and\nthe second line is not, the way a book sets it.\n\nA plain paragraph follows it.\n");
  assert.equal(p.body_md, "The first line of this wrapped paragraph is indented and\nthe second line is not, the way a book sets it.\n\nA plain paragraph follows it.");
});

test("a row of dashes straight under a paragraph is a rule, not a way to make the paragraph a heading", () => {
  const p = textToPost("Title\n\nThis paragraph was typed in an editor that breaks every line at a\nfixed width, the way email and terminals have always done it.\n-----\nSecond paragraph, also a sentence.\n\nThird.\n");
  assert.equal(p.body_md, "This paragraph was typed in an editor that breaks every line at a\nfixed width, the way email and terminals have always done it.\n\n---\n\nSecond paragraph, also a sentence.\n\nThird.");
  assert.deepEqual(p.headings, []);
  assert.doesNotMatch(p.excerpt, /-/);
  const eq = textToPost("Title\n\nFirst paragraph here, which is a sentence.\n=====\nSecond paragraph, also a sentence.\n\nThird.\n");
  assert.equal(eq.body_md, "First paragraph here, which is a sentence.\n\nSecond paragraph, also a sentence.\n\nThird.");
});

test("a short line underlined with dashes or equals signs is the heading the writer meant", () => {
  const p = textToPost("Title\n\nAn opening paragraph.\n\nWhy it broke\n------------\n\nIt broke because of the cache.\n");
  assert.equal(p.body_md, "An opening paragraph.\n\n## Why it broke\n\nIt broke because of the cache.");
  assert.deepEqual(p.headings, ["Why it broke"]);
});

test("a wrapped paragraph stays whole even when one of its lines runs long", () => {
  const para = "Someone asked me what I actually work on, and I said OpenTelemetry,\nand they nodded in the way people nod when they have decided not to ask a second question, which is what people always do when they hear it,\nso here is the answer I should have given them.";
  const p = textToPost(`Title\n\n${para}\n\nThe end of it.\n`);
  assert.equal(p.body_md, `${para}\n\nThe end of it.`);
});

test("the name under a quote stays with the quote", () => {
  const quote = "> Clear is better than clever, and it is also much easier to review afterwards, which matters more than people who write clever code ever seem to admit.\nRob Pike, more or less";
  const p = textToPost(`Title\n\nAn opening paragraph.\n\n${quote}\n\nThe end of it.\n`);
  assert.equal(p.body_md, `An opening paragraph.\n\n${quote}\n\nThe end of it.`);
  assert.deepEqual(p.headings, []);
});

test("a paragraph that opens with a year is not turned into a numbered list", () => {
  const p = textToPost("Title\n\n2019. That was the year the project stopped being somebody's side project.\n\nMore after it.\n");
  assert.match(p.body_md, /^2019\\\. That was the year/);
});

test("a file that is not UTF-8 is refused rather than posted with broken characters", () => {
  assert.throws(() => textToPost("What I\uFFFDd do differently\n\n\uFFFDIt worked,\uFFFD she said.\n"), /UTF-8/);
  assert.throws(() => textToPost("W\u0000h\u0000a\u0000t\u0000\n\nBody.\n"), /UTF-8/);
});

test("a kept copy of a post comes back exactly as the site had it, however awkward the post", () => {
  const awkward = [
    { title: "# of allocations, 421 to 2", slug: "go-1.25-notes", published: false, tags: ["go", "node.js"], excerpt: "A summary\nover two lines.", body_md: "tags: this first line only looks like a setting\n\nShort intro line\n\n**Note**\n\nThe end." },
    { title: "Title: with a colon", slug: "Go Notes", published: true, tags: [], excerpt: null, body_md: "    indented first line that is code\n\nA paragraph.\n\nWhy it broke\n\nAnother paragraph." },
    { title: "draft: yes", slug: "x", published: true, tags: ["a tag that runs to more than four words"], excerpt: "tags: looks like a setting", body_md: "One." },
  ];
  for (const post of awkward) {
    const back = textToPost(keptCopy(post));
    assert.equal(back.title, post.title);
    assert.equal(back.slug, post.slug);
    assert.equal(back.draft, !post.published);
    assert.deepEqual(back.tags, post.tags);
    assert.equal(back.given.tags, true, "the tags line is always written, so an empty list clears them");
    assert.equal(back.given.summary ? back.excerpt : null, post.excerpt ? post.excerpt.replace(/\s+/g, " ") : null);
    assert.equal(back.body_md, post.body_md);
  }
});

// ---- found by the third review ----

test("a draft line that starts like yes or no but is not one stops the post, even standing alone", () => {
  assert.throws(() => textToPost("Half a thought about caches\ndraft: yes, not ready\n\nThe first paragraph of the post is here and it is a sentence.\n"), /draft: yes, not ready/);
  // and a sentence that merely begins with the word is still a sentence
  assert.equal(textToPost("Notes on drafts\nDraft: the first one is always the worst.\n\nThe second paragraph.\n").draft, false);
});

test("the word count and the minutes are the ones the site will show", () => {
  // lib/posts.ts turns hyphens into spaces before it counts, so a hyphenated name is two words there
  const p = textToPost("Title\n\nThe change went into opentelemetry-go and resource-state-metrics last week.\n");
  assert.equal(p.words, 12);
});

test("a kept copy says why it was kept, and plain line endings", () => {
  const post = { title: "A post", slug: "a-post", published: true, tags: [], excerpt: null, body_md: "One line\r\nand the next.\r\n\r\nA second paragraph." };
  assert.equal(textToPost(keptCopy(post)).kept, "update");
  assert.equal(textToPost(keptCopy(post, "overwrite")).kept, "overwrite");
  assert.equal(textToPost(keptCopy(post)).body_md, "One line\nand the next.\n\nA second paragraph.");
  assert.equal(textToPost("Title\n\nBody text here.\n").kept, undefined);
});

test("a kept copy carries the day the post first went out and its cover", () => {
  const post = { title: "A post", slug: "a-post", published: true, tags: ["go"], excerpt: "Short.", body_md: "One paragraph.", published_at: "2026-08-28T21:22:05.913Z", cover_url: "https://example.com/c.png" };
  const back = textToPost(keptCopy(post));
  assert.equal(back.date, "2026-08-28T21:22:05.913Z");
  assert.equal(back.cover, "https://example.com/c.png");
  const bare = textToPost(keptCopy({ ...post, published_at: null, cover_url: null }));
  assert.equal(bare.date, undefined);
  assert.equal(bare.cover, "");
  assert.equal(bare.given.cover, true, "an empty cover line clears a cover on the way back");
});

test("a later version of a text is recognised by its words, not by untouched paragraphs", () => {
  const post = `${long("alpha")}\n\n${long("gamma")}\n\n${long("omega")}`;
  assert.equal(version(post, post), "same");
  // a typo fixed in every paragraph: no paragraph is untouched, and it is plainly the same post
  assert.equal(version(post, post.replace("alpha3", "alpha three").replace("gamma3", "gamma three").replace("omega3", "omega three")), "same");
  // the desk stores the line endings a browser sends, and dashes come out when the site asks
  assert.equal(version(post.replace(/\n/g, "\r\n"), post), "same");
  assert.equal(version("One thing \u2014 and another thing, said at some length here.", "One thing, and another thing, said at some length here."), "same");
  // added to at the end: all of the old text is still there
  assert.equal(version(post, `${post}\n\n${long("delta")}\n\n${long("kappa")}`), "same");
  assert.equal(version(post, `${long("delta")}\n\n${long("kappa")}`), "different");
});

test("a short text is the same only when it is word for word the same", () => {
  const tiny = "The cache was never cleared, and for three weeks nobody noticed.\n\nThe fix was three lines.";
  assert.equal(version(tiny, tiny), "same", "identical text is the same text, however short");
  // two short posts whose only long line is the sign off they share
  const closing = "If I got something wrong, write to me and I will fix it straight away.";
  assert.equal(version(`Shipped the fix.\n\nSlept well.\n\n${closing}`, `Broke it again.\n\nSlept badly.\n\n${closing}`), "unsure");
});

test("anything in between is not guessed at", () => {
  const old = ["a", "b", "c", "d", "e"].map(long).join("\n\n");
  // a new short post that quotes one paragraph of the old one
  const quoting = `Last month I wrote this:\n\n${long("c")}\n\nThat number was wrong, and this is the right one.`;
  assert.equal(version(old, quoting), "unsure", "most of the new text is old, but most of the old post is gone");
  // half rewritten
  assert.equal(version(`${long("a")}\n\n${long("b")}\n\n${long("c")}`, `${long("a")}\n\n${long("x")}\n\n${long("y")}`), "unsure");
  // a text with nothing in it has nothing to lose
  assert.equal(version("", old), "same");
});

test("the site calls it a second copy when either text holds most of the other", () => {
  const old = ["a", "b", "c", "d", "e"].map(long).join("\n\n");
  assert.equal(secondCopy(old, old.replace("a3", "a three")), true, "a corrected copy");
  assert.equal(secondCopy(old, `${long("b")}\n\n${long("c")}`), true, "a cut down copy");
  assert.equal(secondCopy(old, `Last month I wrote this:\n\n${long("c")}\n\nThat number was wrong.`), true, "a short post that is mostly a quote of it");
  assert.equal(secondCopy(old, ["v", "w", "x", "y", "z"].map(long).join("\n\n")), false, "a different post");
  // a long new post that quotes one paragraph of it is its own post
  assert.equal(secondCopy(old, ["p", "q", "r", "s", "t", "u", "v", "w", "c"].map(long).join("\n\n")), false);
  const closing = "If I got something wrong, write to me and I will fix it straight away.";
  assert.equal(secondCopy(`Shipped the fix.\n\n${closing}`, `Broke it again.\n\n${closing}`), false, "a shared sign off");
});

test("two titles that make the same address are the same title", () => {
  assert.equal(sameTitle("Notes on Go", "Notes on Go!"), true);
  assert.equal(sameTitle("notes on go", " Notes on Go "), true);
  assert.equal(sameTitle("Teh cache that never emptied", "The cache that never emptied"), false);
  assert.equal(sameTitle("!!!", "???"), false, "two titles with nothing to make an address from are not thereby the same");
});

test("a date line and a cover line are read as settings only when they look like one", () => {
  const p = textToPost("Title\ndate: 2026-08-28\ncover: https://example.com/a.png\n\nBody text here.\n");
  assert.equal(p.date, "2026-08-28");
  assert.equal(p.cover, "https://example.com/a.png");
  assert.equal(p.given.cover, true);
  assert.equal(p.body_md, "Body text here.");
  const prose = textToPost("Title\nDate: sometime in March, I think.\nCover: the story so far.\n\nBody text here.\n");
  assert.equal(prose.date, undefined);
  assert.equal(prose.given.cover, false);
  assert.match(prose.body_md, /^Date: sometime in March/);
  assert.throws(() => textToPost("Title\ntags: go\ndate: 31 August\n\nBody.\n"), /date: 31 August/);
  assert.throws(() => textToPost("Title\ntags: go\ndate: 2026-13-45\n\nBody.\n"), /date: 2026-13-45/);
});

test("a date has to be a real day, and a time has to say its zone", () => {
  assert.equal(isDay("2026-08-28"), true);
  assert.equal(isDay("2024-02-29"), true);
  assert.equal(isDay("2026-08-28T21:22:05.913Z"), true);
  assert.equal(isDay("2026-08-28T23:30:00-05:00"), true);
  assert.equal(isDay("2026-02-30"), false, "there is no 30 February, and Date.parse says 2 March");
  assert.equal(isDay("2026-04-31"), false);
  assert.equal(isDay("2026-08-28T10:00"), false, "this machine and the server would each read it in their own zone");
  // standing alone under the title it still stops the post. as a sentence it would go out dated today.
  assert.throws(() => textToPost("Title\ndate: 2026-02-30\n\nBody text here.\n"), /date: 2026-02-30/);
  assert.throws(() => textToPost("Title\ndate: 2026-08-28T10:00\n\nBody text here.\n"), /real day/);
});

test("a cover can be a path on the site as well as an address", () => {
  assert.equal(textToPost("Title\ncover: /covers/cache.png\n\nBody text here.\n").cover, "/covers/cache.png");
  const odd = textToPost("Title\ncover: //elsewhere.example/a.png\n\nBody text here.\n");
  assert.equal(odd.given.cover, false, "two slashes is another site, not a path on this one");
});

// ---- found by the fifth review ----

test("settings under a blank line are protected the way they are straight under the title", () => {
  // one slip beside a real setting: this used to publish, with both lines as the opening
  assert.throws(() => textToPost("Notes on streams\n\ndraft: yes\nslug: notes on streams\n\nThe first paragraph.\n"), /slug: notes on streams/);
  assert.throws(() => textToPost("Half a thought\n\ndraft: yes, not ready\n\nThe first paragraph.\n"), /draft: yes, not ready/);
  assert.throws(() => textToPost("A dated post\n\ndraft: yes\ndate: 2026-02-30\n\nThe first paragraph.\n"), /date: 2026-02-30/);
  // the advice has to fit where the line is. "put a blank line above it" would change nothing here.
  assert.throws(() => textToPost("Half a thought\n\ndraft: yes, not ready\n\nThe first paragraph.\n"), /under a blank line.*\n.*\n.*\n.*word it another way/);
  // a draft line with the text straight under it is still a draft
  const run = textToPost("Half a thought\n\ndraft: yes\nThe first paragraph starts on the very next line.\n");
  assert.equal(run.draft, true);
  assert.equal(run.body_md, "The first paragraph starts on the very next line.");
  const both = textToPost("Half a thought\n\nsummary: Not ready yet.\ndraft: yes\n\nThe first paragraph.\n");
  assert.equal(both.draft, true);
  assert.equal(both.excerpt, "Not ready yet.");
});

test("a paragraph that only opens like a setting is still a paragraph", () => {
  const p = textToPost("What we shipped\n\nSummary: we shipped it.\nAnd then we went home, which was the plan all along.\n\nMore after it.\n");
  assert.match(p.body_md, /^Summary: we shipped it\./);
  assert.equal(p.given.summary, false);
  // a lone summary line under a blank line is the first paragraph, not a setting
  assert.match(textToPost("Title\n\nsummary: this one is a sentence\n\nBody text here.\n").body_md, /^summary: this one is a sentence/);
  assert.match(textToPost("Notes on drafts\n\nDraft: the first one is always the worst.\n\nThe second paragraph.\n").body_md, /^Draft: the first one/);
});

test("draft and date are checked even where every other value is taken as written", () => {
  // format: markdown above a slipped draft line used to swallow it and publish
  assert.throws(() => textToPost("Half a thought\nformat: markdown\ndraft: yes, not ready\n\nThe text.\n"), /draft: yes, not ready/);
  assert.throws(() => textToPost("Half a thought\nformat: markdown\ndate: 2026-02-30\n\nThe text.\n"), /date: 2026-02-30/);
  // a kept copy still carries an address and a tag no ordinary file could
  const back = textToPost(keptCopy({ title: "T", slug: "Go Notes", published: false, tags: ["a tag that runs to more than four words"], excerpt: null, body_md: "One." }));
  assert.equal(back.slug, "Go Notes");
  assert.equal(back.draft, true);
});

test("with a title given, settings are looked for everywhere the file could have put them", () => {
  const given = { title: "Caches, half thought through" };
  assert.throws(() => textToPost("Half a thought about caches\n\ndraft: yes\ntags: go\n\nThe first paragraph.\n", given), /draft: yes/);
  assert.throws(() => textToPost("Half a thought about caches\nsummary: Not ready yet.\ndraft: yes\n\nThe first paragraph.\n", given), /draft: yes/);
  assert.throws(() => textToPost("Half a thought about caches\n\n\ndraft: yes, not ready\n\nThe first paragraph.\n", given), /draft: yes, not ready/);
  assert.doesNotThrow(() => textToPost("Half a thought about caches\n\nSummary: we shipped it.\nAnd then we went home.\n", given));
});

test("a date that is not a moment answers no, and never throws", () => {
  for (const v of ["0001-01-32", "0001-01-00", "0012-12-99", "0000-06-15", "2026-08-28T25:00Z", "1969-12-31", "2201-01-01", "", "2026-8-28"]) assert.equal(isDay(v), false, v);
  assert.equal(isDay(20260828), false);
  for (const v of ["1970-01-01", "2026-08-28", "2026-08-28T21:22:05.913Z", "2200-12-31"]) assert.equal(isDay(v), true, v);
});

test("an address made twice is the same address, and has no dash on the end", () => {
  const title = "What I learned from three weeks of watching a cache that never emptied on every request";
  const once = slugify(title);
  assert.equal(once.endsWith("-"), false);
  assert.equal(slugify(once), once);
  assert.ok(once.length <= 80);
  for (const t of ["OTel_Notes.v2", "  Notes on Go!  ", "a".repeat(200), "x-".repeat(60)]) assert.equal(slugify(slugify(t)), slugify(t), t);
});

test("tags are tidied one way everywhere: trimmed, no blanks, no repeats, eight at most", () => {
  assert.deepEqual(tidyTags([" go ", "caches", "", "go", "memory"]), ["go", "caches", "memory"]);
  assert.equal(tidyTags(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]).length, 8);
  assert.deepEqual(textToPost("Title\ntags: go, caches, go\n\nBody text here.\n").tags, ["go", "caches"]);
});

test("a text written without spaces is compared a character at a time", () => {
  const ja = "キャッシュは一度も消されず、三週間誰も気づきませんでした。リクエストのたびに大きくなり続けていました。修正は三行でした。リクエストが終わるときにエントリを削除します。";
  assert.equal(version(ja, ja.replace("三週間", "四週間")), "same", "one word changed in a text with no spaces is still the same text");
  assert.notEqual(version(ja, ja.replace("三行", "五行").replace("三週間", "四週間")), "different");
});

test("a wall of open brackets cannot hold the reader up", () => {
  const started = Date.now();
  const p = textToPost(`Title\n\n${"[".repeat(120_000)}\n\nA last paragraph.\n`);
  assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`);
  assert.ok(p.words > 0);
  // and an ordinary link still loses its address, across a line break too
  assert.equal(textToPost("Title\n\nSee the [collector\ndocs](https://example.com/docs) for more of this.\n").words, 8);
});

test("a copy the command kept is read even with a broken character in it", () => {
  const post = { title: "A post", slug: "a-post", published: false, tags: [], excerpt: null, body_md: "What I\uFFFDd do differently next time, at some length." };
  assert.throws(() => textToPost(keptCopy(post)), /UTF-8/);
  assert.equal(textToPost(keptCopy(post), { copy: true }).body_md, post.body_md);
});

// ---- found by the sixth review ----

const THREE = [
  "The cache was never cleared, and for three weeks nobody noticed that it kept growing on every single request that came in.",
  "The fix was three lines. It removes the entry when the request finishes, whether it finished well or badly.",
  "I wrote this down so that I would remember what the numbers looked like before and after the change went in.",
].join("\n\n");
/** a file is its lines. the text under them is always the same three paragraphs. */
const lay = (...head) => [...head, "", THREE, ""].join("\n");
/** a summary line with no other setting beside it. the reader takes that for a paragraph. */
const ALONE = "summary: What three weeks of a growing cache taught me.";

test("a setting line the reader would never reach stops the post instead of opening it", () => {
  // each of these was published, with draft: yes as the first words of the post or of its summary
  const twoPlaces = {
    "the header of a markdown file, then a blank line, then the draft line": lay("title: Notes on the cache", "format: markdown", "slug: notes-on-the-cache", "tags: go, caches", "", "draft: yes"),
    "tags under the title, a blank line, the draft line": lay("Notes on the cache", "tags: go, caches", "", "draft: yes"),
    "a blank line, tags, a blank line, the draft line": lay("Notes on the cache", "", "tags: go", "", "draft: yes"),
    "the same with two blank lines between the two": lay("Notes on the cache", "", "tags: go", "", "", "draft: yes"),
    "a summary first in the second place, which alone would be a paragraph": lay("Notes on the cache", "tags: go", "", "summary: Not ready yet.", "draft: yes"),
    "a draft line gone wrong in the second place": lay("Notes on the cache", "tags: go", "", "draft: yes, not ready"),
    // A summary that stands alone is taken for a paragraph, and the block under it was never
    // looked at. Each of these still went out once the layouts above were being stopped.
    "a blank line, a summary alone, a blank line, the draft line": lay("Notes on the cache", "", ALONE, "", "draft: yes"),
    "the same with the summary called an excerpt": lay("Notes on the cache", "", ALONE.replace("summary", "excerpt"), "", "draft: yes"),
    "the same with two blank lines each time": lay("Notes on the cache", "", "", ALONE, "", "", "draft: yes"),
    "the same under a title underlined with equals signs": lay("Notes on the cache", "==================", "", ALONE, "", "draft: yes"),
    "the same with a draft line gone wrong": lay("Notes on the cache", "", ALONE, "", "draft: yes, not ready"),
    "a summary an editor wrapped, under a blank line, a blank line, the draft line": lay("Notes on the cache", "", "summary: A long summary that an editor wrapped at a fixed width so that", "it carries on to a second line here.", "", "draft: yes"),
    "a line of text with a summary under it, a blank line, the draft line": lay("Notes on the cache", "", "A second line that is not a setting.", ALONE, "", "draft: yes"),
    "a first sentence that opens like a summary, a blank line, the draft line": lay("Notes on the cache", "", "Summary: we shipped it.", "", "draft: yes"),
    "an address with spaces in it, which cannot be read, a blank line, the draft line": lay("Notes on the cache", "", "Slug: this has spaces in it", "", "draft: yes"),
    "tags under the title, a summary alone, the draft line, a blank line before each": lay("Notes on the cache", "tags: go", "", ALONE, "", "draft: yes"),
    "the header of a markdown file, a summary alone, the draft line, a blank line before each": lay("title: Notes on the cache", "format: markdown", "", ALONE, "", "draft: yes"),
    "two summaries, each alone, then the draft line, a blank line before each": lay("Notes on the cache", "", ALONE, "", "excerpt: And a second one.", "", "draft: yes"),
  };
  for (const [name, raw] of Object.entries(twoPlaces)) {
    assert.throws(() => textToPost(raw), /in two places(.|\n)*\n {4}draft: yes/, name);
    assert.throws(() => textToPost(raw.replace(/\n/g, "\r\n")), /in two places/, `${name}, saved with the other line endings`);
  }
  const hidden = {
    "a summary an editor wrapped onto a second line, with the draft line under it": lay("Notes on the cache", "summary: A long summary that an editor wrapped at a fixed width so that", "it carries on to a second line here.", "draft: yes"),
    "the same under a blank line": lay("Notes on the cache", "", "summary: A long summary that an editor wrapped at a fixed width so that", "it carries on to a second line here.", "draft: yes"),
    "a line that is not a setting straight under the title": lay("Notes on the cache", "A second line that is not a setting.", "draft: yes"),
    "a line that is not a setting above it, in the block under the settings": lay("Notes on the cache", "tags: go", "", "A second line that is not a setting.", "draft: yes"),
    "the same after settings that sat under a blank line": lay("Notes on the cache", "", "tags: go", "", "A second line that is not a setting.", "draft: yes"),
    "a draft line gone wrong under a line that is not a setting": lay("Notes on the cache", "tags: go", "A second line that is not a setting.", "draft: yes, not ready"),
    "a line of text straight under the title, a blank line, the draft line": lay("Notes on the cache", "A second line that is not a setting.", "", "draft: yes"),
    "the same with a line of text above the draft line as well": lay("Notes on the cache", "A second line that is not a setting.", "", "And a third.", "draft: yes"),
    "a summary alone under a blank line, then a line of text with the draft line under it": lay("Notes on the cache", "", ALONE, "", "A second line that is not a setting.", "draft: yes"),
  };
  for (const [name, raw] of Object.entries(hidden)) {
    assert.throws(() => textToPost(raw), /sits under a line that is not one(.|\n)*\n {4}draft: yes/, name);
  }
  // what to do about it is said, and doing it works
  const wrapped = hidden["a summary an editor wrapped onto a second line, with the draft line under it"];
  assert.throws(() => textToPost(wrapped), /Move it up with the other settings, or word it another way if it belongs to the text\.$/);
  const moved = textToPost(lay("Notes on the cache", "summary: A long summary that an editor wrapped at a fixed width so that", "draft: yes", "it carries on to a second line here."));
  assert.equal(moved.draft, true);
  const bare = hidden["a line that is not a setting straight under the title"];
  assert.throws(() => textToPost(bare), /Move it above the text, or word it another way if it belongs to the text\.$/);
  assert.equal(textToPost(lay("Notes on the cache", "draft: yes", "A second line that is not a setting.")).draft, true);
  assert.throws(() => textToPost(twoPlaces["tags under the title, a blank line, the draft line"]), /Put it with the others, with no blank line between them, or word it another way if it belongs to the text\.$/);
  // the line that is shown is not always the first of its block, so it is never called that
  for (const raw of Object.values(twoPlaces)) assert.throws(() => textToPost(raw), (e) => !/first line of the text/.test(e.message));
  // a slip has to be put right as well as moved, so the line is told both
  assert.throws(() => textToPost(hidden["a draft line gone wrong under a line that is not a setting"]), /draft is yes or no(.|\n)*Fix it and move it up with the other settings/);
  assert.throws(() => textToPost(twoPlaces["a draft line gone wrong in the second place"]), /draft is yes or no(.|\n)*Fix it and put it with the others/);
  // under a summary that stands alone the advice is the same, and doing it makes both lines settings
  const underSummary = twoPlaces["a blank line, a summary alone, a blank line, the draft line"];
  assert.throws(() => textToPost(underSummary), /Put it with the others, with no blank line between them, or word it another way if it belongs to the text\.$/);
  const together = textToPost(lay("Notes on the cache", "", ALONE, "draft: yes"));
  assert.equal(together.draft, true);
  assert.equal(together.excerpt, "What three weeks of a growing cache taught me.");
  assert.equal(together.body_md, THREE);
  // the line shown is the one that opens the second place, whichever setting it is
  assert.throws(() => textToPost(lay("Notes on the cache", "", ALONE, "", "tags: go, caches", "draft: yes")), /in two places(.|\n)*\n {4}tags: go, caches\n/);
  // and where the line hides under text there, it is told to join the summary, which works as well
  const underBoth = hidden["a summary alone under a blank line, then a line of text with the draft line under it"];
  assert.throws(() => textToPost(underBoth), /Move it up with the other settings, or word it another way if it belongs to the text\.$/);
  const joined = textToPost(lay("Notes on the cache", "", ALONE, "draft: yes", "", "A second line that is not a setting."));
  assert.equal(joined.draft, true);
  assert.ok(joined.body_md.startsWith("A second line that is not a setting.\n\nThe cache was never cleared"));
});

test("settings in the places the rules give are still read, and text that only looks like them is still text", () => {
  for (const [name, raw] of Object.entries({
    "straight under the title": lay("Notes on the cache", "draft: yes"),
    "under one blank line": lay("Notes on the cache", "", "draft: yes"),
    "after a tags line": lay("Notes on the cache", "tags: go, caches", "draft: yes"),
    "in the header of a markdown file": lay("title: Notes on the cache", "format: markdown", "slug: notes-on-the-cache", "tags: go, caches", "draft: yes"),
    "under a title underlined with equals signs": lay("Notes on the cache", "==================", "draft: yes"),
    "under a blank line, after a summary line": lay("Notes on the cache", "", "summary: Not ready yet.", "draft: yes"),
  })) {
    const p = textToPost(raw);
    assert.equal(p.draft, true, name);
    assert.equal(p.title, "Notes on the cache", name);
    assert.equal(p.body_md, THREE, name);
  }
  // an indented sample is code, under the settings as anywhere else
  const sample = textToPost("How Hugo marks a draft\ntags: go\n\n    draft: true\n    tags: hugo\n\nThat is what the top of a Hugo post looks like, and it is all there is to it.\n");
  assert.equal(sample.draft, false);
  assert.deepEqual(sample.tags, ["go"]);
  assert.match(sample.body_md, /^ {4}draft: true\n {4}tags: hugo\n\nThat is what/);
  // so is a fenced one, straight under the title or under the settings
  const fenced = "```\ndraft: true\n```";
  assert.equal(textToPost(`How Hugo marks a draft\ntags: go\n\n${fenced}\n\nThat is all there is to it.\n`).body_md, `${fenced}\n\nThat is all there is to it.`);
  assert.equal(textToPost(`How Hugo marks a draft\n${fenced}\n\nThat is all there is to it.\n`).draft, false);
  // further down than the first paragraph, a line like that is the writer's own business
  const talk = textToPost("Speaking next month\n\nI am giving a talk next month, and these are the details of it.\n\ndate: 2026-11-05\n\nCome and say hello.\n");
  assert.equal(talk.date, undefined);
  assert.match(talk.body_md, /\n\ndate: 2026-11-05\n\n/);
  const twoDown = textToPost("Speaking next month\ntags: go\n\nI am giving a talk next month, and these are the details of it.\n\nThe second paragraph of it.\n\ndate: 2026-11-05\n");
  assert.equal(twoDown.date, undefined);
  assert.match(twoDown.body_md, /\n\ndate: 2026-11-05$/);
  // a paragraph that opens with a word and a colon is not shaped like a setting unless the word names one
  const noted = textToPost("Speaking next month\n\nNote: this is about a talk I am giving next month.\n\ndate: 2026-11-05\n\nCome and say hello.\n");
  assert.equal(noted.date, undefined);
  assert.match(noted.body_md, /^Note: this is about a talk I am giving next month\.\n\ndate: 2026-11-05\n\n/);
  // A summary that stands alone under a blank line is a paragraph, as it always was, and what
  // follows it is text too when no line there was meant as a setting.
  for (const [name, under] of Object.entries({
    "the text itself": [],
    "a first sentence of more than three words that opens like a draft line": ["Draft: the first one is always the worst."],
    "a sample in a fence": ["```", "draft: true", "```"],
    "an indented sample": ["    draft: true", "    tags: hugo"],
    "a paragraph, and a date line further down": ["A paragraph of text that is not a setting.", "", "date: 2026-11-05"],
  })) {
    const p = textToPost(lay("Notes on the cache", "", ALONE, "", ...under));
    assert.equal(p.draft, false, name);
    assert.equal(p.date, undefined, name);
    assert.equal(p.given.summary, false, name);
    assert.deepEqual(p.tags, [], name);
    assert.ok(p.body_md.startsWith(`${ALONE}\n\n`), name);
    assert.ok(p.body_md.endsWith(THREE), name);
  }
});

test("the text of a kept copy goes back exactly, even where it opens with lines that look like settings", () => {
  const openers = ["draft: yes", "date: 2026-08-28\n\nThe day it happened.", "tags: go, rust\nslug: elsewhere\n\nThen the text.", "A first line.\ndraft: yes\n\nThen the text."];
  for (const opening of openers) {
    const post = { title: "Notes on the cache", slug: "notes-on-the-cache", published: true, tags: ["go"], excerpt: null, body_md: `${opening}\n\n${THREE}` };
    // the kept: line is what marks it, so it is read back the same with or without being told it is a copy
    for (const why of ["update", "overwrite"]) {
      assert.equal(textToPost(keptCopy(post, why)).body_md, post.body_md, opening);
      assert.equal(textToPost(keptCopy(post, why), { copy: true }).body_md, post.body_md, opening);
    }
    // a copy from before copies said why they were kept is known by where it was read from
    const old = keptCopy(post).replace(/^kept: .*\n/m, "");
    assert.equal(textToPost(old, { copy: true }).body_md, post.body_md, opening);
    assert.equal(textToPost(old, { copy: true }).draft, false, opening);
  }
  // with a title passed in a copy is refused like any file with setting lines of its own: its header would go out as text
  const copy = keptCopy({ title: "Notes on the cache", slug: "notes-on-the-cache", published: false, tags: [], excerpt: null, body_md: THREE });
  assert.throws(() => textToPost(copy, { title: "Another title", copy: true }), /setting line of its own/);
  // an ordinary file gets no such pass, however much it looks like a copy
  assert.throws(() => textToPost(lay("title: Notes on the cache", "format: markdown", "slug: notes-on-the-cache", "draft: no", "tags: go", "cover: ", "", "draft: yes")), /in two places/);
});

test("with a title given, a setting line anywhere in the first two blocks of the file is found", () => {
  const given = { title: "Caches, half thought through" };
  for (const [name, raw] of Object.entries({
    "under a title underlined with equals signs": lay("Half a thought about caches", "===========================", "draft: yes"),
    "under a title underlined with dashes": lay("Half a thought about caches", "---------------------------", "draft: yes"),
    "under a blank line after the underline": lay("Half a thought about caches", "===========================", "", "draft: yes"),
    "under a summary an editor wrapped": lay("Half a thought about caches", "summary: A long summary that an editor wrapped at a fixed width so that", "it carries on to a second line here.", "draft: yes"),
    "under a second line of its own, in the second block": lay("Half a thought about caches", "", "A second line that is not a setting.", "draft: yes"),
    "indented by a space": lay("Half a thought about caches", " draft: yes"),
  })) {
    assert.throws(() => textToPost(raw, given), /setting line of its own:\n {4} ?draft: yes/, name);
    // the same file with no title passed in is a draft, or is stopped. it is never sent out.
    let own;
    try { own = textToPost(raw); } catch { own = null; }
    assert.ok(own === null || own.draft === true, `${name}, with no title passed in`);
  }
  // a file with no settings of its own is the post, whole
  assert.equal(textToPost(lay("Half a thought about caches", "==========================="), given).draft, false);
});

test("with a title given, the look goes on under a block that holds a line shaped like a setting", () => {
  const given = { title: "Caches, half thought through" };
  const told = (raw, opts) => { try { textToPost(raw, opts); } catch (e) { return e.message; } return "(read without complaint)"; };
  // each of these went out with the title that was passed in, and draft: yes as a paragraph of the text
  for (const [name, raw] of Object.entries({
    "under a summary that stands alone": lay("Half a thought about caches", "", ALONE, "", "draft: yes"),
    "the same with the summary called an excerpt": lay("Half a thought about caches", "", ALONE.replace("summary", "excerpt"), "", "draft: yes"),
    "under a summary an editor wrapped, with a blank line between": lay("Half a thought about caches", "", "summary: A long summary that an editor wrapped at a fixed width so that", "it carries on to a second line here.", "", "draft: yes"),
    "under two summaries, each alone": lay("Half a thought about caches", "", ALONE, "", "excerpt: And a second one.", "", "draft: yes"),
    "in a file with no title line, under two summaries, each alone": lay(ALONE, "", "excerpt: And a second one.", "", "draft: yes"),
  })) {
    assert.match(told(raw, given), /setting line of its own:\n {4}draft: yes\n/, name);
    // with the title left off the same file is stopped as well, so that is not the way out it is given
    assert.match(told(raw, given), /Take the setting lines out, or word them another way if they belong to the text\.$/, name);
    assert.notEqual(told(raw), "(read without complaint)", `${name}, with no title passed in`);
  }
  // the line shown is the first one found there, whichever setting it is
  assert.match(told(lay("Half a thought about caches", "", ALONE, "", "tags: go, caches", "draft: yes"), given), /setting line of its own:\n {4}tags: go, caches\n/);
  // under a paragraph that holds no such line, what follows is still the writer's own business
  const talk = textToPost("Speaking next month\n\nI am giving a talk next month, and these are the details of it.\n\ndate: 2026-11-05\n\nCome and say hello.\n", given);
  assert.equal(talk.date, undefined);
  assert.match(talk.body_md, /\n\ndate: 2026-11-05\n\n/);
  // and a summary that stands alone, with text under it, is two paragraphs of the post
  assert.ok(textToPost(lay("Half a thought about caches", "", ALONE), given).body_md.startsWith(`Half a thought about caches\n\n${ALONE}\n\n`));
});

test("a setting line may be indented by up to three spaces, and more than that is code", () => {
  for (const indent of [" ", "  ", "   "]) {
    for (const raw of [lay("Notes on the cache", `${indent}draft: yes`), lay("Notes on the cache", "", `${indent}draft: yes`), lay("Notes on the cache", `${indent}tags: go`, `${indent}draft: yes`)]) {
      const p = textToPost(raw);
      assert.equal(p.draft, true, JSON.stringify(raw.slice(0, 50)));
      assert.equal(p.body_md, THREE);
    }
    assert.equal(textToPost(lay(`${indent}title: Notes on the cache`, "draft: yes")).title, "Notes on the cache");
  }
  // a post that opens with an indented sample of someone else's settings keeps it, as code
  for (const indent of ["    ", "\t"]) {
    const p = textToPost(`How Hugo marks a draft\n\n${indent}draft: true\n${indent}tags: go\n\nThat is what the top of a Hugo post looks like, and it is all there is to it.\n`);
    assert.equal(p.draft, false);
    assert.deepEqual(p.tags, []);
    assert.equal(p.body_md, `${indent}draft: true\n${indent}tags: go\n\nThat is what the top of a Hugo post looks like, and it is all there is to it.`);
  }
});

test("a yes or a no in quotes or brackets is still one", () => {
  for (const yes of ['"yes"', "'yes'", "“yes”", "‘yes’", "(yes)", "[yes]", "{yes}", '"true"', "( yes )", "YES", "y", "on", "1"]) {
    for (const raw of [lay("Notes on the cache", `draft: ${yes}`), lay("Notes on the cache", "", `draft: ${yes}`)]) {
      const p = textToPost(raw);
      assert.equal(p.draft, true, yes);
      assert.equal(p.given.draft, true, yes);
      assert.equal(p.body_md, THREE, yes);
    }
  }
  for (const no of ['"no"', "(no)", "‘false’", "off", "0"]) {
    const p = textToPost(lay("Notes on the cache", `draft: ${no}`));
    assert.equal(p.draft, false, no);
    assert.equal(p.given.draft, true, `${no} is an answer, and the line is not text`);
    assert.equal(p.body_md, THREE, no);
  }
});

test("a draft line of three words or fewer that is not a yes or a no stops the post", () => {
  for (const slip of ["yep", "ys", "", "not yet", "v2", "not final", "do not share", '"maybe"', "(soon)", '"yes', "yes”", "ja"]) {
    for (const raw of [lay("Notes on the cache", `draft: ${slip}`.trimEnd()), lay("Notes on the cache", "", `draft: ${slip}`.trimEnd()), lay("Notes on the cache", `Draft: ${slip}`.trimEnd())]) {
      assert.throws(() => textToPost(raw), /looks like a setting but cannot be read as one:\n {4}[Dd]raft:/, JSON.stringify(slip));
    }
  }
  // four words or more is a sentence, and a sentence may open a post
  for (const sentence of ["Draft: the first one is always the worst.", "Draft: four words and counting", "Draft: is what I call a thing that is not done yet."]) {
    for (const raw of [lay("Notes on drafts", sentence), lay("Notes on drafts", "", sentence)]) {
      const p = textToPost(raw);
      assert.equal(p.draft, false, sentence);
      assert.equal(p.given.draft, false, sentence);
      assert.ok(p.body_md.startsWith(sentence), sentence);
    }
  }
});

test("the advice to put a blank line above a line is given only where a blank line would help", () => {
  const REST = "The second paragraph of the post, which is long enough to be a paragraph and says nothing in particular about anything.";
  const blank = /put a blank line above it if it is the first sentence of the post\.$/;
  const reword = /word it another way if it is the first sentence of the post\.$/;
  const told = (raw) => { try { textToPost(raw); } catch (e) { return e.message; } return "(read without complaint)"; };
  /** the same file with a blank line put above the line that was complained about */
  const withBlankAbove = (raw, line) => raw.replace(`\n${line}\n`, `\n\n${line}\n`);

  // settings were read above it, and nothing under it is one: the blank line makes it the opening of the text
  const helped = `A title\ntags: go\nSlug: this has spaces in it\n\n${REST}\n`;
  assert.match(told(helped), blank);
  const fixed = textToPost(withBlankAbove(helped, "Slug: this has spaces in it"));
  assert.deepEqual(fixed.tags, ["go"]);
  assert.ok(fixed.body_md.startsWith("Slug: this has spaces in it"));

  // everywhere else a blank line changes nothing, so it is not offered, and trying it shows why
  const cases = {
    "a draft gone wrong, first under the title": [`A title\nDraft: yes, I know, is a strange way to open, but here it is.\n\n${REST}\n`, "Draft: yes, I know, is a strange way to open, but here it is."],
    "a date gone wrong, first under the title": [`A title\nDate: 2026-02-30 is the day this did not happen, and here is why.\n\n${REST}\n`, "Date: 2026-02-30 is the day this did not happen, and here is why."],
    "a real setting under it": [`A title\nSlug: this has spaces in it\ntags: go\n\n${REST}\n`, "Slug: this has spaces in it"],
    "a draft gone wrong, under settings that were read": [`A title\ntags: go\ndraft: yes, not ready\n\n${REST}\n`, "draft: yes, not ready"],
    "settings read above it and a real setting under it": [`A title\ntags: go\nSlug: this has spaces in it\ndraft: yes\n\n${REST}\n`, "Slug: this has spaces in it"],
  };
  for (const [name, [raw, line]] of Object.entries(cases)) {
    assert.match(told(raw), reword, name);
    assert.doesNotMatch(told(raw), /blank line above/, name);
    assert.notEqual(told(withBlankAbove(raw, line)), "(read without complaint)", `${name}: with the blank line in, it is still stopped`);
  }
});

test("with a title given, leaving the title off is only offered where that would work", () => {
  const given = { title: "Caches, half thought through" };
  const told = (raw, opts) => { try { textToPost(raw, opts); } catch (e) { return e.message; } return "(read without complaint)"; };
  const leaveOff = /Leave --title off and let the first line of the file be the title, or take the setting lines out\.$/;
  const takeOut = /Take the setting lines out, or word them another way if they belong to the text\.$/;
  // the file has a title line of its own and its settings sit where they are read
  const underlined = lay("Half a thought about caches", "===========================", "draft: yes");
  assert.match(told(underlined, given), leaveOff);
  assert.equal(textToPost(underlined).draft, true, "done as it says, the line is read and the post is a draft");
  // the setting hides under a line of text. with the title left off the file is stopped as well, so that is not offered.
  const hidden = lay("Half a thought about caches", "", "A second line that is not a setting.", "draft: yes");
  assert.match(told(hidden, given), takeOut);
  assert.doesNotMatch(told(hidden, given), /Leave --title off/);
  assert.match(told(hidden), /sits under a line that is not one/, "which is what leaving it off would have met");
  // the file has no title line at all, and its settings are its first lines. with the title
  // left off, the first of them would be taken for the title, so that is not offered either.
  for (const top of [lay("draft: yes"), lay("draft: yes", "tags: go"), lay("tags: go", "draft: yes"), lay("", "draft: yes")]) {
    assert.match(told(top, given), takeOut, JSON.stringify(top.slice(0, 30)));
    assert.doesNotMatch(told(top, given), /Leave --title off/);
  }
  // taking the setting lines out, which is offered every time, works every time
  assert.equal(textToPost(`${THREE}\n`, given).draft, false);
  // a kept copy has a title line and nothing but settings under it, so leaving the title off is the way
  const copy = keptCopy({ title: "Notes on the cache", slug: "notes-on-the-cache", published: false, tags: [], excerpt: null, body_md: THREE });
  assert.match(told(copy, { ...given, copy: true }), leaveOff);
});

test("a first line that is a setting is not taken for the title", () => {
  // a file with no title line, posted with no title passed in, went out under the title "draft: yes"
  const stopped = /^The first line of a file is its title, and this one looks like a setting:\n {4}(.*)\n {2}Put the title on a line above it\. If that line really is the title, write it as {2}title: (.*)$/;
  // however far it is indented: a title cannot be code, so no indent makes a first line anything else
  for (const first of ["draft: yes", "tags: go, caches", "Draft: yep", "draft:", "date: 2026-02-30", "slug: notes-on-the-cache", "format: markdown", "cover: /images/cache.png", "  draft: yes", "    draft: yes", "\tdraft: yes"]) {
    for (const raw of [lay(first), lay(first, "tags: go"), `\n\n${lay(first)}`]) {
      let message = "(read without complaint)";
      try { textToPost(raw); } catch (e) { message = e.message; }
      assert.match(message, stopped, first);
      assert.equal(message.match(stopped)[1], first.trim(), "the line is shown");
      // and the second way out is one that works: said outright, the line is the title
      const said = textToPost(lay(`title: ${message.match(stopped)[2]}`));
      assert.equal(said.title, first.trim(), first);
      assert.equal(said.draft, false);
    }
  }
  // the first way out: with a title above them, the same lines are read as the settings they are
  const titled = textToPost(lay("Notes on the cache", "draft: yes", "tags: go"));
  assert.equal(titled.draft, true);
  assert.deepEqual(titled.tags, ["go"]);
  // a title that only starts like a setting is a title
  for (const title of ["Summary: what I learned", "Draft: the first one is always the worst.", "Date: the day it all went wrong", "Tags are not folders", "Cover: versions that beat the original", "# Draft"]) {
    assert.equal(textToPost(lay(title)).title, title.replace(/^# /, ""), title);
  }
});

// ---- found when the fixes for the sixth review were checked a second time ----

/** the same three paragraphs, each one indented, the way a letter is typed */
const letter = (indent) => THREE.split("\n\n").map((p) => `${indent}${p}`).join("\n\n");
/** a file typed like a letter: its lines as given, then the three paragraphs, each indented */
const typed = (indent, ...head) => [...head, "", letter(indent), ""].join("\n");
const told = (raw, opts) => { try { textToPost(raw, opts); } catch (e) { return e.message; } return "(read without complaint)"; };

test("in a file typed like a letter, a setting line indented like the rest stops the post instead of opening it", () => {
  // Every paragraph indented means the indents come off, so a draft line indented with them is
  // not code. Each of these was published, with the line among the opening words of the post.
  const stopped = /^This line looks like a setting, but every paragraph in this file is indented and loses its indent, so it would be published as text:\n {4}(.*)\n/;
  const layouts = {
    "the whole file indented by four spaces, title and all": [typed("    ", "    Notes on the cache", "    draft: yes"), "draft: yes"],
    "the title at the margin and the rest indented by four spaces": [typed("    ", "Notes on the cache", "    draft: yes"), "draft: yes"],
    "the same with a tab": [typed("\t", "Notes on the cache", "\tdraft: yes"), "draft: yes"],
    "tags and the draft line, both indented": [typed("    ", "Notes on the cache", "    tags: go", "    draft: yes"), "tags: go"],
    "under a blank line": [typed("    ", "Notes on the cache", "", "    draft: yes"), "draft: yes"],
    "under tags at the margin and a blank line": [typed("    ", "Notes on the cache", "tags: go", "", "    draft: yes"), "draft: yes"],
    "straight under tags at the margin": [typed("    ", "Notes on the cache", "tags: go", "    draft: yes"), "draft: yes"],
    "under a summary that stands alone, both indented": [typed("    ", "Notes on the cache", "", `    ${ALONE}`, "", "    draft: yes"), "draft: yes"],
    "under two summaries, each alone, all indented": [typed("    ", "Notes on the cache", "", `    ${ALONE}`, "", "    excerpt: And a second one.", "", "    draft: yes"), "draft: yes"],
    "under a line of text, both indented": [typed("    ", "Notes on the cache", "", "    A second line that is not a setting.", "    draft: yes"), "draft: yes"],
    "a draft line gone wrong": [typed("    ", "Notes on the cache", "    draft: yes, not ready"), "draft: yes, not ready"],
    "a date that is no real day": [typed("    ", "Notes on the cache", "    date: 2026-02-30"), "date: 2026-02-30"],
    "only the first line of each paragraph indented, the way a book sets it": [["Notes on the cache", "", "    draft: yes", "", ...THREE.split("\n\n").flatMap((p) => [`    ${p.slice(0, 60)}`, p.slice(60), ""])].join("\n"), "draft: yes"],
    // at the margin itself, and reached only through indented lines that are shaped like settings
    "at the margin, under an indented line of text, under an indented summary": [typed("    ", "Notes on the cache", "", `    ${ALONE}`, "", "    A second line that is not a setting.", "draft: yes"), "draft: yes"],
  };
  for (const [name, [raw, line]] of Object.entries(layouts)) {
    assert.match(told(raw), stopped, name);
    assert.equal(told(raw).match(stopped)[1], line, `${name}: the line is shown, without its indent`);
    assert.match(told(raw.replace(/\n/g, "\r\n")), stopped, `${name}, saved with the other line endings`);
  }
  // what to do about it is said, and doing it works, wherever the line was
  const advice = /\n {2}Write it straight under the title, with no indent in front of it, or word it another way if it belongs to the text\.$/;
  for (const [name, [raw]] of Object.entries(layouts)) if (!/gone wrong|no real day/.test(name)) assert.match(told(raw), advice, name);
  const done = textToPost(typed("    ", "Notes on the cache", "draft: yes"));
  assert.equal(done.draft, true);
  assert.equal(done.body_md, THREE);
  const both = textToPost(typed("    ", "    Notes on the cache", "draft: yes", "tags: go"));
  assert.equal(both.title, "Notes on the cache");
  assert.equal(both.draft, true);
  assert.deepEqual(both.tags, ["go"]);
  assert.equal(both.body_md, THREE);
  const reached = textToPost(typed("    ", "Notes on the cache", "draft: yes", "", `    ${ALONE}`, "", "    A second line that is not a setting."));
  assert.equal(reached.draft, true);
  assert.equal(reached.body_md, `${ALONE}\n\nA second line that is not a setting.\n\n${THREE}`);
  // worded another way, it is text, and the post is whatever the file says it is
  const reworded = textToPost(typed("    ", "Notes on the cache", "", "    This one is a draft: yes, still."));
  assert.equal(reworded.draft, false);
  assert.equal(reworded.body_md, `This one is a draft: yes, still.\n\n${THREE}`);
  // a slip has to be put right as well as moved, so the line is told both
  assert.match(told(layouts["a draft line gone wrong"][0]), /draft is yes or no(.|\n)*\n {2}Fix it and write it straight under the title, with no indent in front of it, or word it another way if it belongs to the text\.$/);
  assert.match(told(layouts["a date that is no real day"][0]), /a date is a real day(.|\n)*\n {2}Fix it and write it straight under the title/);
  // the advice is not to take the indent off the line where it stands. under an indented
  // summary that would leave a file that is no letter, and the line would go out as a paragraph.
  for (const [name, [raw]] of Object.entries(layouts)) assert.doesNotMatch(told(raw), /[Tt]ake the indent off/, name);
});

test("a setting line that is the indented first line of a paragraph, the way a book sets one, stops the post instead of opening it", () => {
  // An indent on only the first line of a paragraph is a paragraph indent and comes off, so a
  // draft line indented like that, with a line of text straight under it, is not code either.
  // Each of these was published, with draft: yes as a paragraph of the post.
  const stopped = /^This line looks like a setting, but an indent on only the first line of a paragraph is not code and comes off, so it would be published as text:\n {4}(.*)\n/;
  const [one, two, three] = THREE.split("\n\n");
  const rest = ["", two, "", three, ""];
  const layouts = {
    "straight under the title, with the first paragraph straight under it": [["Notes on the cache", "    draft: yes", one, ...rest], "draft: yes"],
    "the same with a tab": [["Notes on the cache", "\tdraft: yes", one, ...rest], "draft: yes"],
    "under a blank line": [["Notes on the cache", "", "    draft: yes", one, ...rest], "draft: yes"],
    "under tags at the margin and a blank line": [["Notes on the cache", "tags: go", "", "    draft: yes", one, ...rest], "draft: yes"],
    "straight under tags at the margin": [["Notes on the cache", "tags: go", "    draft: yes", one, ...rest], "draft: yes"],
    "under a summary that stands alone": [["Notes on the cache", "", ALONE, "", "    draft: yes", one, ...rest], "draft: yes"],
    "under a row of dashes inside the paragraph, which starts another": [["Notes on the cache", "", "A second line that is not a setting.", "---", "    draft: yes", one, ...rest], "draft: yes"],
    "a draft line gone wrong": [["Notes on the cache", "    draft: yes, not ready", one, ...rest], "draft: yes, not ready"],
    "tags on the indented line, with a line of text under them": [["Notes on the cache", "", "    tags: go", one, ...rest], "tags: go"],
  };
  for (const [name, [lines, line]] of Object.entries(layouts)) {
    const raw = lines.join("\n");
    assert.match(told(raw), stopped, name);
    assert.equal(told(raw).match(stopped)[1], line, `${name}: the line is shown, without its indent`);
    assert.match(told(raw.replace(/\n/g, "\r\n")), stopped, `${name}, saved with the other line endings`);
  }
  // what to do about it is said, and doing it works
  assert.match(told(layouts["under a blank line"][0].join("\n")), /\n {2}Write it straight under the title, with no indent in front of it, or word it another way if it belongs to the text\.$/);
  const done = textToPost(["Notes on the cache", "draft: yes", one, ...rest].join("\n"));
  assert.equal(done.draft, true);
  assert.equal(done.body_md, THREE);
  assert.match(told(layouts["a draft line gone wrong"][0].join("\n")), /draft is yes or no(.|\n)*\n {2}Fix it and write it straight under the title, with no indent in front of it/);
  // with the draft line at the margin under such a line, the file was stopped before, for the draft line, and still is
  assert.match(told(["Notes on the cache", "", "    tags: go", "draft: yes", one, ...rest].join("\n")), /sits under a line that is not one(.|\n)*\n {4}draft: yes\n/);
  // A line at the margin that the look only reaches because the indented line above it is
  // shaped like a setting once its indent is off. It is told what it would be told had that
  // line never been indented, which is where it stands in the post.
  const reached = ["Notes on the cache", "", `    ${ALONE}`, "and here the paragraph goes on, at the margin.", "", "draft: yes", "", THREE, ""].join("\n");
  assert.match(told(reached), /in two places(.|\n)*\n {4}draft: yes\n/);
  assert.match(told(reached.replace(`    ${ALONE}`, ALONE)), /in two places(.|\n)*\n {4}draft: yes\n/, "the same file with no indent on that line");
});

test("a line the reader would have read as a setting, had it not been indented, stops the post when the indent is one that comes off", () => {
  // A summary line proves nothing alone, so it is not looked for further down. Straight under
  // the title or the settings it is read without proof, though, and indented in a way that is
  // not code it was published as the opening of the post instead.
  const stopped = /^This line looks like a setting, but (every paragraph in this file is indented and loses its indent|an indent on only the first line of a paragraph is not code and comes off), so it would be published as text:\n {4}(.*)\n {2}Write it straight under the title, with no indent in front of it, or word it another way if it belongs to the text\.$/;
  const [one, two, three] = THREE.split("\n\n");
  for (const [name, raw, line] of [
    ["a letter, the summary straight under the title", typed("    ", "Notes on the cache", `    ${ALONE}`), ALONE],
    ["a letter, title and all", typed("\t", "\tNotes on the cache", `\t${ALONE}`), ALONE],
    ["a letter, the summary straight under tags at the margin", typed("    ", "Notes on the cache", "tags: go", `    ${ALONE}`), ALONE],
    ["a letter, an excerpt under tags that sit under a blank line", typed("    ", "Notes on the cache", "", "tags: go", "    excerpt: A short one."), "excerpt: A short one."],
    ["the first line of a paragraph set like a book, straight under the title", ["Notes on the cache", `    ${ALONE}`, one, "", two, "", three, ""].join("\n"), ALONE],
  ]) {
    assert.match(told(raw), stopped, name);
    assert.equal(told(raw).match(stopped)[2], line, `${name}: the line is shown, without its indent`);
  }
  // done as it says, the line is the summary it was meant as
  const done = textToPost(typed("    ", "Notes on the cache", ALONE));
  assert.equal(done.excerpt, "What three weeks of a growing cache taught me.");
  assert.equal(done.body_md, THREE);
  // under settings that were read, a line that cannot be read as one is stopped at the margin, and so it is here
  assert.match(told(lay("Notes on the cache", "tags: go", "Slug: this has spaces in it")), /cannot be read as one/);
  assert.match(told(typed("    ", "Notes on the cache", "tags: go", "    Slug: this has spaces in it")), /every paragraph in this file is indented and loses its indent(.|\n)*\n {4}Slug: this has spaces in it\n(.|\n)*A slug has no spaces(.|\n)*\n {2}Fix it and write it straight under the title/);
  // Under a blank line a summary alone is a paragraph, with or without an indent, and a
  // sentence that opens like a draft line is a sentence wherever it stands.
  assert.equal(textToPost(typed("    ", "Notes on the cache", "", `    ${ALONE}`)).body_md, `${ALONE}\n\n${THREE}`);
  const sentence = textToPost(typed("    ", "Notes on drafts", "    Draft: the first one is always the worst."));
  assert.equal(sentence.draft, false);
  assert.equal(sentence.body_md, `Draft: the first one is always the worst.\n\n${THREE}`);
  // with a title passed in no setting is read from the file, so there such a line is text, as it is at the margin
  const given = { title: "Notes on the cache" };
  assert.equal(textToPost(typed("    ", `    ${ALONE}`), given).body_md, `${ALONE}\n\n${THREE}`);
  assert.equal(textToPost(lay(ALONE), given).body_md, `${ALONE}\n\n${THREE}`);
});

test("a file with indents that come off is still read, wherever the same file typed without them would be", () => {
  // no setting lines at all
  assert.equal(textToPost(typed("    ", "Notes on the cache")).body_md, THREE);
  assert.equal(textToPost(typed("\t", "\tNotes on the cache")).body_md, THREE);
  // its settings at the margin, straight under the title or under a blank line
  for (const raw of [typed("    ", "Notes on the cache", "tags: go", "draft: yes"), typed("    ", "Notes on the cache", "", "tags: go", "draft: yes"), typed("    ", "    Notes on the cache", "tags: go", "draft: yes")]) {
    const p = textToPost(raw);
    assert.equal(p.draft, true);
    assert.deepEqual(p.tags, ["go"]);
    assert.equal(p.body_md, THREE);
  }
  // three spaces is not the indent of a letter, and a setting line may have that many in front
  const three = textToPost(typed("   ", "Notes on the cache", "   draft: yes"));
  assert.equal(three.draft, true);
  // further down than the look goes, a line like that is the writer's own business, in a letter as anywhere
  const talk = textToPost("Speaking next month\n\n    I am giving a talk next month, and these are the details of it.\n\n    date: 2026-11-05\n\n    Come and say hello.\n");
  assert.equal(talk.date, undefined);
  assert.equal(talk.body_md, "I am giving a talk next month, and these are the details of it.\n\ndate: 2026-11-05\n\nCome and say hello.");
  // a sentence that only opens like a setting is a sentence
  for (const opening of ["Draft: the first one is always the worst.", "Summary: we shipped it.", ALONE]) {
    const p = textToPost(typed("    ", "Notes on drafts", "", `    ${opening}`));
    assert.equal(p.draft, false, opening);
    assert.equal(p.given.summary, false, opening);
    assert.equal(p.body_md, `${opening}\n\n${THREE}`, opening);
  }
  // a sample in a fence stays as it is
  assert.ok(textToPost(typed("    ", "How Hugo marks a draft", "", "```", "draft: true", "```")).body_md.startsWith("```\ndraft: true\n```\n\nThe cache was never cleared"));
  // And in a file that is not typed like a letter, a block that is indented throughout and
  // stands apart from the title stays code: one paragraph at the margin is enough for that.
  // Straight under the title it is another matter, and has a test of its own below.
  const hugo = textToPost(lay("How Hugo marks a draft", "", "    draft: true", "    tags: go"));
  assert.equal(hugo.draft, false);
  assert.deepEqual(hugo.tags, []);
  assert.ok(hugo.body_md.startsWith("    draft: true\n    tags: go\n\nThe cache was never cleared"));
  // a single indented line that stands apart is a sample too, and a code fence straight under it ends its block
  const fenced = textToPost(lay("How Hugo marks a draft", "", "    draft: true", "```", "hugo new post.md", "```"));
  assert.equal(fenced.draft, false);
  assert.ok(fenced.body_md.startsWith("    draft: true\n\n```\nhugo new post.md\n```\n\nThe cache was never cleared"));
  // a letter with its settings at the margin and no blank line before its first paragraph
  const [first, ...others] = THREE.split("\n\n");
  const snug = textToPost(["Notes on the cache", "tags: go, caches", `    ${first}`, "", ...others.flatMap((para) => [`    ${para}`, ""])].join("\n"));
  assert.deepEqual(snug.tags, ["go", "caches"]);
  assert.equal(snug.body_md, THREE);
  // and a paragraph set like a book that holds no setting is the paragraph it always was
  const [top, mid, end] = THREE.split("\n\n");
  const book = textToPost(["Notes on the cache", "", `    ${top.slice(0, 60)}`, top.slice(60), "", mid, "", end, ""].join("\n"));
  assert.equal(book.body_md, `${top.slice(0, 60)}\n${top.slice(60)}\n\n${mid}\n\n${end}`);
  const opener = textToPost(["Notes on drafts", "", "    Draft: the first one is always the worst,", "and that is fine.", "", mid, ""].join("\n"));
  assert.equal(opener.draft, false);
  assert.ok(opener.body_md.startsWith("Draft: the first one is always the worst,\nand that is fine.\n\n"));
  // a file that says it is markdown keeps every indent, so nothing in it is about to become text
  const markdown = textToPost("title: How Hugo marks a draft\nformat: markdown\n\n    draft: true\n    tags: hugo\n");
  assert.equal(markdown.draft, false);
  assert.deepEqual(markdown.tags, []);
  assert.equal(markdown.body_md, "    draft: true\n    tags: hugo");
});

test("an indented setting line straight under the title or the settings stops the post, whichever was meant", () => {
  // Straight under the title is where settings go. Indented by a tab or four spaces there, a
  // draft line was taken for a sample of code and the draft went out with it as a block of code.
  // It may be a slip of the tab key or it may be a sample, and the two cannot be told apart, so it is asked.
  const stopped = /^This line looks like a setting, but it is indented, and straight under (the title|the settings) an indented line is taken for a sample of code, so it would be published as text:\n {4}(.*)\n/;
  for (const [name, raw, where, line] of [
    ["four spaces, straight under the title", lay("Notes on the cache", "    draft: yes"), "the title", "    draft: yes"],
    ["a tab", lay("Notes on the cache", "\tdraft: yes"), "the title", "\tdraft: yes"],
    ["two tabbed settings, and the first is the one shown", lay("Notes on the cache", "\ttags: go", "\tdraft: yes"), "the title", "\ttags: go"],
    ["under settings that were read", lay("Notes on the cache", "tags: go", "    draft: yes"), "the settings", "    draft: yes"],
    ["a draft line gone wrong", lay("Notes on the cache", "    draft: yep"), "the title", "    draft: yep"],
    ["a date", lay("Notes on the cache", "    date: 2026-08-28"), "the title", "    date: 2026-08-28"],
  ]) {
    const said = told(raw);
    assert.match(said, stopped, name);
    assert.deepEqual(stopped.exec(said).slice(1), [where, line], name);
    // both ways out are given, since the command cannot know which was meant
    assert.match(said, /[Tt]ake the indent off if it is a setting\. If it is a sample of code, put a blank line above it\.$/, name);
  }
  // each way out, followed to the letter, is read without complaint
  assert.equal(textToPost(lay("Notes on the cache", "draft: yes")).draft, true);
  const sample = textToPost(lay("Notes on the cache", "", "    draft: yes"));
  assert.equal(sample.draft, false);
  assert.ok(sample.body_md.startsWith("    draft: yes\n\nThe cache was never cleared"));
  // an indented line there that is no setting is left as it always was
  const plain = textToPost(lay("Notes on the cache", "    go test ./..."));
  assert.ok(plain.body_md.startsWith("    go test ./...\n\nThe cache was never cleared"));
  // and a file that says it is markdown has said what its indents are
  const markdown = textToPost("title: How Hugo marks a draft\nformat: markdown\n    draft: true\n\nThat is the whole of it.\n");
  assert.equal(markdown.draft, false);
  assert.ok(markdown.body_md.startsWith("    draft: true"));
});

test("an indented setting line under a line of text is part of that paragraph, not code, and stops the post", () => {
  // Markdown makes no block of code of an indented line that stands straight under a line of
  // text. It is shown as part of the paragraph, so each of these went out with draft: yes in its opening.
  const stopped = /^This line looks like a setting, but an indented line straight under a line of text is not code and is shown as part of that paragraph, so it would be published as text:\n {4}(.*)\n/;
  for (const [name, raw, line] of [
    ["a line of text under the title, the draft line indented under it", lay("Notes on the cache", "Written on the train, not checked.", "    draft: yes"), "    draft: yes"],
    ["the same with a tab", lay("Notes on the cache", "Written on the train, not checked.", "\tdraft: yes"), "\tdraft: yes"],
    ["two indented lines under the text, and the second is the setting", lay("Notes on the cache", "Written on the train, not checked.", "    and not read through either", "    draft: yes"), "    draft: yes"],
    ["in the block under a blank line", lay("Notes on the cache", "", "Written on the train, not checked.", "    draft: yes"), "    draft: yes"],
  ]) {
    const said = told(raw);
    assert.match(said, stopped, name);
    assert.equal(stopped.exec(said)[1], line, name);
  }
  // with a title passed in, the file's own first line is that line of text
  const given = { title: "Caches, half thought through" };
  for (const [name, raw] of [
    ["every paragraph indented, the first line at the margin", typed("    ", "Half a thought about caches", "    draft: yes")],
    ["the paragraphs at the margin and only the draft line indented", lay("Half a thought about caches", "    draft: yes")],
    ["the same with a tab", lay("Half a thought about caches", "\tdraft: yes")],
  ]) {
    assert.match(told(raw, given), /setting line of its own:\n {4}draft: yes\n/, name);
    // leaving the title off is no way out: the same file is then stopped as well
    assert.notEqual(told(raw), "(read without complaint)", `${name}, with no title passed in`);
    assert.match(told(raw, given), /Take the setting lines out, or word them another way if they belong to the text\./, name);
  }
  // At the very top of a file posted with a title, an indented setting line is asked about too:
  // it may be the opening sample of the post or a setting pushed in by the tab key.
  for (const [name, raw] of [["four spaces", lay("    draft: yes")], ["a tab", lay("\tdraft: yes")], ["a sample of two lines", lay("    draft: yes", "    tags: hugo")]]) {
    const said = told(raw, given);
    assert.match(said, /setting line of its own:\n {4}draft: yes\n/, name);
    assert.match(said, /Take the setting lines out, or word them another way if they belong to the text\. If it is a sample of code, put it between two lines of three backticks\.$/, name);
  }
  // and that way out works: the same sample in a fence is the opening of the post
  const fenced = textToPost(lay("```", "draft: yes", "tags: hugo", "```"), given);
  assert.equal(fenced.draft, false);
  assert.ok(fenced.body_md.startsWith("```\ndraft: yes\ntags: hugo\n```"));
  // a setting line that is not indented is not called a sample
  assert.doesNotMatch(told(lay("Half a thought about caches", "draft: yes"), given), /sample of code/);
  // a list is left alone: what is indented under an item belongs to the item
  const list = textToPost(lay("Notes on the cache", "", "- the first thing to check", "    draft: yes is what Hugo calls it"));
  assert.equal(list.draft, false);
});

test("with a title given, a file is looked at without the indents it is about to lose as well", () => {
  const given = { title: "Notes on the cache" };
  // each of these went out under the title that was passed in, with draft: yes in its opening
  for (const [name, raw] of Object.entries({
    "no title line, the draft line first": typed("    ", "    draft: yes"),
    "a title line of its own with the draft line under it": typed("    ", "    Half a thought about caches", "    draft: yes"),
    "the same with tabs": typed("\t", "\tHalf a thought about caches", "\tdraft: yes"),
    "the draft line under a blank line": typed("    ", "    Half a thought about caches", "", "    draft: yes"),
    "under a summary that stands alone": typed("    ", "    Half a thought about caches", "", `    ${ALONE}`, "", "    draft: yes"),
    // and in a file that is no letter, on the indented first line of a paragraph set like a book
    "on the first line of the file, with the text straight under it": lay("    draft: yes", "The first line of the text, straight under it."),
    "the same under a title line of its own and a blank line": lay("Half a thought about caches", "", "    draft: yes", "The first line of the text, straight under it."),
  })) {
    assert.match(told(raw, given), /setting line of its own:\n {4}draft: yes\n/, name);
    // with the title left off the same file is stopped as well, so that is not the way out it is given
    // each of these lines was found only without its indent, so the way out for a sample of code is given as well
    assert.match(told(raw, given), /Take the setting lines out, or word them another way if they belong to the text\. If it is a sample of code, put it between two lines of three backticks\.$/, name);
    assert.notEqual(told(raw), "(read without complaint)", `${name}, with no title passed in`);
  }
  // with the setting line taken out, which is what it says to do, the whole file is the post
  const whole = textToPost(typed("    ", "    Half a thought about caches"), given);
  assert.equal(whole.title, "Notes on the cache");
  assert.equal(whole.body_md, `Half a thought about caches\n\n${THREE}`);
  // further down than the look goes, a line like that is still the writer's own business
  const talk = textToPost("    I am giving a talk next month, and these are the details of it.\n\n    Here is where it is and how to get there by train.\n\n    date: 2026-11-05\n", given);
  assert.equal(talk.date, undefined);
  assert.ok(talk.body_md.endsWith("\n\ndate: 2026-11-05"));
});

test("a first line shaped like a setting, with settings straight under it, is not taken for the title", () => {
  // A summary line alone can be a title, so it is let through. With a real setting straight
  // under it, it was meant as a setting, and the file went out under the title "summary: ...".
  const stopped = /^The first line of a file is its title, and this one looks like a setting:\n {4}(.*)\n {2}Put the title on a line above it\. If that line really is the title, write it as {2}title: (.*)$/;
  const EXCERPT = ALONE.replace("summary", "excerpt");
  for (const [first, ...under] of [
    [ALONE, "tags: go, caches"],
    [ALONE, "draft: yes"],
    [EXCERPT, "tags: go, caches", "draft: yes"],
    [ALONE, "excerpt: And a second one.", "draft: yes"],
    ["Summary: what I learned", " draft: yes"],
    // a slip under it, or in it, is no less a sign of what the lines were meant as
    [ALONE, "draft: yep"],
    [ALONE, "date: 2026-02-30"],
    ["Slug: this has spaces in it", "tags: go"],
  ]) {
    const message = told(lay(first, ...under));
    assert.match(message, stopped, `${first} / ${under.join(" / ")}`);
    assert.equal(message.match(stopped)[1], first, "the line is shown");
    assert.equal(message.match(stopped)[2], first, "and so is the way to say it is the title");
  }
  // the first way out: with a title above them, the same lines are the settings they were meant as
  const above = textToPost(lay("Notes on the cache", ALONE, "tags: go, caches", "draft: yes"));
  assert.equal(above.title, "Notes on the cache");
  assert.equal(above.excerpt, "What three weeks of a growing cache taught me.");
  assert.deepEqual(above.tags, ["go", "caches"]);
  assert.equal(above.draft, true);
  assert.equal(above.body_md, THREE);
  // the second: said outright, the line is the title, and what sits under it is still read
  const outright = textToPost(lay(`title: ${ALONE}`, "tags: go, caches", "draft: yes"));
  assert.equal(outright.title, ALONE);
  assert.deepEqual(outright.tags, ["go", "caches"]);
  assert.equal(outright.draft, true);
  // a title that only starts like a setting is still a title, when nothing under it says otherwise
  for (const [name, under, fits] of [
    ["with the text under a blank line", [], (p) => p.body_md === THREE],
    ["with a line of text straight under it", ["A second line that is not a setting."], (p) => p.body_md.startsWith("A second line that is not a setting.")],
    ["with a sentence that opens like a draft line under it", ["Draft: the first one is always the worst."], (p) => p.draft === false && p.body_md.startsWith("Draft: the first one")],
    ["with a summary alone under it", ["summary: The real one."], (p) => p.excerpt === "The real one." && p.body_md === THREE],
    ["underlined, with tags under the underline", ["=======================", "tags: go"], (p) => p.tags.join() === "go" && p.body_md === THREE],
    ["with its settings under a blank line", ["", "tags: go", "draft: yes"], (p) => p.draft === true && p.tags.join() === "go" && p.body_md === THREE],
  ]) {
    const p = textToPost(lay("Summary: we shipped it.", ...under));
    assert.equal(p.title, "Summary: we shipped it.", name);
    assert.ok(fits(p), name);
  }
});
