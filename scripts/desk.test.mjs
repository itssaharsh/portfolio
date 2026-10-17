// npm test
// The writing desk without a browser: the real savePost and deletePost, the desk's reads, the
// proxy and the pages, run in this process on a JSON file for a database. See
// scripts/sim/in-process.mjs for how. The editor itself needs a browser and is tested by
// scripts/desk-editor.test.mjs, which is `npm run desk`.
// Each test is a state a reviewer drove the desk into, or the state next to one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { newDesk } from "./sim/in-process.mjs";
import { drawn, answered } from "./sim/editor/drawn.mjs";

const require = createRequire(import.meta.url);
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { NextRequest } = require("next/server");

// long enough that the post command changes the post without asking whether it is the same one
const FOUR = [
  "The cache was never cleared, and for three weeks nobody noticed that it kept growing on every single request that came in.",
  "A lock is a promise that one thing happens at a time, and the bug was that two parts of the program each believed they held it.",
  "The retry made it worse. Every failed request came back twice as often, so the queue grew faster than it drained.",
  "I wrote this down so that I would remember what the numbers looked like before and after the change went in.",
];
const FIFTH = "The fix was three lines. It removes the entry when the request finishes, whether it finished well or badly.";
const file = (title, paragraphs, settings = []) => [title, ...settings, "", paragraphs.join("\n\n"), ""].join("\n");

/** the words on a page, the way a reader meets them */
const words = (drawn) => renderToStaticMarkup(drawn).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
/** every piece of what a page drew that passes the test, wherever it sits */
const pieces = (drawn, wanted, found = []) => {
  if (Array.isArray(drawn)) for (const one of drawn) pieces(one, wanted, found);
  else if (drawn && typeof drawn === "object" && "props" in drawn) {
    if (wanted(drawn)) found.push(drawn);
    pieces(drawn.props.children, wanted, found);
  }
  return found;
};
/** where a page or an action sent the browser, or null when it sent it nowhere */
const sentTo = async (run) => {
  try { await run(); } catch (e) { if (e && typeof e.to === "string") return e.to; throw e; }
  return null;
};
const at = (id) => ({ params: Promise.resolve({ id }) });
const onlyPost = (site) => { assert.equal(site.posts().length, 1); return site.posts()[0]; };

// ---------------------------------------------------------------- a page knows which version it was opened on

test("a page opened before a post changed elsewhere cannot save its old picture over it", async () => {
  // this once took a live post down, erased the day it went out and put the old text back
  const desk = await newDesk();
  const { site } = desk;
  site.write("b.txt", file("Notes on the cache", FOUR));
  assert.equal(site.post("b.txt", "--draft").code, 0);
  const opened = onlyPost(site);                       // the page is opened now, on the draft
  site.write("b.txt", file("Notes on the cache", [...FOUR, FIFTH], ["date: 2026-08-28"]));
  const published = site.post("b.txt", "--publish");
  assert.equal(published.code, 0, published.out);
  const left = onlyPost(site);
  assert.equal(left.published, true);
  assert.equal(left.published_at, "2026-08-28T00:00:00.000Z");

  const answer = await desk.save(desk.form({ excerpt: "One line, typed in the tab that was left open." }, opened));
  assert.equal(answer.stale, true, JSON.stringify(answer));
  assert.match(answer.error, /saved again after this page was opened/);
  assert.match(answer.error, /nothing was saved/);
  assert.equal(answer.opened, opened.updated_at, "the stamp it was sent comes back with the boxes");
  assert.equal(answer.fields.excerpt, "One line, typed in the tab that was left open.");
  assert.deepEqual(onlyPost(site), left, "the post is exactly as the command left it");
});

test("of two pages on one post, the one that saves second is told, and the first save stands", async () => {
  const desk = await newDesk();
  const { site } = desk;
  assert.ok((await desk.save(desk.form({ title: "Two tabs", body_md: FOUR.join("\n\n") }))).saved);
  const opened = onlyPost(site);                       // both pages are opened on this
  assert.ok((await desk.save(desk.form({ title: "Two tabs, a better title" }, opened))).saved);
  const second = await desk.save(desk.form({ body_md: [...FOUR, FIFTH].join("\n\n") }, opened));
  assert.equal(second.stale, true, JSON.stringify(second));
  assert.equal(onlyPost(site).title, "Two tabs, a better title");
  assert.equal(onlyPost(site).body_md, FOUR.join("\n\n"));
  // loaded again, on the post as it is now, the same change goes in and takes nothing away
  const again = await desk.save(desk.form({ body_md: [...FOUR, FIFTH].join("\n\n") }, onlyPost(site)));
  assert.ok(again.saved, JSON.stringify(again));
  assert.equal(onlyPost(site).title, "Two tabs, a better title");
  assert.equal(onlyPost(site).body_md, [...FOUR, FIFTH].join("\n\n"));
});

test("a form that does not say which version it was opened on is refused, and is not told the post changed", async () => {
  // a page left open across the day the desk learned to check
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR.join("\n\n") }));
  const before = onlyPost(site);
  const answer = await desk.save(desk.form({ excerpt: "Typed on the old page.", opened: null }, before));
  assert.equal(answer.stale, true, JSON.stringify(answer));
  assert.match(answer.error, /could not tell which version/);
  assert.match(answer.error, /nothing was saved/);
  assert.doesNotMatch(answer.error, /saved again/, "nobody knows that, so it is not said");
  assert.equal(answer.opened, "");
  assert.deepEqual(onlyPost(site), before);
});

test("the day a post first went out is the one the site holds, whatever the form says", async () => {
  const desk = await newDesk();
  const { site } = desk;
  site.write("a.txt", file("Notes on the cache", FOUR, ["date: 2026-08-28"]));
  assert.equal(site.post("a.txt").code, 0);
  const day = "2026-08-28T00:00:00.000Z";
  assert.equal(onlyPost(site).published_at, day);
  // a form carrying a day of its own, as the desk's hidden box once did
  assert.ok((await desk.save(desk.form({ also: { published_at: "2031-01-01T00:00:00.000Z" } }, onlyPost(site)))).saved);
  assert.equal(onlyPost(site).published_at, day);
  // taken down and put back at the desk, it is not dated today
  assert.ok((await desk.save(desk.form({ published: false }, onlyPost(site)))).saved);
  assert.equal(onlyPost(site).published, false);
  assert.equal(onlyPost(site).published_at, day, "the day survives being taken down");
  assert.ok((await desk.save(desk.form({ published: true }, onlyPost(site)))).saved);
  assert.equal(onlyPost(site).published_at, day);
});

test("a draft that goes out at the desk for the first time is dated then, and a draft is not dated", async () => {
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Notes on the lock", body_md: FOUR[1] }));
  assert.equal(onlyPost(site).published_at, null);
  const from = Date.now();
  assert.ok((await desk.save(desk.form({ published: true }, onlyPost(site)))).saved);
  const dated = Date.parse(onlyPost(site).published_at);
  assert.ok(dated >= from && dated <= Date.now(), `dated ${onlyPost(site).published_at}`);
});

test("the stamp is compared by savePost and is never handed to the store", async () => {
  // In Postgres the column keeps finer time than the text a page is given. A stamp put into
  // the query would match almost never, and this file for a database would not notice.
  const desk = await newDesk();
  const { site, store } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  const handed = [];
  const real = store.upsert;
  store.upsert = async (input) => { handed.push(Object.keys(input).sort()); return real.call(store, input); };
  assert.ok((await desk.save(desk.form({ excerpt: "A line." }, onlyPost(site)))).saved);
  assert.deepEqual(handed, [["body_md", "body_text", "cover_url", "excerpt", "id", "published", "published_at", "reading_time", "slug", "tags", "title"]]);
});

test("the desk run as a process sends the stamp of the post as it is, and can be told to send an older one or none", async () => {
  const { site } = await newDesk();
  assert.equal(site.desk({ title: "Notes on the cache", body_md: FOUR[0] }).code, 0);
  const first = onlyPost(site).updated_at;
  assert.equal(site.desk({ slug: "notes-on-the-cache", excerpt: "one" }).code, 0, "a page drawn this moment saves");
  const older = site.desk({ slug: "notes-on-the-cache", excerpt: "two", opened: first });
  assert.equal(older.code, 3, older.out);
  assert.match(older.out, /^refused: .*saved again after this page was opened/m);
  assert.match(older.out, /^stale: true$/m);
  const none = site.desk({ slug: "notes-on-the-cache", excerpt: "three", opened: null });
  assert.equal(none.code, 3, none.out);
  assert.match(none.out, /^refused: .*could not tell which version/m);
  assert.match(none.out, /^stale: true$/m);
  assert.equal(onlyPost(site).excerpt, "one");
});

// ---------------------------------------------------------------- what savePost answers

test("a save that went through says which post it was, where it is, and whether it is out", async () => {
  const desk = await newDesk();
  const { site } = desk;
  assert.deepEqual(await desk.save(desk.form({ title: "  Notes on the cache ", body_md: "Some text.", published: true })),
    { saved: true, title: "Notes on the cache", slug: "notes-on-the-cache", published: true });
  assert.deepEqual(await desk.save(desk.form({ published: false, slug: "the-cache" }, onlyPost(site))),
    { saved: true, title: "Notes on the cache", slug: "the-cache", published: false });
});

test("every refusal hands back what was in the boxes and the stamp the form carried", async () => {
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  await desk.save(desk.form({ title: "Notes on the lock", body_md: FOUR[1] }));
  const post = site.at("notes-on-the-cache");
  const typed = { title: "Notes on the cache, again", body_md: `${FOUR[0]}\n\nAnd more.`, tags: "go, caches", excerpt: "A line.", published: true };
  const refused = async (label, form, wants) => {
    const answer = await desk.save(form);
    assert.ok(answer && "error" in answer, `${label}: ${JSON.stringify(answer)}`);
    assert.match(answer.error, wants, label);
    assert.equal(answer.fields.title, form.get("title"), label);
    assert.equal(answer.fields.body_md, String(form.get("body_md")).replace(/\r\n/g, "\n"), `${label}: the text, with plain line endings`);
    assert.equal(answer.fields.tags, form.get("tags"), label);
    assert.equal(answer.fields.published, form.get("published") === "on", label);
    assert.equal(answer.opened, form.get("opened") ?? "", `${label}: the stamp`);
  };
  await refused("a cover that is not an address", desk.form({ ...typed, cover_url: "cover.png" }, post), /cover has to be an address/);
  await refused("an address another post has", desk.form({ ...typed, slug: "notes-on-the-lock" }, post), /Another post already has the address \/blog\/notes-on-the-lock/);
  await refused("a title with nothing to make an address from", desk.form({ title: "!!!", body_md: "Text." }), /no letters or numbers/);
  await refused("an older stamp", desk.form({ ...typed, opened: "2020-01-01T00:00:00.000Z" }, post), /saved again after this page was opened/);
  const wake = desk.failing("getById", 1);
  await refused("a database that is asleep", desk.form(typed, post), /database did not answer.*fetch failed/);
  wake();
  await desk.auth.endSession();
  await refused("a sign in that has run out", desk.form(typed, post), /You are signed out/);
  await desk.auth.startSession();
  assert.deepEqual(site.at("notes-on-the-cache"), post, "and none of them changed the post");
  assert.equal(site.posts().length, 2);
});

// ---------------------------------------------------------------- the post was deleted while its editor was open

test("a post deleted while its editor was open is not saved and not brought back, and the sentence is its own", async () => {
  // it used to say "The post did not save. The post did not save. ... press save again", for ever
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Open in two tabs", body_md: FOUR[0], published: true }));
  const open = onlyPost(site);
  site.remove(open.slug);                              // deleted in another tab
  for (const press of [1, 2, 3]) {
    const answer = await desk.save(desk.form({ body_md: `${FOUR[0]}\n\nTwo hours of text.` }, open));
    assert.equal(answer.gone, true, `press ${press}: ${JSON.stringify(answer)}`);
    assert.match(answer.error, /no longer on the site/);
    assert.match(answer.error, /nothing was saved/);
    assert.match(answer.error, /save it as a new post/);
    assert.doesNotMatch(answer.error, /did not save/);
    assert.doesNotMatch(answer.error, /press save again/, "that can never work, so it is not said");
    assert.equal(answer.fields.body_md, `${FOUR[0]}\n\nTwo hours of text.`);
    assert.equal(site.posts().length, 0, "a post deleted on purpose is not put back by a save");
  }
});

test("pressed as a new post, the text of a deleted post is saved once, as a new post, at an address made again", async () => {
  const desk = await newDesk();
  const { site } = desk;
  // an address typed at the old desk, kept as typed for as long as the post lived
  site.put({ slug: "OTel_Notes.v2", title: "OTel notes", body_md: FOUR[0], published: true, published_at: "2026-08-28T00:00:00.000Z" });
  const open = onlyPost(site);
  site.remove("OTel_Notes.v2");
  const typed = { body_md: `${FOUR[0]}\n\nTwo hours of text.` };
  const answer = await desk.save(desk.form({ ...typed, as_new: true }, open));
  assert.deepEqual(answer, { saved: true, title: "OTel notes", slug: "otel-notes-v2", published: true });
  const made = onlyPost(site);
  assert.notEqual(made.id, open.id);
  assert.equal(made.body_md, typed.body_md);
  assert.notEqual(made.published_at, "2026-08-28T00:00:00.000Z", "it is a new post, dated when it went out");
  assert.ok(Date.parse(made.published_at) > Date.parse("2026-08-28T00:00:00.000Z"));
  // pressed twice, because the first answer was slow, it is still one post
  const twice = await desk.save(desk.form({ ...typed, as_new: true }, open));
  assert.ok(twice.saved, JSON.stringify(twice));
  assert.equal(site.posts().length, 1);
});

test("as a new post means nothing while the post is still there", async () => {
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Still here", body_md: FOUR[0] }));
  const post = onlyPost(site);
  // an ordinary save of that post, whatever the extra field says
  assert.ok((await desk.save(desk.form({ excerpt: "A line.", as_new: true }, post))).saved);
  assert.equal(onlyPost(site).id, post.id);
  assert.equal(onlyPost(site).excerpt, "A line.");
  // and it does not get round the check for a page that is out of date
  const stale = await desk.save(desk.form({ excerpt: "Another.", as_new: true }, post));
  assert.equal(stale.stale, true, JSON.stringify(stale));
  assert.equal("gone" in stale, false, "a post that is there is not called gone because a form says so");
  assert.equal(onlyPost(site).excerpt, "A line.");
  // nor is any other refusal of such a form, once the site has looked and found the post
  const taken = await desk.save(desk.form({ slug: "", title: "!!!", as_new: true }, onlyPost(site)));
  assert.match(taken.error, /no letters or numbers/);
  assert.equal("gone" in taken, false);
  // and a form for a new post has no post to be gone, whatever else it carries
  const fresh = await desk.save(desk.form({ title: "!!!", body_md: "Text.", as_new: true }));
  assert.match(fresh.error, /no letters or numbers/);
  assert.equal("gone" in fresh, false);
});

test("as a new post, refused for another reason, still comes back marked gone, and names the button to press again", async () => {
  // Without the mark the editor took the second button away, and "press save again" led back
  // to the sentence that the post is gone. Saving the text took four presses where two should do.
  const desk = await newDesk();
  const { site, store } = desk;
  await desk.save(desk.form({ title: "Open in two tabs", body_md: FOUR[0] }));
  await desk.save(desk.form({ title: "Notes on the lock", body_md: FOUR[1] }));
  const open = site.at("open-in-two-tabs");
  site.remove(open.slug);                              // deleted in another tab
  const typed = { body_md: `${FOUR[0]}\n\nTwo hours of text.`, as_new: true };
  const refused = async (label, change, wants) => {
    const answer = await desk.save(desk.form({ ...typed, ...change }, open));
    assert.ok(answer && "error" in answer, `${label}: ${JSON.stringify(answer)}`);
    assert.equal(answer.gone, true, `${label}: the second button stays`);
    assert.match(answer.error, wants, label);
    assert.doesNotMatch(answer.error, /press save\b/i, `${label}: plain save would only be told again that the post is gone`);
    assert.equal(site.posts().length, 1, label);
  };
  const again = /^The database did not answer, so nothing was saved\. Press "save it as a new post" again in a moment\. \(fetch failed\)$/;
  let wake = desk.failing("getById", 1);
  await refused("the database did not answer the look for the post", {}, again);
  wake();
  wake = desk.failing("listAll", 1);
  await refused("the database did not answer the read of every post", {}, again);
  wake();
  await refused("a cover that is not an address", { cover_url: "cover.png" }, /cover has to be an address/);
  await refused("an address another post has", { slug: "notes-on-the-lock" }, /Another post already has the address \/blog\/notes-on-the-lock/);
  await refused("a title with nothing to make an address from", { title: "!!!", slug: "" }, /no letters or numbers/);
  const real = store.upsert;
  store.upsert = async () => { throw new Error("connection terminated unexpectedly"); };
  await refused("the write failed", {}, /^The post did not save\. connection terminated unexpectedly\. What you typed is still on this page, so press "save it as a new post" again\.$/);
  store.upsert = real;
  await desk.auth.endSession();
  await refused("a sign in that has run out", {}, /^You are signed out, so nothing was saved\. Sign in again in another tab, then press "save it as a new post" here\. What you typed is still on this page\.$/);
  await desk.auth.startSession();
  // pressed once more, with nothing in the way, it is saved
  assert.ok((await desk.save(desk.form(typed, open))).saved);
  assert.equal(site.posts().length, 2);
});

test("when the row goes between the look and the write, the store's sentence is said once", async () => {
  const desk = await newDesk();
  const { site, store } = desk;
  await desk.save(desk.form({ title: "Here, then not", body_md: FOUR[0] }));
  const post = onlyPost(site);
  // what lib/store/neon.ts throws when its update finds no row
  store.upsert = async () => { throw new Error("The post did not save."); };
  const answer = await desk.save(desk.form({ excerpt: "A line." }, post));
  assert.equal(answer.error.match(/The post did not save\./g)?.length, 1, answer.error);
  assert.match(answer.error, /What you typed is still on this page/);
  // any other reason is still passed on, as a sentence
  store.upsert = async () => { throw new Error("connection terminated unexpectedly"); };
  assert.match((await desk.save(desk.form({ excerpt: "A line." }, post))).error, /^The post did not save\. connection terminated unexpectedly\. What you typed/);
  store.upsert = async () => { throw "a bare string"; };
  assert.match((await desk.save(desk.form({ excerpt: "A line." }, post))).error, /^The post did not save\. The database gave no reason\. What you typed/);
});

// ---------------------------------------------------------------- a new post that is already there

test("a new post saved a second time, because the first answer was lost, is still one post, and the second save says saved", async () => {
  const desk = await newDesk();
  const { site } = desk;
  const typed = { title: "Written on the train", body_md: FOUR.join("\n\n"), tags: "go, go, trains", excerpt: "  One line. ", cover_url: "/covers/train.png", published: true };
  assert.ok((await desk.save(desk.form(typed))).saved);
  const made = onlyPost(site);
  // the browser never heard, so the same form is sent again
  assert.deepEqual(await desk.save(desk.form(typed)), { saved: true, title: "Written on the train", slug: "written-on-the-train", published: true });
  assert.deepEqual(onlyPost(site), made, "and nothing was written the second time");
});

test("the same title and text with anything else different is refused, names the post, and makes no second copy", async () => {
  // the old sentence said to type a different address, and doing that put the post up twice
  const desk = await newDesk();
  const { site } = desk;
  const typed = { title: "Written on the train", body_md: FOUR.join("\n\n"), tags: "go", excerpt: "One line.", cover_url: "/covers/train.png", published: true };
  await desk.save(desk.form(typed));
  const made = onlyPost(site);
  const different = { "another address": { slug: "written-on-the-train-2" }, "other tags": { tags: "go, trains" }, "another summary": { excerpt: "Another line." }, "another cover": { cover_url: "" }, "the tick": { published: false } };
  for (const [what, change] of Object.entries(different)) {
    const answer = await desk.save(desk.form({ ...typed, ...change }));
    assert.ok(answer && "error" in answer, `${what}: ${JSON.stringify(answer)}`);
    assert.match(answer.error, /^A post with this title and this text is already on the site, live at \/blog\/written-on-the-train\. /, what);
    assert.match(answer.error, /Nothing new was saved/, what);
    assert.match(answer.error, /Open "Written on the train" from the desk/, what);
    assert.doesNotMatch(answer.error, /type a different one/, what);
    assert.deepEqual(site.posts(), [made], `${what}: one post, as it was`);
  }
});

test("a draft is found too, and line endings do not hide it", async () => {
  // getBySlug only sees what is published, and a row from the old desk has CR LF in it
  const desk = await newDesk();
  const { site } = desk;
  site.put({ slug: "what-tracing-is", title: "What tracing is", body_md: "One line,\r\nand another.\r\n\r\nA second paragraph." });
  const answer = await desk.save(desk.form({ title: "What tracing is", slug: "tracing", body_md: "One line,\nand another.\n\nA second paragraph." }));
  // a draft is not served at its address, so the sentence does not say it is at it
  assert.match(answer.error, /^A post with this title and this text is already on the site, as a draft with the address \/blog\/what-tracing-is\. /);
  assert.equal(site.posts().length, 1);
});

test("only the same title over the same text counts, and anything else is answered as before", async () => {
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Weeknotes", body_md: FOUR[0] }));
  // the same title over other words, sent to the address that is taken
  const taken = await desk.save(desk.form({ title: "Weeknotes", body_md: FOUR[1] }));
  assert.match(taken.error, /Another post already has the address \/blog\/weeknotes, so type a different one/);
  // and to an address of its own it is a second post, which is what two weeks of weeknotes are
  assert.ok((await desk.save(desk.form({ title: "Weeknotes", slug: "weeknotes-2", body_md: FOUR[1] }))).saved);
  // the same words under another title are a second post as well: the desk has no way to ask about them
  assert.ok((await desk.save(desk.form({ title: "The cache, again", body_md: FOUR[0] }))).saved);
  assert.equal(site.posts().length, 3);
});

test("a new post is not saved blind when the posts cannot be read", async () => {
  const desk = await newDesk();
  const { site } = desk;
  desk.failing("listAll");
  const answer = await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  assert.match(answer.error, /database did not answer, so nothing was saved.*fetch failed/);
  assert.equal(site.posts().length, 0);
});

// ---------------------------------------------------------------- the proxy lets a POST through

test("the proxy sends a signed out page load to the sign in, and lets every POST under /admin through", async () => {
  // A save is a POST to its own page. Turned away here, it never reached savePost, the
  // browser could not read the answer, and the editor was replaced by an error page.
  const desk = await newDesk();
  const { proxy, config } = await desk.proxy();
  assert.deepEqual(config, { matcher: ["/admin/:path*"] }, "the matcher is not widened");
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
  const now = Math.floor(Date.now() / 1000);
  const good = await new SignJWT({ desk: true }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(now).setExpirationTime(now + 3600).sign(secret);
  const ranOut = await new SignJWT({ desk: true }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(now - 8 * 86400).setExpirationTime(now - 60).sign(secret);
  const ask = async (method, path, cookie) => {
    const res = await proxy(new NextRequest(`https://site.invalid${path}`, { method, headers: cookie ? { cookie: `desk=${cookie}` } : {}, ...(method === "POST" ? { body: "x" } : {}) }));
    return res.headers.get("x-middleware-next") ? "through" : `${res.status} ${new URL(res.headers.get("location")).pathname}`;
  };
  const pages = ["/admin", "/admin/new", "/admin/edit/abc", "/admin/delete/abc"];
  for (const path of pages) {
    assert.equal(await ask("GET", path, good), "through", `signed in, ${path}`);
    assert.equal(await ask("GET", path, null), "307 /admin/login", `no cookie, ${path}`);
    assert.equal(await ask("GET", path, ranOut), "307 /admin/login", `a sign in that ran out, ${path}`);
    assert.equal(await ask("GET", path, "not-a-token"), "307 /admin/login", `a cookie that is not one, ${path}`);
    for (const cookie of [good, null, ranOut]) assert.equal(await ask("POST", path, cookie), "through", `a POST to ${path}`);
  }
  assert.equal(await ask("GET", "/admin/login", null), "through");
  assert.equal(await ask("POST", "/admin/login", null), "through");
});

test("signed out, a save comes back as a sentence with the boxes in it, and saves nothing", async () => {
  const desk = await newDesk();
  const { site } = desk;
  await desk.auth.endSession();
  const answer = await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  assert.match(answer.error, /^You are signed out, so nothing was saved\. Sign in again in another tab, then press save here\./);
  assert.equal(answer.fields.body_md, FOUR[0]);
  assert.equal(site.posts().length, 0);
});

test("signed out, delete sends the writer to the sign in and deletes nothing", async () => {
  // it used to throw. the proxy turned the request away first, and it no longer does.
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  await desk.auth.endSession();
  assert.equal(await sentTo(() => desk.actions.deletePost(undefined, desk.form({}, onlyPost(site)))), "/admin/login");
  assert.equal(site.posts().length, 1);
});

test("every page of the desk checks the sign in for itself, and signed out it is the sign in and nothing else", async () => {
  // the proxy no longer stands in front of a POST, so nothing may lean on it
  const desk = await newDesk();
  const { site, store, built } = desk;
  const Login = (await import(built.login)).default;
  await desk.save(desk.form({ title: "A draft nobody else may read", body_md: FOUR[0] }));
  const id = onlyPost(site).id;
  await desk.auth.endSession();
  const list = words(await (await desk.page("list"))());
  assert.match(list, /Not you/);
  assert.doesNotMatch(list, /A draft nobody else may read/);
  // The other three draw the sign in in their own place. They do not send the browser there:
  // after a save posted with JavaScript off, a redirect from a page makes the browser post the
  // form again to the sign in page, which answers "Internal Server Error".
  let reads = 0;
  for (const read of ["getById", "listAll"]) { const real = store[read]; store[read] = async (...args) => { reads++; return real.apply(store, args); }; }
  for (const [name, props] of [["new", undefined], ["edit", at(id)], ["delete", at(id)]]) {
    const drawn = await (await desk.page(name))(props);
    assert.equal(drawn.type, Login, `${name}: the sign in, and only that`);
    assert.doesNotMatch(words(drawn), /A draft nobody else may read/, name);
  }
  assert.equal(reads, 0, "and the post is not even read for someone who is signed out");
});

test("the error page promises only what is true whether or not the script was running", async () => {
  const desk = await newDesk();
  const drawn = createElement(await desk.page("error"), { error: new Error("fetch failed"), reset() {} });
  const said = words(drawn);
  assert.match(said, /may or may not have gone through/);
  assert.match(said, /while its script was running is kept in this browser as it is typed, and again when save is pressed, unless the browser refuses to store it\./);
  // a save that went through and lost its answer leaves a kept text that says what the post says, and that one is not offered
  assert.match(said, /whatever the browser did not see saved is offered back, unless the post already says the same\./);
  // It once had to name a state in which that was not so: two tabs on one post, where typing in
  // the other tab wrote over this one's text. The editor now moves that text to the offers
  // before it writes where the text was, so the page must not say the browser may have lost it.
  assert.doesNotMatch(said, /one limit|[Tt]wo tabs|other tab|may be keeping/);
  // it cannot know either of these, and the reason is not the writer's to decode
  assert.doesNotMatch(said, /nothing was saved|is still on this page|fetch failed/i);
  const html = renderToStaticMarkup(drawn);
  assert.match(html, /<a[^>]*href="\/admin"/, "a way back to the desk");
  assert.match(html, /<a[^>]*href=""/, "and a plain link that loads this page again, which works with the script off");
});

// ---------------------------------------------------------------- delete asks first

test("the list has nothing that deletes: delete is a link to a page that asks", async () => {
  const desk = await newDesk();
  const { site, actions, built } = desk;
  const DeleteForm = (await import(built.deleteForm())).default;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0], published: true }));
  const drawn = await (await desk.page("list"))();
  assert.deepEqual(pieces(drawn, (el) => el.type === DeleteForm || (el.type === "form" && el.props.action === actions.deletePost)), [], "no form that deletes at one click");
  assert.deepEqual(pieces(drawn, (el) => el.type === "button").map(words), ["sign out"], "and no button but the one that signs out");
  const link = pieces(drawn, (el) => el.props.href === `/admin/delete/${onlyPost(site).id}`);
  assert.equal(link.length, 1);
  assert.equal(words(link[0]), "delete");
});

test("the page that asks names the post and says what delete means, and its button is the real delete", async () => {
  const desk = await newDesk();
  const { site, built } = desk;
  const DeleteForm = (await import(built.deleteForm())).default;
  site.put({ slug: "notes-on-the-cache", title: "Notes on the cache", body_md: FOUR[0], published: true, updated_at: "2026-10-05T14:03:00.000Z" });
  site.put({ slug: "notes-on-the-lock", title: "Notes on the lock", body_md: FOUR[1], updated_at: "2026-09-01T09:30:00.000Z" });
  const live = site.at("notes-on-the-cache");
  const drawn = await (await desk.page("delete"))(at(live.id));
  const said = words(drawn);
  assert.match(said, /Notes on the cache/);
  assert.match(said, /\/blog\/notes-on-the-cache/);
  assert.match(said, /\blive\b/);
  assert.match(said, /last changed 5 October 2026 at 14:03 UTC/);
  assert.match(said, /cannot be undone/);
  assert.match(said, /keeps no copy/);
  assert.doesNotMatch(said, /Notes on the lock/);
  // the one form on the page is the real one, handed this post and the version of it the page named
  const forms = pieces(drawn, (el) => el.type === DeleteForm);
  assert.equal(forms.length, 1);
  assert.deepEqual(forms[0].props, { id: live.id, opened: "2026-10-05T14:03:00.000Z" });
  const form = renderToStaticMarkup(forms[0]);
  assert.match(form, new RegExp(`<input type="hidden" name="id" value="${live.id}"/>`));
  assert.match(form, /<input type="hidden" name="opened" value="2026-10-05T14:03:00\.000Z"\/>/);
  assert.equal(form.match(/<button/g).length, 1);
  assert.match(form, /<button[^>]*>delete it<\/button>/);
  // the two ways out that delete nothing both lead to the desk and nowhere else
  const leadsTo = (label) => pieces(drawn, (el) => el.props.href !== undefined && words(el) === label).map((el) => el.props.href);
  assert.deepEqual(leadsTo("keep it"), ["/admin"]);
  assert.deepEqual(leadsTo("back to the desk"), ["/admin"]);
  assert.match(said, /This one is out, so its page goes with it\./);
  // a draft is called a draft, and has no page on the site to go with it
  const draft = words(await (await desk.page("delete"))(at(site.at("notes-on-the-lock").id)));
  assert.match(draft, /a draft/);
  assert.doesNotMatch(draft, /\blive\b/);
  assert.match(draft, /cannot be undone/);
  assert.doesNotMatch(draft, /This one is out|its page goes with it/);
});

test("delete removes that post and no other, and goes back to the desk", async () => {
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  await desk.save(desk.form({ title: "Notes on the lock", body_md: FOUR[1] }));
  const doomed = site.at("notes-on-the-cache");
  assert.equal(await sentTo(() => desk.actions.deletePost(undefined, desk.form({}, doomed))), "/admin");
  assert.deepEqual(site.posts().map((p) => p.slug), ["notes-on-the-lock"]);
  // pressed twice, the second press finds nothing to delete and still ends on the desk
  assert.equal(await sentTo(() => desk.actions.deletePost(undefined, desk.form({}, doomed))), "/admin");
  assert.deepEqual(site.posts().map((p) => p.slug), ["notes-on-the-lock"]);
});

test("delete does not act on an old picture: a post saved again since the page asked is left alone", async () => {
  // the page named the post as it was then, and deleting cannot be undone
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  const asked = onlyPost(site);                        // the page that asks is drawn now
  assert.ok((await desk.save(desk.form({ body_md: `${FOUR[0]}\n\nA week of work.` }, asked))).saved);
  const answer = await desk.actions.deletePost(undefined, desk.form({}, asked));
  assert.match(answer, /^This post was saved again after this page was opened, so it was not deleted\./);
  assert.equal(onlyPost(site).body_md, `${FOUR[0]}\n\nA week of work.`);
  // a form that does not say which version it showed is not told the post changed, and deletes nothing either
  const blind = await desk.actions.deletePost(undefined, desk.form({ opened: null }, onlyPost(site)));
  assert.match(blind, /^The desk could not tell which version of this post the page showed, so it was not deleted\./);
  assert.equal(site.posts().length, 1);
  // asked again on the post as it is now, it goes
  assert.equal(await sentTo(() => desk.actions.deletePost(undefined, desk.form({}, onlyPost(site)))), "/admin");
  assert.equal(site.posts().length, 0);
});

test("a delete the database did not answer comes back as a sentence, and can be pressed again", async () => {
  // thrown, it was an error page, and with JavaScript off a bare Internal Server Error
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  for (const asleep of ["getById", "remove"]) {
    const wake = desk.failing(asleep, 1);
    const answer = await desk.actions.deletePost(undefined, desk.form({}, onlyPost(site)));
    wake();
    assert.match(answer, /^The database did not answer, so the post may not have been deleted\. Press "delete it" again in a moment\. \(fetch failed\)$/, asleep);
    assert.equal(site.posts().length, 1, asleep);
  }
  assert.equal(await sentTo(() => desk.actions.deletePost(undefined, desk.form({}, onlyPost(site)))), "/admin");
  assert.equal(site.posts().length, 0);
});

test("the delete form, drawn holding what deletePost answered, shows the sentence, a plain link to load the page again, and a button that can be pressed", async () => {
  // Nothing drew the form with an answer in it, so the sentence could be hidden, or the
  // button held for good, and every test stayed green. Drawn here the way the server draws it
  // for a browser with JavaScript off, which is also the page that browser gets back.
  const desk = await newDesk();
  const { site } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  const asked = onlyPost(site);                        // the page that asks is drawn now
  const props = { id: asked.id, opened: asked.updated_at };
  const first = drawn({ of: "delete-form", props });
  assert.doesNotMatch(first.html, /role="alert"|load this page again/, "with nothing answered there is nothing to show");
  assert.match(first.html, /<button[^>]*>delete it<\/button>/);

  // the three things deletePost can answer, each asked of the real one
  assert.ok((await desk.save(desk.form({ excerpt: "Saved again, somewhere else." }, asked))).saved);
  const answers = { "the post was saved again": await desk.actions.deletePost(undefined, desk.form({}, asked)) };
  answers["the form carried no stamp"] = await desk.actions.deletePost(undefined, desk.form({ opened: null }, asked));
  const wake = desk.failing("getById", 1);
  answers["the database did not answer"] = await desk.actions.deletePost(undefined, desk.form({}, onlyPost(site)));
  wake();
  assert.equal(site.posts().length, 1, "none of the three deleted anything");

  for (const [why, answer] of Object.entries(answers)) {
    assert.equal(typeof answer, "string", why);
    const html = drawn({ of: "delete-form", props, formState: answered(answer, first) }).html;
    const alert = html.match(/<(\w+) role="alert"[^>]*>([\s\S]*?)<\/\1>/)?.[2] ?? "";
    const said = alert.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    assert.equal(said, `${answer} load this page again`, `${why}: the sentence, and under it the link`);
    // The browser's own reload would post the form again, with the stamp of the page as it
    // was, and be refused again. A plain link loads the page that asks afresh.
    assert.match(alert, new RegExp(`<a[^>]*href="/admin/delete/${asked.id}"[^>]*>load this page again</a>`), why);
    const button = html.match(/<button[^>]*>([^<]*)<\/button>/);
    assert.equal(button[1], "delete it", why);
    // the attribute, not the class that says how a held button looks
    assert.doesNotMatch(button[0], /\sdisabled(=|\s|>)/, `${why}: the button is not held, so it can be pressed again`);
    assert.match(html, new RegExp(`<input type="hidden" name="id" value="${asked.id}"/>`), why);
    assert.match(html, new RegExp(`<input type="hidden" name="opened" value="${asked.updated_at.replace(/\./g, "\\.")}"/>`), why);
  }
  // every sentence that says to load the page again says to do it with that link
  assert.match(answers["the post was saved again"], /^This post was saved again after this page was opened, so it was not deleted\. .*load the page again with the link below/);
  assert.match(answers["the form carried no stamp"], /^The desk could not tell which version of this post the page showed, so it was not deleted\. Load the page again with the link below/);
});

test("when the post cannot be read, or is not there, the page that asks says so and has no button", async () => {
  const desk = await newDesk();
  const { site, built } = desk;
  const DeleteForm = (await import(built.deleteForm())).default;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  const id = onlyPost(site).id;
  const Delete = await desk.page("delete");
  const noButton = (drawn) => assert.deepEqual(pieces(drawn, (el) => el.type === DeleteForm || el.type === "form" || el.type === "button"), []);

  const wake = desk.failing("getById");
  const unread = await Delete(at(id));
  wake();
  assert.match(words(unread), /The database did not answer, so the desk cannot show which post this is\. Load the page again in a moment\. \(fetch failed\)/);
  noButton(unread);

  const missing = await Delete(at("22222222-2222-4222-8222-222222222222"));
  assert.match(words(missing), /not on the site/);
  noButton(missing);
  assert.equal(site.posts().length, 1);
});

// ---------------------------------------------------------------- reads at the desk say when the database did not answer

test("the desk's read hands back its own error, whatever another request's read did to the shared one", async () => {
  const desk = await newDesk();
  const { site, posts, store } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0], published: true }));
  // the desk's read of everything fails, and a visitor's read of the public list a moment later works
  store.listPublished = async () => site.posts().filter((p) => p.published);
  desk.failing("listAll");
  const mine = await posts.listForDesk();
  assert.equal((await posts.listPublished()).length, 1);
  assert.equal(posts.lastReadError, null, "the one variable the whole server shares says all is well");
  assert.deepEqual(mine, { got: [], error: "fetch failed" }, "and the desk still knows its own read failed");
  assert.deepEqual(await posts.getForDesk("x"), { got: null, error: null }, "a read that works says so");
});

test("the desk's read asks twice before it gives up, because the database sleeps", async () => {
  const desk = await newDesk();
  const { posts } = desk;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  desk.failing("listAll", 1);
  const read = await posts.listForDesk();
  assert.equal(read.error, null);
  assert.equal(read.got.length, 1);
});

test("the list says the database did not answer, and why, and does not say there is nothing", async () => {
  const desk = await newDesk();
  const { site } = desk;
  const List = await desk.page("list");
  assert.match(words(await List()), /Nothing here yet\./, "with no posts and a database that answers, it does say so");
  await desk.save(desk.form({ title: "The one post", body_md: FOUR[0], published: true }));
  assert.match(words(await List()), /The one post/);
  desk.failing("listAll");
  const said = words(await List());
  assert.match(said, /The database did not answer, so the posts cannot be listed\. Load the page again in a moment\. \(fetch failed\)/);
  assert.doesNotMatch(said, /Nothing here yet/);
  assert.match(said, /write something/, "the rest of the desk is still there");
  assert.equal(site.posts().length, 1);
});

test("the edit page never hands the editor an empty post: a read that failed gives it the id and the reason", async () => {
  // empty boxes with the post's id in the form would save an empty post over the real one
  const desk = await newDesk();
  const { site, built } = desk;
  const Editor = (await import(built.editor)).default;
  await desk.save(desk.form({ title: "Notes on the cache", body_md: FOUR[0] }));
  const post = onlyPost(site);
  const Edit = await desk.page("edit");
  const handed = async (id) => { const found = pieces(await Edit(at(id)), (el) => el.type === Editor); assert.equal(found.length, 1); return found[0].props; };

  assert.deepEqual(await handed(post.id), { post });
  const wake = desk.failing("getById");
  assert.deepEqual(await handed(post.id), { lost: { id: post.id, reason: "fetch failed" } });
  wake();
  // a post that is not there is not a page that is not there: a save that was refused because
  // the post was deleted has to be drawn on it, with the text still in the boxes
  assert.deepEqual(await handed("22222222-2222-4222-8222-222222222222"), { lost: { id: "22222222-2222-4222-8222-222222222222" } });
});
