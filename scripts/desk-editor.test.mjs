// npm run desk
// The editor of the writing desk, run for real: app/admin/Editor.tsx in headless Chromium, on
// the React that Next ships, with no server. See scripts/sim/editor for how. Where a test says
// "the site", it is the real savePost on a JSON file for a database (scripts/sim/in-process.mjs).
//
// It needs Playwright, which is not a dependency of the site. When none is found every test is
// skipped, with a sentence that says how to get it.
//
// Each test is a state the editor once lost text in, or changed whether a post was live in, or
// the state next to one.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { launch, profile, look, kept, keep, give, drawn, answered, settle, aPost, SAVE, AS_NEW, ORIGIN } from "./sim/editor/browser.mjs";
import { newDesk } from "./sim/in-process.mjs";

const found = await launch();
const browser = found.browser;
after(() => browser?.close());
/** a test that needs the browser, skipped with the reason when there is none */
const inBrowser = (name, run) => test(name, { skip: found.missing ?? false }, run);

const UNSAVED = (id) => `desk:unsaved:${id ?? "new"}`;
const OFFERED = (id) => `desk:offered:${id ?? "new"}`;
const TITLE = '[name="title"]';
const BODY = '[name="body_md"]';
const TICK = '[name="published"]';
const OFFER = 'form > [role="status"]:not(p)';
const REFUSAL = 'form > [role="alert"]';
const PNG = { name: "chart.png", type: "image/png" };
const LONG = "The floor of the page is made of the exact number of allocations one commit removed, and this is the long version of that story for anyone who wants every step of it written down in order.";

/** what the editor's boxes hold for a post as it is opened */
const boxes = (post, change = {}) => ({
  title: post?.title ?? "", slug: post?.slug ?? "", tags: post?.tags?.join(", ") ?? "", excerpt: post?.excerpt ?? "",
  cover_url: post?.cover_url ?? "", body_md: post?.body_md ?? "", published: post?.published ?? false, ...change,
});
/** a text kept by an earlier visit, in the shape the editor keeps one */
const earlier = (fields, over, at = "2026-09-20T09:00:00.000Z") => (over === undefined ? { at, fields } : { at, over, fields });
const movedOn = (page) => page.waitForFunction(() => (window.__pushed ?? []).length > 0);
const refused = (page, count = 1) => page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length >= n, [REFUSAL, count]);
const offered = (page, count = 1) => page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length === n, [OFFER, count]);
const says = (page, sel, text) => page.waitForFunction(([sel, text]) => document.querySelector(sel)?.textContent === text, [sel, text]);
const press = (page, nth, label) => page.locator(OFFER).nth(nth).getByText(label, { exact: true }).click();
const carried = (sent) => Object.fromEntries(sent);
/** the boxes a save carried, as savePost hands them back with a refusal */
const echo = (sent) => { const f = carried(sent); return { title: f.title, slug: f.slug, tags: f.tags, excerpt: f.excerpt, cover_url: f.cover_url, body_md: f.body_md, published: f.published === "on" }; };
/** the nth save has been sent, and its answer has reached the page */
const heard = async (page, d, nth) => {
  while (d.state.sent.length < nth) await new Promise((r) => setTimeout(r, 5));
  await says(page, SAVE, "save");
};
/** a save that waits until it is let go */
const heldBack = (answer) => {
  let letGo;
  const waiting = new Promise((done) => { letGo = done; });
  return { save: async () => { await waiting; return typeof answer === "function" ? answer() : answer; }, letGo };
};
const SAVED = { saved: true, title: "A post", slug: "a-post", published: false };

/** one browser profile for the length of a test. the page must not have complained, unless the test expects the editor to go. */
async function desk(opts, run) {
  const d = await profile(browser, opts);
  try {
    await run(d);
    if (!opts.complains) assert.deepEqual(d.state.trouble, [], "the page ran without complaint");
  } finally {
    await d.close();
  }
}

// ---------------------------------------------------------------- 1. nothing typed is thrown away

inBrowser("an old offer left alone, a morning's typing and a save that never answers: both texts are offered back", async () => {
  // nothing was kept while an offer was on the screen, so the morning's typing was nowhere
  await desk({ complains: true }, async (d) => {
    const post = aPost();
    const old = boxes(post, { body_md: `${post.body_md}\n\nan old half sentence` });
    await d.stock({ [UNSAVED(post.id)]: earlier(old) });
    const page = await d.open({ post });
    await offered(page);
    const today = `${post.body_md}\n\nFour hundred words typed today, with the offer still at the top of the page.`;
    await page.locator(BODY).fill(today);
    d.state.save = async () => ({ thrown: "Failed to fetch" });
    await page.locator(SAVE).click();
    await page.waitForSelector("#gone");

    const again = await d.open({ post });
    await offered(again, 2);
    const seen = (await look(again)).offers;
    assert.match(seen[0], /20 September at 09:00/, "the older one first");
    await press(again, 1, "put it back");
    await settle(again);
    assert.equal((await look(again)).body_md, today);
    await press(again, 0, "put it back");
    await settle(again);
    assert.equal((await look(again)).body_md, old.body_md, "and the old one is still there to be had");
  });
});

inBrowser("a text nobody answered is still on offer after a different post is saved from the same page", async () => {
  // every new post shares one place, and a save that worked used to empty it
  await desk({}, async (d) => {
    const train = boxes(null, { title: "The post from the train", body_md: "Nine hundred words that only exist here." });
    await d.stock({ [UNSAVED()]: earlier(train, null) });
    const page = await d.open();
    await offered(page);
    await page.locator(TITLE).fill("A quick note about something else");
    await page.locator(BODY).fill("Two lines.");
    d.state.save = async () => ({ saved: true, title: "A quick note about something else", slug: "a-quick-note-about-something-else", published: false });
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.equal(carried(d.state.sent[0]).body_md, "Two lines.");
    assert.equal(await kept(page, UNSAVED()), null, "what was saved is no longer kept");
    assert.deepEqual((await kept(page, OFFERED())).map((o) => o.fields.title), ["The post from the train"]);

    const again = await d.open();
    await offered(again);
    await press(again, 0, "put it back");
    await settle(again);
    assert.equal((await look(again)).body_md, "Nine hundred words that only exist here.");
  });
});

inBrowser("a save that never gets an answer takes the editor off the screen, and the text is offered the next time", async () => {
  await desk({ complains: true }, async (d) => {
    const post = aPost();
    const page = await d.open({ post });
    await page.locator(BODY).fill("First line.\n\nSecond line.\n\nA third line typed today.");
    d.state.save = async () => ({ thrown: "An unexpected response was received from the server." });
    await page.locator(SAVE).click();
    await page.waitForSelector("#gone");
    const again = await d.open({ post });
    await offered(again);
    await press(again, 0, "put it back");
    await settle(again);
    assert.equal((await look(again)).body_md, "First line.\n\nSecond line.\n\nA third line typed today.");
  });
});

// ---------------------------------------------------------------- 2. only the writer's own tick changes whether a post is out

inBrowser("the tick stays as the writer set it through a refused save, and the next save sends it", async () => {
  // React puts a form back to its defaults when its action answers, and the tick snapped back:
  // a post the writer had unticked stayed live, and the desk moved on as if it were done
  const site = await newDesk();
  for (const arrives of ["drawn by its script", "drawn by the server and woken"]) {
    for (const live of [true, false]) {
      for (const p of site.site.posts()) site.site.remove(p.slug);
      assert.ok((await site.save(site.form({ title: "Why the heap is 421 blocks", body_md: LONG, published: live }))).saved);
      const post = site.site.posts()[0];
      await desk({}, async (d) => {
        d.state.save = (fields) => site.save(fields);
        let page;
        if (arrives === "drawn by its script") page = await d.open({ post });
        else { page = await d.arrive(drawn({ props: { post } }).html, { post }); await d.wake(page, { post }); }
        await page.locator(TICK).setChecked(!live);
        // the database does not answer the first time it is asked
        site.failing("getById", 1);
        await page.locator(SAVE).click();
        await refused(page);
        await settle(page);
        const after = await look(page);
        assert.match(after.refusals.at(-1), /database did not answer/);
        assert.equal(after.tick, !live, `${arrives}, ${live ? "live" : "a draft"}: the tick after the refusal`);
        // the post is there, so there is no button that offers to save it as a new one: pressed, it would save this same post
        assert.equal(after.asNew, null, `${arrives}: a refusal that is not about a deleted post draws no second button`);
        // nothing typed. the sentence says to press save again.
        await page.locator(SAVE).click();
        await movedOn(page);
        assert.equal(site.site.posts()[0].published, !live, `${arrives}: on the site, what the writer chose`);
      });
    }
  }
});

inBrowser("after each of three refusals in a row, with the tick changed between them, the next save sends what the writer chose", async () => {
  await desk({}, async (d) => {
    const post = aPost({ published: true, published_at: "2026-09-01T10:00:00.000Z" });
    d.state.save = async (fields) => ({ error: "The database did not answer, so nothing was saved. Press save again in a moment. (fetch failed)", fields: echo(fields), opened: carried(fields).opened ?? "" });
    const page = await d.open({ post });
    for (const [n, chosen] of [false, true, false].entries()) {
      await page.locator(TICK).setChecked(chosen);
      await page.locator(SAVE).click();
      await heard(page, d, n + 1);
      await refused(page);
      await settle(page);
      assert.equal(d.state.sent.length, n + 1);
      assert.equal(carried(d.state.sent[n]).published === "on", chosen, `save ${n + 1} sent the tick as chosen`);
      assert.equal((await look(page)).tick, chosen, `and after refusal ${n + 1} the tick is where it was put`);
    }
  });
});

inBrowser("put it back never changes the tick", async () => {
  // the tick in a kept text is what the post was then, not something the writer chose now
  await desk({}, async (d) => {
    const live = aPost({ published: true, published_at: "2026-09-01T10:00:00.000Z" });
    await d.stock({ [UNSAVED(live.id)]: earlier(boxes(live, { body_md: "Typed while it was a draft.", published: false }), live.updated_at) });
    const page = await d.open({ post: live });
    await offered(page);
    await press(page, 0, "put it back");
    await settle(page);
    const back = await look(page);
    assert.equal(back.body_md, "Typed while it was a draft.");
    assert.equal(back.tick, true, "a live post is not unticked by a text from when it was a draft");
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.equal(carried(d.state.sent[0]).published, "on");
  });
  await desk({}, async (d) => {
    const draft = aPost();
    await d.stock({ [OFFERED(draft.id)]: [
      earlier(boxes(draft, { body_md: "Typed with Published ticked, and never saved.", published: true }), draft.updated_at),
      earlier(boxes(draft, { body_md: "Typed on another day, with the tick off.", published: false }), draft.updated_at, "2026-09-27T18:30:00.000Z"),
    ] });
    const page = await d.open({ post: draft });
    await offered(page, 2);
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.startsWith("Typed with Published ticked"));
    assert.equal((await look(page)).tick, false, "a draft does not go out because a tick was once tried");
    // and a tick the writer set in this sitting, before putting a text back, is left alone too
    await page.locator(TICK).check();
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.startsWith("Typed on another day"));
    assert.equal((await look(page)).tick, true);
  });
});

/** a site that draws the editor for one post as that post is now, and something else at every other address */
const siteWith = (now) => async (request) => (new URL(request.url()).pathname.startsWith("/admin/edit/") ? drawn({ props: { post: now() } }).html : "<p>another page of the site</p>");

inBrowser("a page fetched again after the Back button sends the tick the site holds, not the one the tab had before it left", async () => {
  // The browser put the old tick back on top of the page it had just fetched again, and the
  // editor took it for the writer's. A typo fixed and saved then took a live post down, or
  // put a draft out, with nobody having touched the tick.
  for (const live of [false, true]) {
    await desk({}, async (d) => {
      const was = aPost(live ? { published: true, published_at: "2026-09-01T10:00:00.000Z" } : {});
      let post = was;
      const page = await d.visit(`/admin/edit/${was.id}`, siteWith(() => post));
      await d.wake(page, { post });
      // nothing is typed or ticked. the tab goes to another address, and somewhere else the tick is changed and saved.
      await page.goto(`${ORIGIN}/blog`);
      post = { ...was, published: !live, published_at: "2026-09-01T10:00:00.000Z", updated_at: "2026-09-05T08:00:00.000Z" };
      await page.goBack();
      const fetched = await look(page);
      assert.equal(fetched.sends.opened, post.updated_at, "Back fetched the page again, so it carries the stamp of the post as it is now");
      assert.equal(fetched.tick, !live, `${live ? "taken down" : "published"} elsewhere: the browser did not put the old tick back`);
      await d.wake(page, { post });
      await page.locator(BODY).fill("First line.\n\nSecond line, with its typo fixed.");
      await settle(page);
      assert.equal((await look(page)).tick, !live);
      await page.locator(SAVE).click();
      await movedOn(page);
      const sent = carried(d.state.sent[0]);
      assert.equal(sent.opened, post.updated_at);
      assert.equal(sent.published === "on", !live, "the save says what the site holds, which is what the page showed");
      assert.match(sent.body_md, /typo fixed\.$/);
    });
  }
});

inBrowser("a tick changed and left unsaved does not come back after the Back button to be sent by a later save", async () => {
  // one tab, and nothing changed anywhere else
  for (const live of [false, true]) {
    await desk({}, async (d) => {
      const post = aPost(live ? { published: true, published_at: "2026-09-01T10:00:00.000Z" } : {});
      const page = await d.visit(`/admin/edit/${post.id}`, siteWith(() => post));
      await d.wake(page, { post });
      // the writer changes the tick, thinks better of it, and leaves without saving
      await page.locator(TICK).setChecked(!live);
      await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
      await page.goto(`${ORIGIN}/blog`);
      await page.goBack();
      assert.equal((await look(page)).tick, live, "the page that comes back shows what the site holds");
      await d.wake(page, { post });
      await settle(page);
      const back = await look(page);
      assert.equal(back.tick, live);
      assert.deepEqual(back.offers, [], "and a tick is not text, so nothing is offered back");
      await page.locator(BODY).fill("First line.\n\nSecond line, with its typo fixed.");
      await page.locator(SAVE).click();
      await movedOn(page);
      assert.equal(carried(d.state.sent[0]).published === "on", live, `${live ? "a live post stays out" : "a draft stays a draft"}`);
    });
  }
});

// ---------------------------------------------------------------- 3. while a save is on its way, and while an image is uploading

inBrowser("while a save is on its way the boxes are read only, the tick does not move, and an image is turned away with a line", async () => {
  // text typed while the button said saving was neither saved nor kept
  await desk({}, async (d) => {
    const post = aPost({ published: true, published_at: "2026-09-01T10:00:00.000Z" });
    const held = heldBack({ ...SAVED, published: true });
    d.state.save = held.save;
    let uploads = 0;
    d.state.upload = async (route) => { uploads++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://blob.test/img.png" }) }); };
    const page = await d.open({ post });
    await page.locator(BODY).fill("First line.\n\nSecond line. It has a tpyo.");
    await page.locator(SAVE).click();
    await says(page, SAVE, "saving");

    const during = await look(page);
    assert.deepEqual(during.readOnly, ["title", "slug", "tags", "excerpt", "cover_url", "body_md"]);
    assert.equal(during.buttonHeld, true);
    // the writer sees the typo and goes to fix it
    await page.locator(BODY).focus();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" Fixed, and a whole new paragraph.");
    await page.locator(TITLE).focus();
    await page.keyboard.type(" retitled");
    await page.locator(TICK).click({ force: true });
    await page.locator(TITLE).press("Enter");
    assert.equal(await give(page, "drop", [PNG]), true, "the browser is stopped from opening the file itself");
    assert.equal(await give(page, "paste", [PNG]), true);
    await settle(page);
    const tried = await look(page);
    assert.equal(tried.body_md, "First line.\n\nSecond line. It has a tpyo.");
    assert.equal(tried.title, "A post");
    assert.equal(tried.tick, true);
    assert.equal(uploads, 0, "and no image was sent anywhere");
    assert.equal(tried.notes.length, 1, JSON.stringify(tried.notes));
    assert.match(tried.notes[0], /save is on its way/);

    held.letGo();
    await movedOn(page);
    assert.equal(d.state.sent.length, 1, "and Enter in a box did not send a second save");
    assert.equal(carried(d.state.sent[0]).body_md, "First line.\n\nSecond line. It has a tpyo.");
    assert.equal(await kept(page, UNSAVED(post.id)), null, "what the save carried is what was in the boxes, so nothing is left to keep");
  });
});

inBrowser("while a save is on its way an offer cannot be put back either", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    await d.stock({ [UNSAVED(post.id)]: earlier(boxes(post, { body_md: "an older text" }), post.updated_at) });
    const held = heldBack(SAVED);
    d.state.save = held.save;
    const page = await d.open({ post });
    await offered(page);
    await page.locator(TITLE).fill("A post, retitled");
    await page.locator(SAVE).click();
    await says(page, SAVE, "saving");
    assert.equal(await page.locator(OFFER).nth(0).getByText("put it back", { exact: true }).isDisabled(), true);
    assert.equal(await page.locator(OFFER).nth(0).getByText("throw it away", { exact: true }).isDisabled(), true);
    held.letGo();
    await movedOn(page);
    assert.equal(carried(d.state.sent[0]).body_md, post.body_md);
  });
});

inBrowser("while an image is uploading the save button waits and says so, and Enter in a box sends nothing", async () => {
  // a post was saved without the image that was still on its way
  await desk({}, async (d) => {
    let land;
    d.state.upload = async (route) => { await new Promise((done) => { land = done; }); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://blob.test/chart.png" }) }); };
    const page = await d.open();
    await page.locator(TITLE).fill("A post with a chart");
    await page.locator(BODY).fill(LONG);
    await give(page, "drop", [PNG]);
    await page.waitForFunction(() => [...document.querySelectorAll("form span")].some((s) => /^uploading/.test(s.textContent)));
    const waiting = await look(page);
    assert.equal(waiting.button, "waiting for the image");
    assert.equal(waiting.buttonHeld, true);
    await page.locator(TITLE).press("Enter");
    await settle(page);
    assert.equal(d.state.sent.length, 0, "nothing was sent while the image was on its way");

    while (!land) await new Promise((r) => setTimeout(r, 10));
    land();
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.includes("blob.test/chart.png"));
    await says(page, SAVE, "save");
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.match(carried(d.state.sent[0]).body_md, /!\[chart\]\(https:\/\/blob\.test\/chart\.png\)/);
  });
});

// ---------------------------------------------------------------- 4. every change is kept in this browser

inBrowser("every change is kept in this browser, with the version of the post it was typed over", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const page = await d.open({ post });
    await settle(page);
    assert.equal(await kept(page, UNSAVED(post.id)), null, "nothing is kept until something is typed");
    const from = Date.now();
    await page.locator(TITLE).fill("A post, retitled");
    await page.locator(TICK).check();
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.published === true, UNSAVED(post.id));
    const mine = await kept(page, UNSAVED(post.id));
    assert.deepEqual(Object.keys(mine).sort(), ["at", "by", "fields", "over"]);
    assert.ok(Date.parse(mine.at) >= from - 1000 && Date.parse(mine.at) <= Date.now() + 1000, mine.at);
    assert.equal(mine.over, post.updated_at);
    assert.deepEqual(mine.fields, boxes(post, { title: "A post, retitled", published: true }));
    // `by` is the mark of the page that wrote it. It stays the same for as long as that page is open.
    assert.ok(typeof mine.by === "string" && mine.by.length >= 8, JSON.stringify(mine.by));
    await page.locator(BODY).fill("First line.\n\nSecond line, and more.");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md?.endsWith("and more."), UNSAVED(post.id));
    assert.equal((await kept(page, UNSAVED(post.id))).by, mine.by);

    const fresh = await d.open();
    await fresh.locator(BODY).fill("A first line of a new post.");
    await fresh.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED());
    const unborn = await kept(fresh, UNSAVED());
    assert.equal(unborn.over, null, "a new post has no version to be typed over");
    assert.deepEqual(unborn.fields, boxes(null, { body_md: "A first line of a new post." }));
    assert.notEqual(unborn.by, mine.by, "and another page has another mark");
    // the same post opened a second time is another page too
    const second = await d.open({ post });
    await second.locator(TITLE).fill("A post, retitled in a second tab");
    await second.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.title?.endsWith("a second tab"), UNSAVED(post.id));
    assert.notEqual((await kept(second, UNSAVED(post.id))).by, mine.by);
  });
});

inBrowser("typing is kept while an older text is still on offer, and the offer is not written over", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const old = boxes(post, { body_md: "an old half sentence" });
    await d.stock({ [UNSAVED(post.id)]: earlier(old, post.updated_at) });
    const page = await d.open({ post });
    await offered(page);
    await page.locator(BODY).fill("Typed today, with the offer still showing.");
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    assert.equal((await kept(page, UNSAVED(post.id))).fields.body_md, "Typed today, with the offer still showing.");
    assert.deepEqual((await kept(page, OFFERED(post.id))).map((o) => o.fields.body_md), ["an old half sentence"]);
  });
});

// ---------------------------------------------------------------- 5. an older unsaved text is an offer, and offers have their own place

inBrowser("on arrival a kept text that differs from the post becomes an offer, and its first place is free again", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const mine = earlier(boxes(post, { body_md: "Typed last week." }), post.updated_at);
    await d.stock({ [UNSAVED(post.id)]: mine });
    const page = await d.open({ post });
    await offered(page);
    assert.equal(await kept(page, UNSAVED(post.id)), null);
    assert.deepEqual(await kept(page, OFFERED(post.id)), [mine]);
    assert.equal((await look(page)).body_md, post.body_md, "the boxes hold the post until the writer says otherwise");
  });
});

inBrowser("a kept text that says what the post says is removed, whatever order it was written in and whatever its tick", async () => {
  await desk({}, async (d) => {
    const post = aPost({ excerpt: "A line.", cover_url: "/covers/a.png" });
    // the same six boxes, written down in another order, with the tick the other way
    const same = { published: true, body_md: post.body_md, cover_url: "/covers/a.png", excerpt: "A line.", tags: "go", slug: "a-post", title: "A post" };
    await d.stock({ [UNSAVED(post.id)]: earlier(same, post.updated_at) });
    const page = await d.open({ post });
    await settle(page);
    assert.equal((await look(page)).offers.length, 0);
    assert.equal(await kept(page, UNSAVED(post.id)), null);
    assert.deepEqual(await kept(page, OFFERED(post.id)) ?? [], []);
  });
  // the same for a text already on the list of offers: the post has caught up with it since
  await desk({}, async (d) => {
    const post = aPost();
    const other = earlier(boxes(post, { body_md: "something the post does not say" }), post.updated_at, "2026-09-27T18:30:00.000Z");
    await d.stock({ [OFFERED(post.id)]: [earlier(boxes(post, { published: true }), "2026-08-01T10:00:00.000Z"), other] });
    const page = await d.open({ post });
    await offered(page, 1);
    assert.match((await look(page)).offers[0], /27 September at 18:30/);
    assert.deepEqual(await kept(page, OFFERED(post.id)), [other]);
  });
  // And on a page that arrives holding a refused save. Its boxes are not the post's, so a kept
  // text has to be measured against the post itself: one that says what the post says is on
  // the site already, and is not offered back over what was typed.
  await desk({}, async (d) => {
    const post = aPost();
    const typed = boxes(post, { body_md: "typed before the script loaded, and refused" });
    const state = answered({ error: "The database did not answer, so nothing was saved. Press save again in a moment. (fetch failed)", fields: typed, opened: post.updated_at }, drawn({ props: { post } }));
    await d.stock({ [UNSAVED(post.id)]: earlier(boxes(post, { published: true }), post.updated_at) });
    const page = await d.arrive(drawn({ props: { post }, formState: state }).html, { post });
    await d.wake(page, { post }, state);
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md?.endsWith("and refused"), UNSAVED(post.id));
    await settle(page);
    assert.deepEqual((await look(page)).offers, [], "the post as it is on the site is not offered back to a page that holds newer typing");
    assert.deepEqual(await kept(page, OFFERED(post.id)) ?? [], []);
    assert.equal((await look(page)).body_md, typed.body_md);
  });
});

inBrowser("a row the old desk left with CR LF line endings is not offered back to itself", async () => {
  await desk({}, async (d) => {
    const post = aPost({ body_md: "First line.\r\n\r\nSecond line." });
    const page = await d.open({ post });
    // one letter typed and taken out again
    await page.locator(BODY).focus();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("x");
    await page.keyboard.press("Backspace");
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    const again = await d.open({ post });
    await settle(again);
    assert.deepEqual((await look(again)).offers, []);
  });
});

inBrowser("a text equal to an offer already listed is not listed twice, and two different ones are both offered, oldest first", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const first = earlier(boxes(post, { body_md: "the first unsaved text" }), post.updated_at, "2026-09-20T09:00:00.000Z");
    const second = earlier(boxes(post, { body_md: "the second unsaved text" }), post.updated_at, "2026-09-27T18:30:00.000Z");
    await d.stock({ [OFFERED(post.id)]: [first], [UNSAVED(post.id)]: earlier(boxes(post, { body_md: "the first unsaved text" }), post.updated_at, "2026-09-21T09:00:00.000Z") });
    const page = await d.open({ post });
    await offered(page);
    assert.equal((await kept(page, OFFERED(post.id))).length, 1);
    await page.close();

    await d.stock({ [UNSAVED(post.id)]: second });
    const again = await d.open({ post });
    await offered(again, 2);
    const seen = (await look(again)).offers;
    assert.match(seen[0], /2\d September at 09:00/);
    assert.match(seen[1], /27 September at 18:30/);
    assert.deepEqual((await kept(again, OFFERED(post.id))).map((o) => o.fields.body_md), ["the first unsaved text", "the second unsaved text"]);
  });
});

// ---------------------------------------------------------------- 6. only the two buttons remove an offer

inBrowser("throw it away removes that offer and no other, and nothing else removes one", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const first = earlier(boxes(post, { body_md: "the first unsaved text" }), post.updated_at, "2026-09-20T09:00:00.000Z");
    const second = earlier(boxes(post, { body_md: "the second unsaved text" }), post.updated_at, "2026-09-27T18:30:00.000Z");
    await d.stock({ [OFFERED(post.id)]: [first, second] });
    const page = await d.open({ post });
    await offered(page, 2);
    // a save the site refuses, then one that goes through, both with the offers left alone
    d.state.save = async (fields) => ({ error: "Nothing was saved. For the test.", fields: boxes(post), opened: carried(fields).opened ?? "" });
    await page.locator(SAVE).click();
    await refused(page);
    assert.equal((await kept(page, OFFERED(post.id))).length, 2);
    await press(page, 0, "throw it away");
    await offered(page, 1);
    assert.deepEqual(await kept(page, OFFERED(post.id)), [second]);
    d.state.save = async () => SAVED;
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.deepEqual(await kept(page, OFFERED(post.id)), [second], "a save that went through did not answer the offer for the writer");
  });
});

inBrowser("a save that went through removes the kept text only if it still holds what that save sent", async () => {
  // another tab on the same post typed while this one was saving
  await desk({}, async (d) => {
    const post = aPost();
    const held = heldBack(SAVED);
    d.state.save = held.save;
    const page = await d.open({ post });
    await page.locator(TITLE).fill("A post, retitled here");
    await page.locator(SAVE).click();
    await says(page, SAVE, "saving");
    const other = { at: new Date().toISOString(), over: post.updated_at, fields: boxes(post, { body_md: "A paragraph typed in the other tab." }) };
    await keep(page, UNSAVED(post.id), other);
    held.letGo();
    await movedOn(page);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), other, "the other tab's text was not this save's to throw away");
  });
});

// ---------------------------------------------------------------- 7. put it back is a swap

inBrowser("put it back swaps: what was typed since arriving becomes an offer before the boxes take the old text", async () => {
  // the paragraph typed just before pressing it used to be in neither the page nor the browser
  await desk({}, async (d) => {
    const post = aPost({ excerpt: "The line on the site.", cover_url: "/covers/site.png" });
    const old = boxes(post, { title: "A post, as it was going to be", slug: "a-post-renamed", tags: "go, old", excerpt: "An old line.", cover_url: "/covers/old.png", body_md: "old text" });
    await d.stock({ [UNSAVED(post.id)]: earlier(old, post.updated_at) });
    const page = await d.open({ post });
    await offered(page);
    await page.locator(BODY).fill("A paragraph typed just now, before noticing the offer.");
    await page.locator(TICK).check();
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "old text");

    const back = await look(page);
    assert.deepEqual({ title: back.title, slug: back.slug, tags: back.tags, excerpt: back.excerpt, cover_url: back.cover_url, body_md: back.body_md },
      { title: old.title, slug: old.slug, tags: old.tags, excerpt: old.excerpt, cover_url: old.cover_url, body_md: old.body_md }, "the post has not changed since, so the address comes back too");
    assert.equal(back.tick, true, "the tick is the writer's, from this sitting");
    await offered(page, 1);
    const list = await kept(page, OFFERED(post.id));
    assert.equal(list.length, 1, "the old offer is answered, and the one made of this sitting's typing takes its place");
    assert.deepEqual(list[0].fields, boxes(post, { body_md: "A paragraph typed just now, before noticing the offer.", published: true }));
    assert.equal(list[0].over, post.updated_at);
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md === "old text", UNSAVED(post.id));
    assert.deepEqual((await kept(page, UNSAVED(post.id))).fields, { ...old, published: true }, "what was put back counts as typed, so it is kept");

    // pressed again, it swaps back, and nothing is lost on the way
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.startsWith("A paragraph typed just now"));
    assert.deepEqual((await kept(page, OFFERED(post.id))).map((o) => o.fields.body_md), ["old text"]);
  });
});

inBrowser("put it back makes no offer of boxes nobody typed in, or of boxes typed back to what the post says", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    await d.stock({ [OFFERED(post.id)]: [earlier(boxes(post, { body_md: "one old text" }), post.updated_at), earlier(boxes(post, { body_md: "another old text" }), post.updated_at, "2026-09-27T18:30:00.000Z")] });
    const page = await d.open({ post });
    await offered(page, 2);
    await press(page, 0, "put it back");
    await offered(page, 1);
    assert.deepEqual((await kept(page, OFFERED(post.id))).map((o) => o.fields.body_md), ["another old text"], "the post as opened was not made an offer");
    // The text that was put back is on no list any more. Nothing had been typed, and it still
    // counts as typed from this moment, or a tab closed now would take it along.
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md === "one old text", UNSAVED(post.id));
    // typed back to exactly what the post says, then the other one put back
    await page.locator(BODY).fill(post.body_md);
    await press(page, 0, "put it back");
    await offered(page, 0);
    assert.equal(await kept(page, OFFERED(post.id)), null, "and an emptied list is not left lying in the browser");
    assert.equal((await look(page)).body_md, "another old text");
  });
});

inBrowser("put it back leaves the address alone when the post may have changed since the text was typed", async () => {
  const post = aPost({ slug: "where-it-lives-now" });
  const old = (over) => earlier(boxes(post, { slug: "where-it-used-to-live", body_md: "old text" }), over);
  // typed over an older version of the post
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED(post.id)]: old("2026-08-01T10:00:00.000Z") });
    const page = await d.open({ post });
    await offered(page);
    await press(page, 0, "put it back");
    await settle(page);
    assert.equal((await look(page)).slug, "where-it-lives-now");
    assert.equal((await look(page)).body_md, "old text");
  });
  // kept before the desk wrote down which version, so nobody can tell
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED(post.id)]: old(undefined) });
    const page = await d.open({ post });
    await offered(page);
    await press(page, 0, "put it back");
    await settle(page);
    assert.equal((await look(page)).slug, "where-it-lives-now");
  });
  // a new post has no version to have changed, so its address comes back with the rest
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED()]: earlier(boxes(null, { title: "From the train", slug: "from-the-train", body_md: "old text" })) });
    const page = await d.open();
    await offered(page);
    await press(page, 0, "put it back");
    await settle(page);
    assert.equal((await look(page)).slug, "from-the-train");
  });
});

// ---------------------------------------------------------------- 8. the offer says what it is

inBrowser("the offer says when it was typed, whether the post has changed since, and what it will not do to the tick", async () => {
  const post = aPost();
  const offerFor = async (stocked, props = { post }) => {
    let said;
    await desk({}, async (d) => {
      await d.stock(stocked);
      const page = await d.open(props);
      await offered(page);
      said = (await look(page)).offers[0];
    });
    return said;
  };
  const plain = await offerFor({ [UNSAVED(post.id)]: earlier(boxes(post, { body_md: "old text" }), post.updated_at) });
  assert.match(plain, /^Something was typed here on 20 September at 09:00, and this browser did not see it saved\./);
  assert.doesNotMatch(plain, /version|saved again|tick|address/, "nothing to warn about, so no warning");

  // The page it was typed on was opened in August. The post was saved on 1 September, from
  // somewhere else, and the typing came on 20 September, in the tab that had been left open.
  const changed = await offerFor({ [UNSAVED(post.id)]: earlier(boxes(post, { body_md: "old text" }), "2026-08-01T10:00:00.000Z") });
  assert.match(changed, /It was typed over an older version of this post\./);
  assert.match(changed, /Putting it back and then saving would write over what was saved after that version\./);
  assert.match(changed, /The address is left as it is now\./);
  assert.doesNotMatch(changed, /since then/, "the post was saved before these words were typed, not since");

  // kept before the desk wrote down which version, or with a stamp that says nothing
  for (const none of [earlier(boxes(post, { body_md: "old text" })), earlier(boxes(post, { body_md: "old text" }), ""), earlier(boxes(post, { body_md: "old text" }), "not a date")]) {
    const unknown = await offerFor({ [UNSAVED(post.id)]: none });
    assert.match(unknown, /The desk cannot tell whether this post has been saved again since this was typed over it\./, JSON.stringify(none.over));
    assert.match(unknown, /If it has, putting this back and then saving would write over that\./);
    assert.match(unknown, /The address is left as it is now\./);
    assert.doesNotMatch(unknown, /older version/, "it is not known, so it is not claimed");
  }

  const unborn = await offerFor({ [UNSAVED()]: earlier(boxes(null, { title: "From the train", body_md: "old text" })) }, {});
  assert.doesNotMatch(unborn, /version|saved again|address/, "a post that was never saved has no newer version");

  const ticked = await offerFor({ [UNSAVED(post.id)]: earlier(boxes(post, { body_md: "old text", published: true }), post.updated_at) });
  assert.match(ticked, /Published was ticked then\. The tick is left as it is now\./);
  const live = aPost({ published: true, published_at: "2026-09-01T10:00:00.000Z" });
  const unticked = await offerFor({ [UNSAVED(live.id)]: earlier(boxes(live, { body_md: "old text", published: false }), live.updated_at) }, { post: live });
  assert.match(unticked, /Published was not ticked then\. The tick is left as it is now\./);
});

inBrowser("a page that holds a refused save measures an offer against the post as it read it, and says so only when it knows", async () => {
  // Such a page carries the stamp of an older version than the post it was drawn on. A text
  // typed over the post as it is now was called older than the post, which it is not.
  const post = aPost({ updated_at: "2026-09-10T08:00:00.000Z" });
  const refusal = { error: "This post was saved again after this page was opened, so nothing was saved now. Saving from this page would write over that newer version.", fields: boxes(post, { body_md: "typed before the script loaded" }), opened: "2026-09-01T10:00:00.000Z", stale: true };
  const state = answered(refusal, drawn({ props: { post } }));
  const august = earlier(boxes(post, { slug: "typed-in-august", body_md: "typed over the August version" }), "2026-08-01T10:00:00.000Z", "2026-08-02T09:00:00.000Z");
  const today = earlier(boxes(post, { slug: "typed-this-morning", body_md: "typed over the post as it is now" }), post.updated_at, "2026-09-10T09:00:00.000Z");
  await desk({}, async (d) => {
    await d.stock({ [OFFERED(post.id)]: [august, today] });
    const page = await d.arrive(drawn({ props: { post }, formState: state }).html, { post });
    await d.wake(page, { post }, state);
    await offered(page, 2);
    const seen = (await look(page)).offers;
    assert.match(seen[0], /It was typed over an older version of this post\./);
    assert.doesNotMatch(seen[1], /version|saved again|address/, "the post has not been saved since this one was typed");
    await press(page, 1, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "typed over the post as it is now");
    assert.equal((await look(page)).slug, "typed-this-morning", "so its address comes back with it");
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "typed over the August version");
    assert.equal((await look(page)).slug, "typed-this-morning", "and the older one leaves the address as it is");
    assert.equal((await look(page)).sends.opened, "2026-09-01T10:00:00.000Z", "whatever is put back, the page still carries the stamp its boxes came with");
  });
  // a page that could not read the post knows only the stamp its boxes carry, and that is older than this text's
  const lost = { id: post.id, reason: "fetch failed" };
  await desk({}, async (d) => {
    await d.stock({ [OFFERED(post.id)]: [today] });
    const page = await d.arrive(drawn({ props: { lost }, formState: state }).html, { lost });
    await d.wake(page, { lost }, state);
    await offered(page);
    const said = (await look(page)).offers[0];
    assert.match(said, /The desk cannot tell whether this post has been saved again since this was typed over it\./);
    assert.doesNotMatch(said, /older version/);
  });
  // and when neither the page nor the text carries a stamp, two empty stamps are not a match
  const blind = answered({ error: "The desk could not tell which version of this post the page was opened on, so nothing was saved. Saving from this page could write over a newer version.", fields: boxes(post, { body_md: "typed before the script loaded" }), opened: "", stale: true }, drawn({ props: { post } }));
  await desk({}, async (d) => {
    await d.stock({ [OFFERED(post.id)]: [earlier(boxes(post, { slug: "typed-on-a-page-with-no-stamp", body_md: "typed on a page that carried no stamp" }), "")] });
    const page = await d.arrive(drawn({ props: { lost }, formState: blind }).html, { lost });
    await d.wake(page, { lost }, blind);
    await offered(page);
    assert.match((await look(page)).offers[0], /The desk cannot tell whether this post has been saved again since this was typed over it\./);
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "typed on a page that carried no stamp");
    assert.equal((await look(page)).slug, post.slug, "so the address is left as it is");
  });
});

// ---------------------------------------------------------------- 9. a refused save keeps everything

inBrowser("a refused save keeps every box and writes them down at once, even when another tab has emptied the place", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const page = await d.open({ post });
    const typed = boxes(post, { title: "A post, retitled", tags: "go, tabs", excerpt: "A line.", cover_url: "/covers/a.png", body_md: "First line.\n\nSecond line.\n\nA paragraph typed in this tab." });
    for (const [name, value] of Object.entries(typed)) if (name !== "published") await page.locator(`[name="${name}"]`).fill(value);
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md?.endsWith("typed in this tab."), UNSAVED(post.id));
    const typedAt = (await kept(page, UNSAVED(post.id))).at;
    // the other tab typed, saved, and took the shared place with it
    await page.evaluate((key) => localStorage.removeItem(key), UNSAVED(post.id));
    await page.waitForTimeout(40);
    d.state.save = async (fields) => ({ error: "Nothing was saved. For the test.", fields: typed, opened: carried(fields).opened ?? "" });
    await page.locator(SAVE).click();
    await refused(page);
    const after = await look(page);
    assert.deepEqual(boxes(null, Object.fromEntries(Object.keys(typed).filter((k) => k !== "published").map((k) => [k, after[k]]))), typed);
    assert.deepEqual(after.refusals, ["Nothing was saved. For the test."]);
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    assert.deepEqual((await kept(page, UNSAVED(post.id))).fields, typed, "a tab closed now loses nothing");
    assert.equal((await kept(page, UNSAVED(post.id))).at, typedAt, "and it still says when it was typed, not when the save was refused");

    // The press of save writes the boxes down too. So the same again with the place emptied
    // after the press, while the save is on its way: only the refusal can put them back then.
    const held = heldBack({ error: "Nothing was saved. For the test, again.", fields: typed, opened: post.updated_at });
    d.state.save = held.save;
    await page.locator(SAVE).click();
    await says(page, SAVE, "saving");
    await page.evaluate((key) => localStorage.removeItem(key), UNSAVED(post.id));
    held.letGo();
    await heard(page, d, 2);
    await page.waitForFunction((sel) => /For the test, again\./.test(document.querySelector(sel)?.textContent ?? ""), REFUSAL);
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    assert.deepEqual((await kept(page, UNSAVED(post.id))).fields, typed, "the refusal wrote them down again");
  });
});

inBrowser("a save refused because the post changed elsewhere says the text is kept, and offers it on top of the post as it is now", async () => {
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Two tabs", body_md: LONG }))).saved);
  const opened = site.site.posts()[0];
  await desk({}, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const page = await d.open({ post: opened });
    await page.locator(BODY).fill(`${LONG}\n\nA paragraph typed in the tab that was left open.`);
    // the other tab saves a better title
    assert.ok((await site.save(site.form({ title: "Two tabs, a better title" }, opened))).saved);
    await page.locator(SAVE).click();
    await refused(page);
    await page.waitForFunction((sel) => /kept in this browser/.test(document.querySelector(sel).textContent), REFUSAL);
    const told = (await look(page)).refusals[0];
    assert.match(told, /^This post was saved again after this page was opened, so nothing was saved now\./);
    assert.match(told, /What you typed is also kept in this browser\./);
    assert.equal(await page.locator(`${REFUSAL} a`).getAttribute("href"), `/admin/edit/${opened.id}`, "a plain link that loads the page again");
    assert.equal((await look(page)).asNew, null, "the post is there, so nothing offers to save it as a new one");
    assert.equal(site.site.posts()[0].body_md, LONG, "and nothing was written over the other tab's save");
    // the press of save found this tab's own boxes in the kept place, and they are not an offer to itself
    assert.deepEqual((await look(page)).offers, []);
    assert.equal(await kept(page, OFFERED(opened.id)), null);

    // the page loaded again, on the post as it is now
    const now = site.site.posts()[0];
    const again = await d.open({ post: now });
    await offered(again);
    assert.match((await look(again)).offers[0], /It was typed over an older version of this post\./);
    await press(again, 0, "put it back");
    await settle(again);
    await again.locator(TITLE).fill("Two tabs, a better title");
    await again.locator(SAVE).click();
    await movedOn(again);
    assert.equal(site.site.posts()[0].title, "Two tabs, a better title");
    assert.match(site.site.posts()[0].body_md, /A paragraph typed in the tab that was left open\.$/);
  });
});

inBrowser("the line under such a refusal claims only what is true: nothing typed, storage refused, script switched off", async () => {
  const post = aPost();
  const stale = (fields) => ({ error: "This post was saved again after this page was opened, so nothing was saved now. Saving from this page would write over that newer version.", fields: boxes(post), opened: carried(fields ?? []).opened ?? post.updated_at, stale: true });
  // nothing was typed, so nothing was kept and nothing is promised
  await desk({}, async (d) => {
    d.state.save = async (fields) => stale(fields);
    const page = await d.open({ post });
    await page.locator(SAVE).click();
    await refused(page);
    await settle(page);
    const told = (await look(page)).refusals[0];
    assert.doesNotMatch(told, /kept in this browser|[Cc]opy/);
    assert.equal(await page.locator(`${REFUSAL} a`).count(), 1);
    assert.equal(await kept(page, UNSAVED(post.id)), null);
  });
  // a browser that will not store anything is not said to have stored it
  await desk({ storage: false }, async (d) => {
    d.state.save = async (fields) => ({ ...stale(fields), fields: boxes(post, { body_md: "typed with storage off" }) });
    const page = await d.open({ post });
    await page.locator(BODY).fill("typed with storage off");
    await page.locator(SAVE).click();
    await refused(page);
    await page.waitForFunction((sel) => /[Cc]opy/.test(document.querySelector(sel).textContent), REFUSAL);
    const told = (await look(page)).refusals[0];
    assert.doesNotMatch(told, /also kept in this browser/);
    assert.match(told, /This browser would not keep what you typed\. Copy it before you load the page again/);
  });
  // with the script off the page cannot have kept anything, and says to copy it
  const first = drawn({ props: { post } });
  const back = drawn({ props: { post }, formState: answered({ ...stale(), fields: boxes(post, { body_md: "typed with the script off" }) }, first) });
  await desk({ script: false }, async (d) => {
    const page = await d.arrive(back.html, { post });
    const told = (await look(page)).refusals;
    assert.equal(told.length, 2, "at the top of the form and above the button");
    for (const one of told) {
      assert.match(one, /If you typed something here, copy it before you load the page again/);
      assert.doesNotMatch(one, /kept in this browser/);
    }
    assert.equal((await look(page)).body_md, "typed with the script off");
    assert.equal((await look(page)).sends.opened, post.updated_at, "and it still carries the stamp the boxes were typed over");
  });
});

inBrowser("a page that arrives holding a save refused as out of date says the text is kept only once the script has kept it", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const typed = boxes(post, { body_md: "typed before the script loaded, over an older version" });
    const first = drawn({ props: { post } });
    const state = answered({ error: "This post was saved again after this page was opened, so nothing was saved now. Saving from this page would write over that newer version.", fields: typed, opened: "2026-08-01T10:00:00.000Z", stale: true }, first);
    const html = drawn({ props: { post }, formState: state }).html;
    assert.doesNotMatch(html.replace(/<noscript>[\s\S]*?<\/noscript>/g, ""), /kept in this browser|copy it/i, "the server cannot know, so outside the part for a browser with no script it says neither");
    const page = await d.arrive(html, { post });
    await d.wake(page, { post }, state);
    await page.waitForFunction((sel) => [...document.querySelectorAll(sel)].every((el) => /What you typed is also kept in this browser/.test(el.textContent)), REFUSAL);
    const told = await look(page);
    assert.equal(told.refusals.length, 2);
    assert.deepEqual((await kept(page, UNSAVED(post.id))).fields, typed);
    assert.equal((await kept(page, UNSAVED(post.id))).over, "2026-08-01T10:00:00.000Z", "typed over the version the save carried, not the one read afterwards");
    assert.equal(told.sends.opened, "2026-08-01T10:00:00.000Z");
    assert.deepEqual(await page.evaluate(() => window.__mismatch ?? []), []);
  });
});

// ---------------------------------------------------------------- 10. a save that went through

inBrowser("a save that went through moves on to the desk and leaves nothing kept", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    d.state.save = async () => ({ saved: true, title: "A post", slug: "a-post", published: false });
    const page = await d.open({ post });
    await page.locator(BODY).fill("saved fine");
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.deepEqual((await look(page)).pushed, ["/admin"]);
    assert.equal(await kept(page, UNSAVED(post.id)), null);
    assert.equal(d.state.sent.length, 1);
    // on its way to the desk the page takes nothing more in, and a second press of save cannot be made
    const leaving = await look(page);
    assert.deepEqual(leaving.readOnly, ["title", "slug", "tags", "excerpt", "cover_url", "body_md"]);
    assert.equal(leaving.buttonHeld, true);
    await give(page, "drop", [PNG]);
    await settle(page);
    assert.deepEqual((await look(page)).notes, ["This page has saved and is moving on, so nothing new was taken in."]);
    assert.equal((await look(page)).body_md, "saved fine");
  });
});

inBrowser("words that reach a box after save was pressed are not in the save, so they stay kept and are offered next time", async () => {
  // the editor moves on all the same: a new post has no id yet, and a second save would be a second post
  await desk({}, async (d) => {
    const post = aPost();
    d.state.save = async () => SAVED;
    const page = await d.open({ post });
    await page.locator(BODY).fill("First line.\n\nSecond line.\n\nA third.");
    await page.evaluate((SAVE) => {
      const box = document.querySelector('[name="body_md"]');
      document.querySelector(SAVE).click();
      // in the instant after the press, before anything can hold the boxes
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, `${box.value} And one more sentence.`);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    }, SAVE);
    await movedOn(page);
    assert.equal(carried(d.state.sent[0]).body_md, "First line.\n\nSecond line.\n\nA third.");
    assert.equal((await kept(page, UNSAVED(post.id))).fields.body_md, "First line.\n\nSecond line.\n\nA third. And one more sentence.");

    const again = await d.open({ post: aPost({ body_md: "First line.\n\nSecond line.\n\nA third.", updated_at: "2026-09-01T10:05:00.000Z" }) });
    await offered(again);
    await press(again, 0, "put it back");
    await settle(again);
    assert.equal((await look(again)).body_md, "First line.\n\nSecond line.\n\nA third. And one more sentence.");
  });
});

// ---------------------------------------------------------------- 11. a page drawn by the server and then woken

inBrowser("what is typed in the one line boxes and ticked before the script loads is taken over, counted as typed, and sent", async () => {
  // the title and the tick looked right until the next letter typed anywhere, then snapped back
  await desk({}, async (d) => {
    const post = aPost({ published: true, published_at: "2026-09-01T10:00:00.000Z" });
    const page = await d.arrive(drawn({ props: { post } }).html, { post });
    await page.locator(TITLE).fill("A post, retitled early");
    await page.locator('[name="tags"]').fill("go, early");
    await page.locator(BODY).fill("First line.\n\nSecond line.\n\nTyped before the script arrived.");
    await page.locator(TICK).uncheck();
    await d.wake(page, { post });
    // one more letter somewhere else, which makes React draw the form again
    await page.locator('[name="excerpt"]').fill("x");
    await settle(page);
    const woken = await look(page);
    assert.equal(woken.title, "A post, retitled early");
    assert.equal(woken.tags, "go, early");
    assert.equal(woken.tick, false);
    assert.equal(woken.body_md, post.body_md, "the big text box is the one thing that cannot be taken over: React has already put the server's text back");
    assert.deepEqual((await kept(page, UNSAVED(post.id))).fields, boxes(post, { title: "A post, retitled early", tags: "go, early", excerpt: "x", published: false }));
    await page.locator(SAVE).click();
    await movedOn(page);
    const sent = carried(d.state.sent[0]);
    assert.equal(sent.title, "A post, retitled early");
    assert.equal(sent.published, undefined, "the writer unticked it, and that is what was sent");
  });
});

inBrowser("a page woken with nothing touched takes over nothing and keeps nothing", async () => {
  await desk({}, async (d) => {
    const post = aPost({ published: true, published_at: "2026-09-01T10:00:00.000Z" });
    const page = await d.arrive(drawn({ props: { post } }).html, { post });
    await d.wake(page, { post });
    await settle(page);
    assert.equal(await kept(page, UNSAVED(post.id)), null);
    assert.deepEqual(await page.evaluate(() => window.__mismatch ?? []), [], "what the server drew is what the script expected");
    const fresh = await d.open({ post });
    await settle(fresh);
    assert.equal(await kept(fresh, UNSAVED(post.id)), null);

    // a one line box cannot hold a line break, so a row that has one must not look typed in as it wakes
    const odd = aPost({ id: "33333333-3333-4333-8333-333333333333", title: "A post\nwith a line break in its title", excerpt: "A line.\r\nAnd another." });
    const woken = await d.arrive(drawn({ props: { post: odd } }).html, { post: odd });
    await d.wake(woken, { post: odd });
    await settle(woken);
    assert.equal(await kept(woken, UNSAVED(odd.id)), null);
    assert.equal((await look(woken)).title, "A postwith a line break in its title");
  });
});

inBrowser("a page that arrives holding a refused save's boxes counts them as typed from the start", async () => {
  // save was pressed before the script loaded, the site refused, and the text had no kept copy
  await desk({}, async (d) => {
    const post = aPost();
    const typed = boxes(post, { body_md: "First line.\n\nSecond line.\n\nA long paragraph typed today.", published: true });
    const first = drawn({ props: { post } });
    const state = answered({ error: "The database did not answer, so nothing was saved. Press save again in a moment. (fetch failed)", fields: typed, opened: post.updated_at }, first);
    const page = await d.arrive(drawn({ props: { post }, formState: state }).html, { post });
    await d.wake(page, { post }, state);
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    const mine = await kept(page, UNSAVED(post.id));
    assert.deepEqual(mine.fields, typed);
    assert.equal(mine.over, post.updated_at);
    const seen = await look(page);
    assert.equal(seen.body_md, typed.body_md);
    assert.equal(seen.tick, true);
    assert.deepEqual(await page.evaluate(() => window.__mismatch ?? []), []);
  });
});

// ---------------------------------------------------------------- 12. the cover box's rule is set from its value

inBrowser("the cover box is judged by what it holds, however that got there", async () => {
  // the rule was only asked when a key was pressed, so put it back left an empty box marked wrong and save did nothing
  await desk({}, async (d) => {
    const post = aPost();
    await d.stock({ [UNSAVED(post.id)]: earlier(boxes(post, { body_md: "kept text" }), post.updated_at) });
    const page = await d.open({ post });
    await offered(page);
    await page.locator('[name="cover_url"]').fill("cover.png");
    assert.match((await look(page)).coverSays, /starts with http or https/);
    await press(page, 0, "put it back");
    await settle(page);
    const back = await look(page);
    assert.equal(back.cover_url, "");
    assert.equal(back.coverSays, "");
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.equal(d.state.sent.length, 1);
  });
  await desk({}, async (d) => {
    const page = await d.open({ post: aPost({ cover_url: "covers/old.png" }) });
    await settle(page);
    assert.match((await look(page)).coverSays, /starts with http or https/, "a slip that is already stored is caught before the save is sent");
    for (const fine of ["/covers/a.png", "https://a.example/c.png", " /spaces-round.png ", ""]) {
      await page.locator('[name="cover_url"]').fill(fine);
      assert.equal((await look(page)).coverSays, "", JSON.stringify(fine));
    }
    for (const slip of ["cover.png", "//other.site/x.png", "ftp://a/b.png", "/has space.png"]) {
      await page.locator('[name="cover_url"]').fill(slip);
      assert.notEqual((await look(page)).coverSays, "", JSON.stringify(slip));
    }
  });
});

// ---------------------------------------------------------------- when the browser will not store

inBrowser("when the browser will not store what is in the boxes, put it back does not put the old text over it", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const old = earlier(boxes(post, { body_md: "old text" }), post.updated_at);
    await d.stock({ [UNSAVED(post.id)]: old });
    const page = await d.open({ post });
    await offered(page);
    await page.locator(BODY).fill("A paragraph typed just now.");
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    // the browser's storage fills up
    await page.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException("The quota has been exceeded.", "QuotaExceededError"); }; });
    await press(page, 0, "put it back");
    await page.waitForFunction((sel) => /would not keep what is in the boxes now/.test(document.querySelector(sel)?.textContent ?? ""), OFFER);
    assert.equal((await look(page)).body_md, "A paragraph typed just now.", "what was typed is still in the box");
    assert.deepEqual(await kept(page, OFFERED(post.id)), [old], "and the offer is still on its list");
    const told = (await look(page)).offers[0];
    assert.match(told, /so nothing was put back over it\. Save what is in the boxes, or copy it somewhere, then load the page again and put this back before typing anything\./);
    // pressed again while the browser is still full it is refused again, so the sentence does not say to
    assert.doesNotMatch(told, /press again/);
    await press(page, 0, "put it back");
    await settle(page);
    assert.equal((await look(page)).body_md, "A paragraph typed just now.");
    // with room again, the same press swaps them
    await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "old text");
    assert.deepEqual((await kept(page, OFFERED(post.id))).map((o) => o.fields.body_md), ["A paragraph typed just now."]);
    assert.doesNotMatch((await look(page)).offers[0], /would not keep/);
  });
});

inBrowser("when the browser refuses to store on arrival, an older kept text is left where it is and nothing is written over it", async () => {
  // moved out of its first place before its new place was written, it would have been in neither
  await desk({ storage: "full" }, async (d) => {
    const post = aPost();
    const old = earlier(boxes(post, { body_md: "typed last week, and never saved" }), post.updated_at);
    await d.stock({ [UNSAVED(post.id)]: old });
    const page = await d.open({ post });
    await offered(page, 1);
    await page.locator(BODY).fill("typed today");
    await settle(page);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), old);
    assert.equal(await kept(page, OFFERED(post.id)), null);
    assert.equal((await look(page)).body_md, "typed today");
  });
  // Put back with nothing typed, in a browser that takes no write at all: the boxes take it, and
  // it stays in its first place as well, because the boxes cannot be written there.
  await desk({ storage: "full" }, async (d) => {
    const post = aPost();
    const old = earlier(boxes(post, { body_md: "typed last week, and never saved" }), post.updated_at);
    await d.stock({ [UNSAVED(post.id)]: old });
    const page = await d.open({ post });
    await offered(page, 1);
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "typed last week, and never saved");
    await page.locator(BODY).fill("typed last week, and never saved, with a line more today");
    await settle(page);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), old, "nothing was taken out of the browser that could not be put back in");
  });
});

inBrowser("when the browser has no room for a longer list of offers, typing does not go over the text that could not be moved", async () => {
  // the place for this sitting's typing still takes a write, and the older text is sitting in it
  await desk({}, async (d) => {
    const post = aPost();
    const old = earlier(boxes(post, { body_md: "typed last week, and never saved" }), post.updated_at);
    await d.stock({ [UNSAVED(post.id)]: old });
    await d.context.addInitScript(() => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith("desk:offered:")) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        return write.call(this, key, value);
      };
    });
    const page = await d.open({ post });
    // It could not be moved. The page used to show nothing and say nothing, and it is now offered from where it is.
    await offered(page, 1);
    const said = (await look(page)).offers[0];
    assert.match(said, /^Something was typed here on 20 September at 09:00, and this browser did not see it saved\./);
    assert.match(said, /This browser would not move it out of the place where what is typed on this page is kept, so nothing typed here now is kept\. Put it back or throw it away before typing anything\./);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), old, "looking at it moved nothing");
    assert.equal(await kept(page, OFFERED(post.id)), null);
    await page.locator(BODY).fill("typed today");
    await settle(page);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), old, "and today's typing was not written over it");
    assert.equal((await look(page)).body_md, "typed today");
    // typed first, it cannot be put back: the browser has nowhere to keep what is in the boxes now
    await press(page, 0, "put it back");
    await page.waitForFunction((sel) => /would not keep what is in the boxes now/.test(document.querySelector(sel)?.textContent ?? ""), OFFER);
    assert.equal((await look(page)).body_md, "typed today");
    assert.deepEqual(await kept(page, UNSAVED(post.id)), old);
  });
});

/** a browser with room for the one kept place and none for a longer list of offers, until roomAgain() is called on a page */
const noRoomForTheList = (d) => d.context.addInitScript(() => {
  const write = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (!window.__roomAgain && String(key).startsWith("desk:offered:")) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    return write.call(this, key, value);
  };
});
const roomAgain = (page) => page.evaluate(() => { window.__roomAgain = true; });

inBrowser("a kept text the browser had no room to move is offered from its first place, and answering it frees that place", async () => {
  // "Load the page again and it is offered back" was followed by a page that offered nothing, said nothing, and kept nothing typed after it
  const post = aPost();
  const old = earlier(boxes(post, { body_md: "typed last week, and never saved" }), post.updated_at);
  // put back before anything is typed: the boxes take it, and typing is kept again
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED(post.id)]: old });
    await noRoomForTheList(d);
    const page = await d.open({ post });
    await offered(page, 1);
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "typed last week, and never saved");
    await offered(page, 0);
    await page.locator(BODY).fill("typed last week, and never saved, with a line more today");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md?.endsWith("a line more today"), UNSAVED(post.id));
    assert.equal(await kept(page, OFFERED(post.id)), null);
  });
  // thrown away: it leaves its first place, and typing is kept again
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED(post.id)]: old });
    await noRoomForTheList(d);
    const page = await d.open({ post });
    await offered(page, 1);
    await press(page, 0, "throw it away");
    await offered(page, 0);
    assert.equal(await kept(page, UNSAVED(post.id)), null, "thrown away from the place it never left");
    await page.locator(BODY).fill("typed today");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md === "typed today", UNSAVED(post.id));
  });
  // Thrown away after something was typed, which the page said was not being kept. With the
  // place free, what is in the boxes is written there at once, and not only at the next letter.
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED(post.id)]: old });
    await noRoomForTheList(d);
    const page = await d.open({ post });
    await offered(page, 1);
    await page.locator(BODY).fill("typed today, before the old text was answered");
    await settle(page);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), old);
    await press(page, 0, "throw it away");
    await offered(page, 0);
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md === "typed today, before the old text was answered", UNSAVED(post.id));
  });
  // The browser has room again later in the sitting. The page has said that nothing typed is
  // kept until the old text is answered, and that stays true: nothing is moved or written behind
  // the writer's back. Answered then, the swap goes through, and both texts are in the browser.
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED(post.id)]: old });
    await noRoomForTheList(d);
    const page = await d.open({ post });
    await offered(page, 1);
    await roomAgain(page);
    await page.locator(BODY).fill("typed today, with room in the browser again");
    await settle(page);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), old, "still where it was, with nothing written over it");
    assert.equal(await kept(page, OFFERED(post.id)), null, "and not moved while its offer says it could not be");
    assert.match((await look(page)).offers[0], /nothing typed here now is kept/);
    await press(page, 0, "put it back");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.by !== undefined, UNSAVED(post.id));
    assert.equal((await kept(page, UNSAVED(post.id))).fields.body_md, "typed last week, and never saved");
    assert.deepEqual((await kept(page, OFFERED(post.id))).map((o) => o.fields.body_md), ["typed today, with room in the browser again"]);
  });
  // With one more text on the list. That one is thrown away, the list is shown again, and the
  // text that could not be moved is still on the page after it, with its line.
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED(post.id)]: old, [OFFERED(post.id)]: [earlier(boxes(post, { body_md: "an older one still, on the list" }), post.updated_at, "2026-09-10T09:00:00.000Z")] });
    await noRoomForTheList(d);
    const page = await d.open({ post });
    await offered(page, 2);
    await press(page, 0, "throw it away");
    await offered(page, 1);
    assert.match((await look(page)).offers[0], /20 September at 09:00.*would not move it out of the place/);
    assert.equal(await kept(page, OFFERED(post.id)), null);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), old);
  });
  // It was typed over an older version of the post, so put it back leaves the address as it is
  // now. The boxes then differ from it by that address, and they still take over its place.
  await desk({}, async (d) => {
    const moved = earlier(boxes(post, { slug: "where-it-used-to-live", body_md: "typed last week, and never saved" }), "2026-08-01T10:00:00.000Z");
    await d.stock({ [UNSAVED(post.id)]: moved });
    await noRoomForTheList(d);
    const page = await d.open({ post });
    await offered(page, 1);
    assert.match((await look(page)).offers[0], /It was typed over an older version of this post\./);
    await press(page, 0, "put it back");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.slug === "a-post", UNSAVED(post.id));
    assert.deepEqual((await kept(page, UNSAVED(post.id))).fields, boxes(post, { body_md: "typed last week, and never saved" }), "the place holds the boxes now, with the address the post has");
    assert.equal(await kept(page, OFFERED(post.id)), null);
    assert.deepEqual((await look(page)).offers, []);
  });
});

inBrowser("a text the browser would not move at one write is moved at a later one, once the browser takes it", async () => {
  // Another tab's text is in the place and the browser will not take it into the offers. Nothing
  // is written over it. When the browser has room again the next letter moves it, shows it,
  // and is kept. It used to be the end of keeping for as long as the page was open.
  const post = aPost();
  await desk({}, async (d) => {
    await noRoomForTheList(d);
    const theirs = earlier(boxes(post, { body_md: "typed in the other tab" }), post.updated_at);
    const page = await d.open({ post });
    await page.locator(TITLE).fill("A post, retitled in this tab");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.title?.endsWith("in this tab"), UNSAVED(post.id));
    await keep(page, UNSAVED(post.id), theirs);
    await page.locator(TITLE).fill("A post, retitled in this tab.");
    await settle(page);
    assert.deepEqual(await kept(page, UNSAVED(post.id)), theirs, "it could not be moved, so nothing was written over it");
    await roomAgain(page);
    await page.locator(TITLE).fill("A post, retitled in this tab. And again.");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.title?.endsWith("And again."), UNSAVED(post.id));
    assert.deepEqual(await kept(page, OFFERED(post.id)), [theirs], "moved now that the browser takes it");
    await offered(page, 1);
  });
});

inBrowser("a refusal on arrival that leaves nothing unmoved does not stop typing being kept", async () => {
  // On arrival the list was to be written shorter, because one text on it says what the post
  // says, and the browser refused. Nothing was left in the first place, so nothing is in the
  // way of this sitting's typing. It was not kept at all, and nothing said so.
  const post = aPost();
  await desk({}, async (d) => {
    const other = earlier(boxes(post, { body_md: "something the post does not say" }), post.updated_at, "2026-09-27T18:30:00.000Z");
    await d.stock({ [OFFERED(post.id)]: [earlier(boxes(post, { published: true }), "2026-08-01T10:00:00.000Z"), other] });
    await noRoomForTheList(d);
    const page = await d.open({ post });
    await offered(page, 1);
    assert.doesNotMatch((await look(page)).offers[0], /would not move it/, "nothing is unmoved, so nothing says so");
    await page.locator(BODY).fill("typed today");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md === "typed today", UNSAVED(post.id));
  });
});

inBrowser("in a browser with no room for a longer list, a save refused as out of date is offered back when the page is loaded again, as its line says", async () => {
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Notes on the cache", body_md: LONG }))).saved);
  const opened = site.site.posts()[0];
  const typed = `${LONG}\n\nTwo hours of new text.`;
  await desk({}, async (d) => {
    await noRoomForTheList(d);
    d.state.save = (fields) => site.save(fields);
    const page = await d.open({ post: opened });
    await page.locator(BODY).fill(typed);
    // saved again somewhere else
    assert.ok((await site.save(site.form({ excerpt: "A line added from another tab." }, opened))).saved);
    await page.locator(SAVE).click();
    await refused(page);
    await page.waitForFunction((sel) => /kept in this browser/.test(document.querySelector(sel).textContent), REFUSAL);
    assert.match((await look(page)).refusals[0], /What you typed is also kept in this browser\. Load the page again and it is offered back, to put on top of the post as it is now/);
    await page.close();

    // the page loaded again, on the post as it is now
    const again = await d.open({ post: site.site.posts()[0] });
    await offered(again, 1);
    assert.match((await look(again)).offers[0], /It was typed over an older version of this post\./);
    await press(again, 0, "put it back");
    await again.waitForFunction(() => document.querySelector('[name="body_md"]').value.endsWith("Two hours of new text."));
    // what was put back was typed over the older version, as the offer says, so the line the other tab added is typed in again
    await again.locator('[name="excerpt"]').fill("A line added from another tab.");
    await again.locator(SAVE).click();
    await movedOn(again);
    assert.equal(site.site.posts()[0].body_md, typed);
    assert.equal(site.site.posts()[0].excerpt, "A line added from another tab.");
    assert.equal(await kept(again, UNSAVED(opened.id)), null, "and nothing is left lying in the browser");
  });
});

inBrowser("when the browser is full on arrival, the offers already on the list are still shown, and one can be put back before typing", async () => {
  // a browser that could be read and not written showed no offer at all, so the way out the page gives did not work
  await desk({ storage: "full" }, async (d) => {
    const post = aPost();
    const unmoved = earlier(boxes(post, { body_md: "typed yesterday, and still in its first place" }), post.updated_at, "2026-09-28T09:00:00.000Z");
    const listed = [earlier(boxes(post, { body_md: "the first listed text" }), post.updated_at), earlier(boxes(post, { body_md: "the second listed text" }), post.updated_at, "2026-09-27T18:30:00.000Z")];
    await d.stock({ [UNSAVED(post.id)]: unmoved, [OFFERED(post.id)]: listed });
    const page = await d.open({ post });
    // the two on the list, and after them the one that could not be moved, offered from where it is
    await offered(page, 3);
    assert.deepEqual((await look(page)).offers.map((said) => /20 September|27 September|28 September/.exec(said)?.[0]), ["20 September", "27 September", "28 September"]);
    assert.deepEqual((await look(page)).offers.map((said) => /would not move it out of the place/.test(said)), [false, false, true]);
    // typed first, the swap is refused, and the page says what to do
    await page.locator(BODY).fill("typed today");
    await press(page, 0, "put it back");
    await page.waitForFunction((sel) => /would not keep what is in the boxes now/.test(document.querySelector(sel)?.textContent ?? ""), OFFER);
    assert.equal((await look(page)).body_md, "typed today");

    // doing what it says: the page loaded again, and the offer put back before anything is typed
    const again = await d.open({ post });
    await offered(again, 3);
    await press(again, 0, "put it back");
    await again.waitForFunction(() => document.querySelector('[name="body_md"]').value === "the first listed text");
    await offered(again, 2);
    assert.match((await look(again)).offers[1], /28 September at 09:00.*would not move it out of the place/, "the one that could not be moved is still on the page");
    assert.deepEqual(await kept(again, UNSAVED(post.id)), unmoved, "the text that could not be moved is where it was, with nothing written over it");
    assert.deepEqual(await kept(again, OFFERED(post.id)), listed, "and the list is as it was, because the browser would not take the shorter one");
  });
});

inBrowser("in a browser at its limit, a text that was put back stays on the list of offers until the boxes that took it are written down", async () => {
  // "put it back" took the text off the list first. The browser then refused the boxes, and with the tab closed the text was nowhere.
  await desk({ storage: "at its limit" }, async (d) => {
    const post = aPost();
    // typed over an older version, so the address is not taken from it and the boxes come out longer than the entry on the list was
    const old = earlier(boxes(post, { slug: "a", body_md: "a paragraph from last week that was never saved" }), "2026-08-01T10:00:00.000Z");
    await d.stock({ [OFFERED(post.id)]: [old] });
    const page = await d.open({ post });
    await offered(page);
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "a paragraph from last week that was never saved");
    await offered(page, 0);
    await settle(page);
    assert.equal(await kept(page, UNSAVED(post.id)), null, "the browser would not take the boxes, which is the state this test is about");
    assert.deepEqual(await kept(page, OFFERED(post.id)), [old], "so the text is still on the list");
    await page.close();

    const again = await d.open({ post });
    await offered(again);
    await press(again, 0, "put it back");
    await again.waitForFunction(() => document.querySelector('[name="body_md"]').value === "a paragraph from last week that was never saved");
  });
});

inBrowser("in a browser at its limit, with one text on the list and one that could not be moved, putting the listed one back loses neither", async () => {
  await desk({ storage: "at its limit" }, async (d) => {
    const post = aPost();
    const listed = earlier(boxes(post, { body_md: "the older text, on the list" }), post.updated_at, "2026-09-20T09:00:00.000Z");
    const last = earlier(boxes(post, { body_md: "the last text, still in its first place, and longer than the browser has room to move" }), post.updated_at, "2026-09-28T09:00:00.000Z");
    await d.stock({ [OFFERED(post.id)]: [listed], [UNSAVED(post.id)]: last });
    const page = await d.open({ post });
    await offered(page, 2);
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "the older text, on the list");
    await settle(page);
    // nothing is written while the other text is unanswered, so the one the boxes took has to stay where it was
    assert.deepEqual(await kept(page, UNSAVED(post.id)), last);
    assert.deepEqual(await kept(page, OFFERED(post.id)), [listed], "the text the boxes took is still kept");
    await page.close();

    const again = await d.open({ post });
    await offered(again, 2);
    assert.deepEqual((await look(again)).offers.map((said) => /20 September|28 September/.exec(said)?.[0]), ["20 September", "28 September"]);
  });
});

inBrowser("with room in the browser, a text that was put back leaves the list once the boxes are written down", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const old = earlier(boxes(post, { body_md: "a paragraph from last week that was never saved" }), post.updated_at);
    const other = earlier(boxes(post, { body_md: "another text nobody has answered" }), post.updated_at, "2026-09-21T09:00:00.000Z");
    await d.stock({ [OFFERED(post.id)]: [old, other] });
    const page = await d.open({ post });
    await offered(page, 2);
    await press(page, 0, "put it back");
    await page.waitForFunction((key) => { try { return JSON.parse(localStorage.getItem(key)).fields.body_md === "a paragraph from last week that was never saved"; } catch { return false; } }, UNSAVED(post.id));
    await offered(page, 1);
    assert.deepEqual(await kept(page, OFFERED(post.id)), [other], "it is in the boxes' own place now, and once only");
    // the second one put back over it: the first is typed text of this sitting, so it goes on offer and is not lost
    await press(page, 0, "put it back");
    await page.waitForFunction((key) => { try { return JSON.parse(localStorage.getItem(key)).fields.body_md === "another text nobody has answered"; } catch { return false; } }, UNSAVED(post.id));
    await offered(page, 1);
    assert.deepEqual((await kept(page, OFFERED(post.id))).map((o) => o.fields.body_md), ["a paragraph from last week that was never saved"]);
  });
});

inBrowser("a kept text whose time cannot be read is said to have been typed earlier, on the editor and on the page of a post that is gone", async () => {
  // a text kept by an older build of the desk, or one whose time was damaged, must not be shown with a date nobody can read
  await desk({}, async (d) => {
    const post = aPost();
    const undated = { over: post.updated_at, fields: boxes(post, { body_md: "typed at a time the browser did not write down" }) };
    await d.stock({ [OFFERED(post.id)]: [undated] });
    const page = await d.open({ post });
    await offered(page);
    const said = (await look(page)).offers[0];
    assert.match(said, /^Something was typed here earlier, and this browser did not see it saved\./);
    assert.doesNotMatch(said, /Invalid Date/);
    await page.close();

    const gone = await d.open({ lost: { id: post.id } });
    await gone.waitForFunction(() => document.querySelectorAll('#root [role="status"]').length === 1);
    const told = (await gone.locator('#root [role="status"]').first().textContent()).replace(/\s+/g, " ").trim();
    assert.match(told, /^Something was typed for it here earlier, and this browser did not see it saved\./);
    assert.doesNotMatch(told, /Invalid Date/);
  });
});

inBrowser("something in the browser's storage that the desk did not write is treated as nothing there", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    await d.stock({ [UNSAVED(post.id)]: "{ not what the desk writes", [OFFERED(post.id)]: '{"at":"2026-09-20T09:00:00.000Z"}' });
    const page = await d.open({ post });
    await settle(page);
    assert.deepEqual((await look(page)).offers, []);
    await page.locator(BODY).fill("typed today");
    await page.waitForFunction((key) => { try { return JSON.parse(localStorage.getItem(key)).fields.body_md === "typed today"; } catch { return false; } }, UNSAVED(post.id));
    d.state.save = async () => SAVED;
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.equal(await kept(page, UNSAVED(post.id)), null);
  });
  // a list with things on it that are not kept texts
  await desk({}, async (d) => {
    const post = aPost();
    const real = earlier(boxes(post, { body_md: "a real one among them" }), post.updated_at);
    await d.stock({ [OFFERED(post.id)]: [null, 5, "words", { at: "2026-09-20T09:00:00.000Z", fields: "not boxes" }, real] });
    const page = await d.open({ post });
    await offered(page, 1);
    await page.locator(BODY).fill("typed today");
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md === "typed today", UNSAVED(post.id));
    await press(page, 0, "put it back");
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value === "a real one among them");
  });
});

// ---------------------------------------------------------------- 13. images

inBrowser("the note stays up while any image is still uploading", async () => {
  await desk({}, async (d) => {
    const lands = [];
    let n = 0;
    d.state.upload = async (route) => { const mine = ++n; await new Promise((done) => lands.push(done)); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `https://blob.test/${mine}.png` }) }); };
    const page = await d.open({ post: aPost() });
    await give(page, "drop", [{ name: "first.png", type: "image/png" }]);
    await give(page, "drop", [{ name: "second.png", type: "image/png" }]);
    while (lands.length < 2) await new Promise((r) => setTimeout(r, 10));
    assert.equal((await look(page)).uploading, "uploading 2 images");
    assert.equal((await look(page)).button, "waiting for the images");
    lands[0]();
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.includes("1.png"));
    await settle(page);
    const between = await look(page);
    assert.equal(between.uploading, "uploading the image", "the first has landed and the second is still on its way");
    assert.equal(between.button, "waiting for the image");
    assert.equal(between.buttonHeld, true);
    lands[1]();
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.includes("2.png"));
    await says(page, SAVE, "save");
    assert.equal((await look(page)).uploading, null);
  });
});

inBrowser("an image dropped on a text box that never had the caret goes at the end, and one dropped at the caret goes there", async () => {
  // the caret of an untouched box is at 0, so the image landed above the first line
  await desk({}, async (d) => {
    const post = aPost({ body_md: "AAAA\n\nBBBB\n\nCCCC" });
    const page = await d.open({ post });
    await give(page, "drop", [{ name: "shot.png", type: "image/png" }]);
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.includes("]("));
    assert.equal((await look(page)).body_md, "AAAA\n\nBBBB\n\nCCCC\n\n![shot](https://blob.test/img.png)\n\n");
    // an image that lands counts as typed, though no key was pressed, so a tab closed now does not take it along
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    assert.match((await kept(page, UNSAVED(post.id))).fields.body_md, /!\[shot\]\(https:\/\/blob\.test\/img\.png\)\n\n$/);

    const second = await d.open({ post });
    await second.locator(BODY).focus();
    await second.evaluate(() => document.querySelector('[name="body_md"]').setSelectionRange(10, 10));
    await give(second, "drop", [{ name: "shot.png", type: "image/png" }]);
    await second.waitForFunction(() => document.querySelector('[name="body_md"]').value.includes("]("));
    assert.equal((await look(second)).body_md, "AAAA\n\nBBBB\n\n![shot](https://blob.test/img.png)\n\n\n\nCCCC");
    await second.keyboard.type("XY");
    assert.match((await look(second)).body_md, /img\.png\)\n\nXY\n\nCCCC$/, "and typing carries on just after it");
  });
});

inBrowser("a file that is not an image is left out with a line that says so, and the images beside it still go in", async () => {
  await desk({}, async (d) => {
    let uploads = 0;
    d.state.upload = async (route) => { uploads++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://blob.test/img.png" }) }); };
    const post = aPost();
    const page = await d.open({ post });
    await give(page, "drop", [{ name: "paper.pdf", type: "application/pdf" }]);
    await page.waitForFunction(() => document.querySelectorAll('form span[role="alert"]').length === 1);
    assert.match((await look(page)).notes[0], /^paper\.pdf was left out\./);
    assert.equal(uploads, 0);
    assert.equal((await look(page)).body_md, post.body_md);
    // a photo the system gives no type, a pdf and a real image in one drop
    await give(page, "drop", [{ name: "IMG_0001.HEIC", type: "" }, { name: "paper.pdf", type: "application/pdf" }, PNG]);
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.includes("]("));
    await settle(page);
    const after = await look(page);
    assert.equal(after.notes.length, 2, JSON.stringify(after.notes));
    assert.match(after.notes[0], /^IMG_0001\.HEIC was left out\./);
    assert.match(after.notes[1], /^paper\.pdf was left out\./);
    assert.equal(uploads, 1);
    assert.equal(after.uploading, null);
  });
});

inBrowser("an image that is too big, refused by the site or lost on the way gets a line, and the save button is let go", async () => {
  // the count of uploads under way has to come back down however an upload ends, or save waits for ever
  const free = async (page) => { await says(page, SAVE, "save"); const seen = await look(page); assert.equal(seen.buttonHeld, false); assert.equal(seen.uploading, null); return seen; };
  await desk({ complains: true }, async (d) => {
    const post = aPost();
    let asked = 0;
    d.state.upload = async (route) => { asked++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://blob.test/img.png" }) }); };
    const page = await d.open({ post });
    // over 4MB is stopped in the browser, and the image beside it still goes in
    await give(page, "drop", [{ name: "huge.png", type: "image/png", size: 4 * 1024 * 1024 + 1 }, PNG]);
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.includes("]("));
    assert.deepEqual((await free(page)).notes, ["huge.png is over 4MB, which is more than the site takes. Make it smaller and drop it in again."]);
    assert.equal(asked, 1, "the big one was not sent");

    // the site answers 500 to the first of two, and the second is not tried
    asked = 0;
    d.state.upload = async (route) => { asked++; return route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" }); };
    await give(page, "drop", [{ name: "first.png", type: "image/png" }, { name: "second.png", type: "image/png" }]);
    await page.waitForFunction(() => document.querySelectorAll('form span[role="alert"]').length === 1 && /did not upload/.test(document.querySelector('form span[role="alert"]').textContent));
    assert.deepEqual((await free(page)).notes, ["That did not upload. The site answered 500."]);
    assert.equal(asked, 1);

    // the site says why in its own words
    d.state.upload = async (route) => route.fulfill({ status: 413, contentType: "application/json", body: JSON.stringify({ error: "That image is over 4MB. Make it smaller and drop it in again." }) });
    await give(page, "paste", [PNG]);
    await page.waitForFunction(() => /over 4MB\. Make/.test(document.querySelector('form span[role="alert"]')?.textContent ?? ""));
    assert.deepEqual((await free(page)).notes, ["That image is over 4MB. Make it smaller and drop it in again."]);

    // the connection drops
    d.state.upload = async (route) => route.abort("connectionreset");
    await give(page, "drop", [PNG]);
    await page.waitForFunction(() => /connection dropped/.test(document.querySelector('form span[role="alert"]')?.textContent ?? ""));
    assert.deepEqual((await free(page)).notes, ["That did not upload. The connection dropped."]);
    assert.equal((await look(page)).body_md.match(/\]\(/g).length, 1, "and only the one that arrived is in the text");
  });
});

inBrowser("two files with one name, both left out of one drop, each get a line", async () => {
  // the lines were told apart by their words, and React complains about two it cannot tell apart
  await desk({ mode: "development" }, async (d) => {
    const page = await d.open({ post: aPost() });
    await give(page, "drop", [{ name: "paper.pdf", type: "application/pdf" }, { name: "paper.pdf", type: "application/pdf" }]);
    await page.waitForFunction(() => document.querySelectorAll('form span[role="alert"]').length === 2);
    assert.deepEqual((await look(page)).notes, Array(2).fill("paper.pdf was left out. The browser does not call it an image, and only images go in."));
  });
});

// ---------------------------------------------------------------- 14. the answer is where the writer is looking

inBrowser("a page that arrives already holding an answer shows it at the top of the form as well as above the button", async () => {
  // with the script off the page came back at the top, and the line that said what happened was below the screen
  const post = aPost();
  const first = drawn({ props: { post } });
  const where = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => ({ top: Math.round(el.getBoundingClientRect().top), beforeTitle: Boolean(el.compareDocumentPosition(document.querySelector('[name="title"]')) & Node.DOCUMENT_POSITION_FOLLOWING) })), sel);
  await desk({ script: false, viewport: { width: 1000, height: 400 } }, async (d) => {
    const refusedPage = await d.arrive(drawn({ props: { post }, formState: answered({ error: "Nothing was saved. Another post already has the address /blog/a-post, so type a different one in the address box.", fields: boxes(post, { body_md: "typed with the script off" }), opened: post.updated_at }, first) }).html, { post });
    const at = await where(refusedPage, REFUSAL);
    assert.equal(at.length, 2);
    assert.equal(at[0].beforeTitle, true);
    assert.ok(at[0].top >= 0 && at[0].top < 400, `the sentence is on the screen as the page arrives, at ${at[0].top}`);
    assert.equal(at[1].beforeTitle, false);
    assert.deepEqual((await look(refusedPage)).refusals, Array(2).fill("Nothing was saved. Another post already has the address /blog/a-post, so type a different one in the address box."));
    assert.equal((await look(refusedPage)).asNew, null, "and the server draws no second button for a refusal that is not about a deleted post");

    const savedPage = await d.arrive(drawn({ props: { post }, formState: answered({ saved: true, title: "A post", slug: "a-post", published: true }, first) }).html, { post });
    const told = (await look(savedPage)).saved;
    assert.deepEqual(told, Array(2).fill('Saved. "A post" is live at /blog/a-post. Back to the desk.'));
    // with the script off these two links are the only ways on from a save that worked
    const leadsTo = (page) => page.locator('form > p[role="status"] a').evaluateAll((all) => all.map((a) => a.getAttribute("href")));
    assert.deepEqual(await leadsTo(savedPage), ["/blog/a-post", "/admin", "/blog/a-post", "/admin"]);
    assert.equal((await where(savedPage, 'form > p[role="status"]'))[0].beforeTitle, true);
    const draft = await d.arrive(drawn({ props: {}, formState: answered({ saved: true, title: "Written on the train", slug: "written-on-the-train", published: false }, drawn({ props: {} })) }).html, {});
    assert.equal((await look(draft)).saved[0], 'Saved. "Written on the train" is a draft, so only the desk shows it. Its address is /blog/written-on-the-train. Back to the desk.');
    // a draft answers 404 at its address, so the address is said and not linked
    assert.deepEqual([...new Set(await leadsTo(draft))], ["/admin"]);
    assert.equal((await look(draft)).title, "", "the boxes of a new post are empty again, and the line says which post it was");
  });
});

inBrowser("with the script running, an answer that arrives below the screen is brought into view", async () => {
  // Enter in the title box sends a save, and the refusal sat below the screen
  await desk({ viewport: { width: 1000, height: 300 } }, async (d) => {
    const post = aPost();
    d.state.save = async (fields) => ({ error: "The database did not answer, so nothing was saved. Press save again in a moment. (fetch failed)", fields: boxes(post), opened: carried(fields).opened ?? "" });
    const page = await d.open({ post });
    await page.locator(TITLE).press("Enter");
    await refused(page);
    await settle(page);
    const box = await page.locator(REFUSAL).last().boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= 300, `the sentence is on the screen, from ${Math.round(box.y)} to ${Math.round(box.y + box.height)}`);
    assert.equal((await look(page)).refusals.length, 1, "a page that did not arrive with an answer shows it once, above the button");
  });
});

inBrowser("a saved answer names the post and says whether it is live, and the top copy gives way to a newer answer", async () => {
  await desk({}, async (d) => {
    const post = aPost();
    const first = drawn({ props: { post } });
    const state = answered({ error: "Nothing was saved. For the test.", fields: boxes(post, { body_md: "typed before the script" }), opened: post.updated_at }, first);
    const page = await d.arrive(drawn({ props: { post }, formState: state }).html, { post });
    await d.wake(page, { post }, state);
    assert.equal((await look(page)).refusals.length, 2);
    d.state.save = async () => ({ saved: true, title: "A post", slug: "a-post", published: false });
    await page.locator(SAVE).click();
    await movedOn(page);
    const after = await look(page);
    assert.deepEqual(after.refusals, [], "the old refusal is not left standing at the top");
    assert.deepEqual(after.saved, ['Saved. "A post" is a draft, so only the desk shows it. Its address is /blog/a-post. Back to the desk.']);
  });
});

// ---------------------------------------------------------------- 15. two tabs on one post

inBrowser("two tabs on one post: the second to save is refused, its text is written down at once, and it goes in on top afterwards", async () => {
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Two tabs", body_md: LONG }))).saved);
  const opened = site.site.posts()[0];
  await desk({}, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const a = await d.open({ post: opened });
    const b = await d.open({ post: opened });
    await a.locator(BODY).fill(`${LONG}\n\nTyped in tab A.`);
    await b.locator('[name="tags"]').fill("go");
    await b.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.tags === "go", UNSAVED(opened.id));
    // B typed last, so the one shared place holds B's boxes, and B's save empties it
    await b.locator(SAVE).click();
    await movedOn(b);
    assert.equal(await kept(a, UNSAVED(opened.id)), null);
    await a.locator(SAVE).click();
    await refused(a);
    await a.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(opened.id));
    assert.match((await kept(a, UNSAVED(opened.id))).fields.body_md, /Typed in tab A\.$/);
    assert.deepEqual(site.site.posts()[0].tags, ["go"]);
    assert.equal(site.site.posts()[0].body_md, LONG, "B's save stands");

    const again = await d.open({ post: site.site.posts()[0] });
    await offered(again);
    await press(again, 0, "put it back");
    await settle(again);
    await again.locator('[name="tags"]').fill("go");
    await again.locator(SAVE).click();
    await movedOn(again);
    assert.match(site.site.posts()[0].body_md, /Typed in tab A\.$/);
    assert.deepEqual(site.site.posts()[0].tags, ["go"]);
  });
});

inBrowser("two tabs on one post: a save that gets no answer has written its text down at the press, so it is offered back", async () => {
  // The other tab typed last and then saved, which emptied the one shared place. This tab's
  // save got no answer, the editor went off the screen, and its paragraph was nowhere.
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Two tabs", body_md: LONG }))).saved);
  const opened = site.site.posts()[0];
  await desk({ complains: true }, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const a = await d.open({ post: opened });
    const b = await d.open({ post: opened });
    await a.locator(BODY).fill(`${LONG}\n\nTyped in tab A.`);
    await b.locator('[name="tags"]').fill("go");
    await b.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.tags === "go", UNSAVED(opened.id));
    await b.locator(SAVE).click();
    await movedOn(b);
    assert.equal(await kept(a, UNSAVED(opened.id)), null, "B typed last, so B's save took the shared place with it");
    // A presses save, and the connection drops
    d.state.save = async () => ({ thrown: "Failed to fetch" });
    await a.locator(SAVE).click();
    await a.waitForSelector("#gone");
    assert.match((await kept(a, UNSAVED(opened.id))).fields.body_md, /Typed in tab A\.$/);
    assert.equal(site.site.posts()[0].body_md, LONG, "the site never heard of A's paragraph");

    // the post opened again, as the page that stands in for the editor says to
    d.state.save = (fields) => site.save(fields);
    const again = await d.open({ post: site.site.posts()[0] });
    await offered(again);
    await press(again, 0, "put it back");
    await settle(again);
    assert.match((await look(again)).body_md, /Typed in tab A\.$/);
  });
});

/** every place in this browser's storage that holds these words */
const holding = (page, words) => page.evaluate((words) => Object.keys(localStorage).filter((key) => (localStorage.getItem(key) ?? "").includes(words)), words);

// The press of save writes this tab's boxes into the one shared place. Whatever another tab
// left there goes on the list of offers first: written over, it would be gone the moment this
// save went through, or was refused, or got no answer.
for (const answer of ["goes through", "gets no answer", "is refused"]) {
  inBrowser(`two tabs on one post: a save that ${answer} in one tab does not lose what the other tab typed last`, async () => {
    const site = await newDesk();
    assert.ok((await site.save(site.form({ title: "Two tabs", body_md: LONG }))).saved);
    const opened = site.site.posts()[0];
    await desk({ complains: answer === "gets no answer" }, async (d) => {
      d.state.save = (fields) => site.save(fields);
      const a = await d.open({ post: opened });
      const b = await d.open({ post: opened });
      await a.locator(TITLE).fill("Two tabs, retitled in tab A");
      await b.locator(BODY).fill(`${LONG}\n\nTyped in tab B, and not saved.`);
      await b.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md?.endsWith("not saved."), UNSAVED(opened.id));
      // B is gone with its paragraph unsaved, as a tab is when a browser is shut
      await b.close();
      if (answer === "gets no answer") d.state.save = async () => ({ thrown: "Failed to fetch" });
      if (answer === "is refused") site.failing("getById", 1);
      await a.locator(SAVE).click();
      if (answer === "goes through") await movedOn(a);
      if (answer === "gets no answer") await a.waitForSelector("#gone");
      if (answer === "is refused") { await refused(a); await settle(a); }
      assert.equal((await holding(a, "Typed in tab B, and not saved.")).length, 1, "B's paragraph is still in this browser");
      assert.equal((await holding(a, "Two tabs, retitled in tab A")).length, answer === "goes through" ? 0 : 1, "and so are A's boxes, unless the site has them now");
      if (answer === "is refused") {
        const still = await look(a);
        assert.equal(still.title, "Two tabs, retitled in tab A");
        assert.equal(still.offers.length, 1, "the tab that is still open shows the offer its press made");
      }

      d.state.save = (fields) => site.save(fields);
      const again = await d.open({ post: site.site.posts()[0] });
      await offered(again, answer === "goes through" ? 1 : 2);
      const texts = (await kept(again, OFFERED(opened.id))).map((o) => [o.fields.title, o.fields.body_md.slice(-30)]);
      assert.deepEqual(texts.find(([, end]) => end === "Typed in tab B, and not saved."), ["Two tabs", "Typed in tab B, and not saved."], "B's paragraph is on offer");
      if (answer !== "goes through") assert.ok(texts.some(([title]) => title === "Two tabs, retitled in tab A"), "and so is A's title");
    });
  });
}

inBrowser("two tabs each writing a new post: once both have saved, neither text is left on offer", async () => {
  // The first tab's press moved the second tab's text to the offers, as it should. When the
  // second tab then saved, that offer still said the browser had not seen the text saved.
  const site = await newDesk();
  await desk({}, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const a = await d.open();
    const b = await d.open();
    await a.locator(TITLE).fill("The first of two");
    await a.locator(BODY).fill(LONG);
    await b.locator(TITLE).fill("The second of two");
    await b.locator(BODY).fill(`${LONG}\n\nAnd a paragraph more.`);
    await b.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md?.endsWith("a paragraph more."), UNSAVED());
    await a.locator(SAVE).click();
    await movedOn(a);
    assert.deepEqual((await kept(b, OFFERED())).map((o) => o.fields.title), ["The second of two"], "B's text was moved out of the way of A's press, not written over");
    await b.locator(SAVE).click();
    await movedOn(b);
    assert.deepEqual(site.site.posts().map((p) => p.title).sort(), ["The first of two", "The second of two"]);
    assert.equal(await kept(b, OFFERED()), null, "the site holds B's text now, so it is no longer an offer");
    assert.equal(await kept(b, UNSAVED()), null);
    const fresh = await d.open();
    await settle(fresh);
    assert.deepEqual((await look(fresh)).offers, []);
  });
  // The same for an offer left by an earlier sitting, when the writer types the same words in
  // again by hand and saves them. No tab moved it here, so only the save can take it off the
  // list, and it takes that one and no other.
  await desk({}, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const twice = boxes(null, { title: "Typed twice", body_md: `${LONG}\n\nTyped once and never saved, then typed in again.` });
    const other = earlier(boxes(null, { title: "Another one", body_md: "which nobody has answered" }), null, "2026-09-27T18:30:00.000Z");
    await d.stock({ [OFFERED()]: [earlier(twice, null), other] });
    const page = await d.open();
    await offered(page, 2);
    await page.locator(TITLE).fill(twice.title);
    await page.locator(BODY).fill(twice.body_md);
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.ok(site.site.posts().some((p) => p.title === "Typed twice"));
    assert.deepEqual(await kept(page, OFFERED()), [other], "the words the site now holds are no longer on offer, and the other text still is");
  });
});

// Every write of the one shared place looks at what is there first, and not only the press of
// save. A paragraph typed in one tab, with that tab then closed, was written over by one full
// stop typed in the other: no save pressed, nothing failing, and the paragraph in no place at all.
inBrowser("two tabs on one post: a paragraph typed in one tab and left unsaved is not lost to a letter typed in the other", async () => {
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Two tabs", body_md: LONG }))).saved);
  const opened = site.site.posts()[0];
  const paragraph = `${LONG}\n\nA paragraph typed in tab B, and not saved.`;
  await desk({}, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const a = await d.open({ post: opened });
    const b = await d.open({ post: opened });
    await b.locator(BODY).fill(paragraph);
    await b.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md?.endsWith("not saved."), UNSAVED(opened.id));
    await b.close();
    // one full stop, in the tab that had been open all along
    await a.locator(TITLE).fill("Two tabs.");
    await a.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.title === "Two tabs.", UNSAVED(opened.id));
    assert.deepEqual(await holding(a, "A paragraph typed in tab B, and not saved."), [OFFERED(opened.id)], "B's paragraph went to the offers before A's letter was written where it had been");
    await offered(a, 1);
    assert.match((await look(a)).offers[0], /^Something was typed here on \d+ \w+ at \d\d:\d\d, and this browser did not see it saved\./, "and the tab that is still open says so at once");
    assert.equal((await look(a)).title, "Two tabs.", "with its own boxes as they were typed");
    await a.close();

    // every tab closed, and the post opened again
    const again = await d.open({ post: site.site.posts()[0] });
    await offered(again, 2);
    assert.deepEqual((await kept(again, OFFERED(opened.id))).map((o) => [o.fields.title, o.fields.body_md]), [["Two tabs", paragraph], ["Two tabs.", LONG]], "both are on offer, the one that was moved first");
    await press(again, 0, "put it back");
    await again.waitForFunction(() => document.querySelector('[name="body_md"]').value.endsWith("not saved."));
    await again.locator(SAVE).click();
    await movedOn(again);
    assert.equal(site.site.posts()[0].body_md, paragraph, "and the paragraph is on the site in the end");
  });
});

inBrowser("an offer drawn above the boxes while a key is being typed does not take the caret out of the box", async () => {
  // the first key typed moves the other tab's text to the offers, and the offer is drawn above the box that is being typed in
  await desk({ viewport: { width: 1000, height: 500 } }, async (d) => {
    const post = aPost();
    const a = await d.open({ post });
    const b = await d.open({ post });
    await turn(b, post.id, "First line.\n\nSecond line.\n\nTyped in tab B, and not saved.");
    await b.close();
    await a.locator(TITLE).focus();
    await a.keyboard.press("End");
    await a.keyboard.type(", retitled one key at a time", { delay: 10 });
    await offered(a, 1);
    const seen = await look(a);
    assert.equal(seen.title, "A post, retitled one key at a time", "every key went into the box");
    assert.equal(await a.evaluate(() => document.activeElement?.getAttribute("name")), "title", "and the caret is still in it");
    const box = await a.locator(TITLE).boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= 500, `the box is still on the screen, at ${Math.round(box.y)}`);
  });
});

inBrowser("two tabs on one post: text written down at a press of save that got no answer is not lost to a letter typed in the other tab", async () => {
  // the page that stands in for the editor says the text is kept, and then the other tab typed over it
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Two tabs", body_md: LONG }))).saved);
  const opened = site.site.posts()[0];
  const paragraph = `${LONG}\n\nA paragraph typed in tab A, and sent by a save that got no answer.`;
  await desk({ complains: true }, async (d) => {
    const a = await d.open({ post: opened });
    const b = await d.open({ post: opened });
    await a.locator(BODY).fill(paragraph);
    d.state.save = async () => ({ thrown: "Failed to fetch" });
    await a.locator(SAVE).click();
    await a.waitForSelector("#gone");
    assert.deepEqual(await holding(b, "a save that got no answer."), [UNSAVED(opened.id)]);
    await b.locator('[name="tags"]').fill("go, tabs");
    await b.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.tags === "go, tabs", UNSAVED(opened.id));
    assert.deepEqual(await holding(b, "a save that got no answer."), [OFFERED(opened.id)], "A's paragraph was moved, not written over");
    await offered(b, 1);
    await b.close();

    // the post opened again, as the page that stands in for the editor says to
    const again = await d.open({ post: site.site.posts()[0] });
    await offered(again, 2);
    await press(again, 0, "put it back");
    await again.waitForFunction(() => document.querySelector('[name="body_md"]').value.endsWith("got no answer."));
    assert.equal((await look(again)).body_md, paragraph);
  });
});

/** one tab's turn: the text box is filled, and the turn is over once the one shared place holds those words */
const turn = async (page, id, words) => {
  await page.locator(BODY).fill(words);
  await page.waitForFunction(([key, words]) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md === words, [UNSAVED(id), words]);
  await settle(page);
};

inBrowser("two tabs on one post typed in turn: each tab's newer text takes the place of its own earlier one, so the list of offers does not grow", async () => {
  // moved to the offers at every turn and never taken off, the list would be one text longer for every turn taken
  await desk({}, async (d) => {
    const post = aPost();
    const a = await d.open({ post });
    const b = await d.open({ post });
    await turn(a, post.id, "A, first turn.");
    await turn(b, post.id, "B, first turn.");
    await turn(a, post.id, "A, second turn.");
    await turn(b, post.id, "B, second turn.");
    await turn(a, post.id, "A, third turn.");
    assert.equal((await kept(a, UNSAVED(post.id))).fields.body_md, "A, third turn.", "the tab typed in last has the one place");
    assert.deepEqual((await kept(a, OFFERED(post.id))).map((o) => o.fields.body_md), ["B, second turn."], "and the other tab's newest text is the only one on the list");
    for (const older of ["A, first turn.", "A, second turn.", "B, first turn."]) assert.deepEqual(await holding(a, older), [], `${older} was typed over by the tab that typed it`);
    assert.equal((await look(a)).offers.length, 1, "each tab shows the other's text and never its own");
    assert.equal((await look(b)).offers.length, 1);
    assert.equal((await look(a)).body_md, "A, third turn.");
    assert.equal((await look(b)).body_md, "B, second turn.");
    await a.close();
    await b.close();

    const again = await d.open({ post });
    await offered(again, 2);
    assert.deepEqual((await kept(again, OFFERED(post.id))).map((o) => o.fields.body_md), ["B, second turn.", "A, third turn."]);
  });
});

inBrowser("a tab's earlier text leaves the list of offers only once its newer text is written down", async () => {
  // taken off first, it would be nowhere if the browser then refused the newer text
  await desk({}, async (d) => {
    const post = aPost();
    const a = await d.open({ post });
    const b = await d.open({ post });
    await turn(a, post.id, "A, first turn.");
    await turn(b, post.id, "B, first turn.");
    assert.deepEqual(await holding(a, "A, first turn."), [OFFERED(post.id)]);
    // from here on this tab's browser takes nothing more into the one kept place
    await a.evaluate(() => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith("desk:unsaved:")) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        return write.call(this, key, value);
      };
    });
    await a.locator(BODY).fill("A, second turn.");
    await settle(a);
    assert.deepEqual(await holding(a, "A, second turn."), [], "the newer text could not be written down");
    assert.deepEqual(await holding(a, "A, first turn."), [OFFERED(post.id)], "so the earlier one is still on the list");
    assert.ok((await holding(a, "B, first turn.")).length >= 1, "and B's text is still in this browser too");
    assert.equal((await look(a)).body_md, "A, second turn.");
  });
});

inBrowser("with another tab open on the post, a tab is not offered its own text, and what it swaps out stays on offer", async () => {
  const post = aPost();
  const old = earlier(boxes(post, { body_md: "an older text, never answered" }), post.updated_at);
  /** tab A types with an old offer showing, and then tab B is opened on the same post, which moves A's text to the list */
  const twoTabs = async (d) => {
    await d.stock({ [OFFERED(post.id)]: [old] });
    const a = await d.open({ post });
    await offered(a, 1);
    await turn(a, post.id, "Typed in tab A this morning.");
    const b = await d.open({ post });
    await offered(b, 2);
    assert.deepEqual((await kept(a, OFFERED(post.id))).map((o) => o.fields.body_md), ["an older text, never answered", "Typed in tab A this morning."]);
    return { a, b };
  };
  // the old offer thrown away in A. what is left on the list is A's own boxes, and A does not offer them to itself
  await desk({}, async (d) => {
    const { a, b } = await twoTabs(d);
    await press(a, 0, "throw it away");
    await offered(a, 0);
    assert.deepEqual((await kept(a, OFFERED(post.id))).map((o) => o.fields.body_md), ["Typed in tab A this morning."], "it stays on the list, for a tab that is closed now");
    await a.close();
    await b.close();
    const again = await d.open({ post });
    await offered(again, 1);
    await press(again, 0, "put it back");
    await again.waitForFunction(() => document.querySelector('[name="body_md"]').value === "Typed in tab A this morning.");
  });
  // The old offer put back in A. This sitting's typing goes on offer in its place, and is not
  // taken off the list again when A next writes its boxes down: it is not an earlier state of them.
  await desk({}, async (d) => {
    const { a } = await twoTabs(d);
    await press(a, 0, "put it back");
    await a.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.body_md === "an older text, never answered", UNSAVED(post.id));
    assert.deepEqual((await kept(a, OFFERED(post.id))).map((o) => o.fields.body_md), ["Typed in tab A this morning."]);
    await turn(a, post.id, "an older text, never answered, and a word more");
    assert.deepEqual((await kept(a, OFFERED(post.id))).map((o) => o.fields.body_md), ["Typed in tab A this morning."], "still on offer after more typing");
    assert.equal((await look(a)).offers.length, 1);
  });
});

// the two moments at which a tab writes its boxes over whatever the one shared place holds
for (const moment of ["at the press of save", "at the next letter typed"]) {
  inBrowser(`${moment} a text another tab left in the shared place is offered once, left alone if it cannot be moved, and not offered if the post says the same`, async () => {
    const post = aPost();
    const refusing = async (fields) => ({ error: "Nothing was saved. For the test.", fields: echo(fields), opened: carried(fields).opened ?? "" });
    const MINE = moment === "at the press of save" ? "A post, retitled in this tab" : "A post, retitled in this tab.";
    /** this tab types a title, then another tab leaves `theirs` in the shared place, then save is pressed here and refused, or one more letter is typed here */
    const writeAfter = async (d, theirs) => {
      d.state.save = refusing;
      const page = await d.open({ post });
      await page.locator(TITLE).fill("A post, retitled in this tab");
      await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.fields?.title?.endsWith("in this tab"), UNSAVED(post.id));
      await keep(page, UNSAVED(post.id), theirs);
      if (moment === "at the press of save") {
        await page.locator(SAVE).click();
        await refused(page);
      } else await page.locator(TITLE).fill(MINE);
      await settle(page);
      return page;
    };
    // the same words as an offer that is already on the list: it is listed once, and it is the newer one
    await desk({}, async (d) => {
      const listed = earlier(boxes(post, { body_md: "typed in the other tab" }), post.updated_at, "2026-09-20T09:00:00.000Z");
      const theirs = earlier(boxes(post, { body_md: "typed in the other tab" }), post.updated_at, "2026-09-27T18:30:00.000Z");
      await d.stock({ [OFFERED(post.id)]: [listed] });
      const page = await writeAfter(d, theirs);
      assert.deepEqual(await kept(page, OFFERED(post.id)), [theirs]);
      assert.equal((await look(page)).offers.length, 1);
      assert.equal((await kept(page, UNSAVED(post.id))).fields.title, MINE);
    });
    // The other tab only moved the tick, so its text is what the post says. That is on the site
    // already, and is not made an offer.
    await desk({}, async (d) => {
      const page = await writeAfter(d, earlier(boxes(post, { published: true }), post.updated_at));
      assert.equal(await kept(page, OFFERED(post.id)), null);
      assert.deepEqual((await look(page)).offers, []);
      assert.equal((await kept(page, UNSAVED(post.id))).fields.title, MINE);
    });
    // The other tab holds the very words this tab is about to write down. They are written
    // where they were, and are not offered back to boxes that already say them.
    await desk({}, async (d) => {
      const page = await writeAfter(d, earlier(boxes(post, { title: MINE, published: true }), post.updated_at));
      assert.equal(await kept(page, OFFERED(post.id)), null);
      assert.deepEqual((await look(page)).offers, []);
      const there = await kept(page, UNSAVED(post.id));
      assert.equal(there.fields.title, MINE);
      assert.equal(there.fields.published, false, "and the place holds this tab's boxes now, tick and all");
    });
    // the browser has no room for a longer list of offers: the other tab's text stays where it is, with nothing written over it
    await desk({}, async (d) => {
      await d.context.addInitScript(() => {
        const write = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (String(key).startsWith("desk:offered:")) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
          return write.call(this, key, value);
        };
      });
      const theirs = earlier(boxes(post, { body_md: "typed in the other tab" }), post.updated_at);
      const page = await writeAfter(d, theirs);
      assert.deepEqual(await kept(page, UNSAVED(post.id)), theirs, "it could not be moved, so nothing was written over it");
      assert.equal((await look(page)).title, MINE, "and this tab's boxes are still on the screen");
      // nor does anything typed after that go over it
      await page.locator(BODY).fill("First line.\n\nSecond line.\n\nTyped after the browser refused.");
      await settle(page);
      assert.deepEqual(await kept(page, UNSAVED(post.id)), theirs);
    });
  });
}

// ---------------------------------------------------------------- the post was deleted while its editor was open

inBrowser("a post deleted while its editor was open: the sentence, a second button, and a new post only when that button is pressed", async () => {
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Open in two tabs", body_md: LONG }))).saved);
  const open = site.site.posts()[0];
  await desk({}, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const page = await d.open({ post: open });
    await page.locator(BODY).fill(`${LONG}\n\nTwo hours of text.`);
    assert.equal((await look(page)).asNew, null, "there is no second button until it is needed");
    site.site.remove(open.slug);                       // deleted in another tab

    await page.locator(SAVE).click();
    await refused(page);
    const told = await look(page);
    assert.match(told.refusals[0], /^This post is no longer on the site\./);
    assert.deepEqual(told.asNew, { held: false, says: "save it as a new post" });
    assert.equal(told.body_md, `${LONG}\n\nTwo hours of text.`);
    // save again, and Enter in the title box, are still the plain save, and it is still refused
    await page.locator(SAVE).click();
    await heard(page, d, 2);
    await page.locator(TITLE).press("Enter");
    await heard(page, d, 3);
    await settle(page);
    assert.equal(d.state.sent.length, 3);
    assert.ok(d.state.sent.every((sent) => carried(sent).as_new === undefined));
    assert.equal(site.site.posts().length, 0, "nothing is brought back without that press");

    // The second button, pressed while the database is not answering. It is refused for that
    // reason, and the button is still there to press again: without it the only way on was
    // plain save, which says once more that the post is gone.
    site.failing("getById", 1);
    await page.locator(AS_NEW).click();
    await heard(page, d, 4);
    await settle(page);
    const asleep = await look(page);
    assert.match(asleep.refusals[0], /^The database did not answer, so nothing was saved\. Press "save it as a new post" again in a moment\./);
    assert.deepEqual(asleep.asNew, { held: false, says: "save it as a new post" });
    assert.equal(site.site.posts().length, 0);

    // An image dropped in now is still on its way, and the second button waits for it as the
    // first one does. Pressed while it uploads, the new post would be saved without the image.
    let land;
    d.state.upload = async (route) => { await new Promise((done) => { land = done; }); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://blob.test/chart.png" }) }); };
    await give(page, "drop", [PNG]);
    await page.waitForFunction(() => [...document.querySelectorAll("form span")].some((s) => /^uploading/.test(s.textContent)));
    const uploading = await look(page);
    assert.deepEqual(uploading.asNew, { held: true, says: "save it as a new post" }, "the second button is held while the image uploads");
    assert.equal(uploading.buttonHeld, true);
    await page.locator(AS_NEW).click({ force: true });
    await settle(page);
    assert.equal(d.state.sent.length, 4, "and nothing was sent while the image was on its way");
    while (!land) await new Promise((r) => setTimeout(r, 10));
    land();
    await page.waitForFunction(() => document.querySelector('[name="body_md"]').value.includes("blob.test/chart.png"));
    await says(page, SAVE, "save");
    assert.equal((await look(page)).asNew.held, false, "it is let go once the image is in the text");
    const withImage = `${LONG}\n\nTwo hours of text.\n\n![chart](https://blob.test/chart.png)\n\n`;
    assert.equal((await look(page)).body_md, withImage);

    // while that save is on its way neither button can be pressed again
    let letGo;
    const waiting = new Promise((done) => { letGo = done; });
    d.state.save = async (fields) => { await waiting; return site.save(fields); };
    await page.locator(AS_NEW).click();
    await says(page, SAVE, "saving");
    const during = await look(page);
    assert.equal(during.asNew.held, true);
    assert.equal(during.buttonHeld, true);
    letGo();
    await movedOn(page);
    assert.equal(d.state.sent.length, 5);
    assert.equal(carried(d.state.sent[4]).as_new, "1");
    assert.equal(site.site.posts().length, 1);
    assert.equal(site.site.posts()[0].body_md, withImage, "the new post has the image in it");
    assert.notEqual(site.site.posts()[0].id, open.id);
    assert.equal(await kept(page, UNSAVED(open.id)), null);
    // the page above then finds no post where this one was, and the editor must not go blank over it
    await page.evaluate((id) => window.redraw({ lost: { id } }), open.id);
    await settle(page);
    const done = await look(page);
    assert.equal(done.form, true);
    assert.deepEqual(done.saved, ['Saved. "Open in two tabs" is a draft, so only the desk shows it. Its address is /blog/open-in-two-tabs. Back to the desk.']);
  });
});

inBrowser("with the script off, a post deleted while its editor was open still keeps its text, and can be saved as a new post", async () => {
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Open in two tabs", body_md: LONG, published: true }))).saved);
  const open = site.site.posts()[0];
  const first = drawn({ props: { post: open } });
  await desk({ script: false }, async (d) => {
    // Every request for the page is answered the way Next answers it: a POST runs the real
    // savePost, and the page is then drawn again holding the answer, on a fresh read of the post.
    d.state.page = async (request) => {
      let formState = null;
      if (request.method() === "POST") {
        const posted = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
        const fields = [...posted.entries()].filter(([name]) => !name.startsWith("$ACTION"));
        d.state.sent.push(fields);
        formState = answered(await site.save(fields), first);
      }
      const post = site.site.posts().find((p) => p.id === open.id);
      return drawn({ props: post ? { post } : { lost: { id: open.id } }, formState }).html;
    };
    const page = await d.context.newPage();
    await page.goto(`${ORIGIN}/admin/edit/${open.id}`);
    await page.locator(BODY).fill(`${LONG}\n\nTwo hours of text.`);
    site.site.remove(open.slug);                       // deleted in another tab
    await Promise.all([page.waitForLoadState("load"), page.locator(SAVE).click()]);

    const told = await look(page);
    assert.equal(told.form, true, "the page that comes back is not a page that says there is nothing here");
    assert.equal(told.refusals.length, 2);
    assert.match(told.refusals[0], /^This post is no longer on the site\./);
    assert.equal(told.body_md, `${LONG}\n\nTwo hours of text.`);
    assert.equal(told.tick, true);
    assert.equal(told.sends.id, open.id);
    assert.deepEqual(told.asNew, { held: false, says: "save it as a new post" });
    assert.equal(site.site.posts().length, 0);

    // the second button pressed while the database is not answering: the page that comes back still has it
    site.failing("getById", 1);
    await Promise.all([page.waitForLoadState("load"), page.locator(AS_NEW).click()]);
    const asleep = await look(page);
    assert.match(asleep.refusals[0], /^The database did not answer, so nothing was saved\. Press "save it as a new post" again in a moment\./);
    assert.deepEqual(asleep.asNew, { held: false, says: "save it as a new post" });
    assert.equal(asleep.body_md, `${LONG}\n\nTwo hours of text.`);
    assert.equal(site.site.posts().length, 0);

    await Promise.all([page.waitForLoadState("load"), page.locator(AS_NEW).click()]);
    assert.equal(carried(d.state.sent[2]).as_new, "1");
    const done = await look(page);
    assert.equal(done.form, false);
    assert.equal(done.says, 'Saved. "Open in two tabs" is live at /blog/open-in-two-tabs. Back to the desk.');
    assert.equal(site.site.posts().length, 1);
    assert.equal(site.site.posts()[0].body_md, `${LONG}\n\nTwo hours of text.`);
  });
});

// ---------------------------------------------------------------- text kept for a post that has since been deleted

/** the blocks on the page of a post that is gone, one for each text this browser keeps for it */
const KEPT_FOR_IT = '#root [role="status"]';
const keptForIt = (page, count) => page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length === n, [KEPT_FOR_IT, count]);

inBrowser("text this browser keeps for a post that has since been deleted is shown on that post's page, and can be taken to a new post", async () => {
  // The page said that the post was not on the site and drew nothing else. Two hours of text
  // sat in the browser under the id of a post that no page would ever open again.
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Notes on the cache", body_md: LONG }))).saved);
  const open = site.site.posts()[0];
  const typed = `${LONG}\n\nTwo hours of new text.`;
  await desk({}, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const page = await d.open({ post: open });
    await page.locator(BODY).fill(typed);
    site.site.remove(open.slug);                       // deleted in another tab
    await page.locator(SAVE).click();
    await refused(page);
    assert.match((await look(page)).refusals[0], /^This post is no longer on the site\./);
    // the writer does not press the second button, and loads the page again
    await page.close();

    const gone = await d.open({ lost: { id: open.id } });
    await keptForIt(gone, 1);
    const told = await look(gone);
    assert.equal(told.form, false, "there are still no boxes to save from");
    assert.match(told.says, /^This post is not on the site\. It may have been deleted\./);
    assert.match(told.says, /Something was typed for it here on \d+ \w+ at \d\d:\d\d, and this browser did not see it saved\. Its title was "Notes on the cache"\. Its text is in the box below\. To keep it, press "take it to a new post"\. The page for a new post opens with it on offer, to put back and save\./);
    assert.equal(await gone.locator(`${KEPT_FOR_IT} textarea`).inputValue(), typed, "the text is on the page, to read and to copy");
    assert.equal(await gone.locator(`${KEPT_FOR_IT} textarea`).evaluate((box) => box.readOnly), true);
    assert.equal((await kept(gone, UNSAVED(open.id))).fields.body_md, typed, "looking at it moved nothing");
    assert.equal(await kept(gone, OFFERED()), null);

    await gone.getByText("take it to a new post", { exact: true }).click();
    await movedOn(gone);
    assert.deepEqual((await look(gone)).pushed, ["/admin/new"]);
    assert.equal(await kept(gone, UNSAVED(open.id)), null, "it has left the place of the post that is gone");
    assert.equal(await kept(gone, OFFERED(open.id)), null);
    assert.deepEqual((await kept(gone, OFFERED())).map((o) => o.fields.body_md), [typed]);

    // the page for a new post, where it is an offer like any other and says where it came from
    const fresh = await d.open();
    await offered(fresh);
    const offer = (await look(fresh)).offers[0];
    assert.match(offer, /^Something was typed on \d+ \w+ at \d\d:\d\d for a post that is no longer on the site, and this browser did not see it saved\./);
    assert.doesNotMatch(offer, /typed here|version|address/, "it was not typed on this page, and a new post has no older version");
    await press(fresh, 0, "put it back");
    await settle(fresh);
    const back = await look(fresh);
    assert.deepEqual([back.title, back.slug, back.body_md], ["Notes on the cache", "notes-on-the-cache", typed]);
    await fresh.locator(SAVE).click();
    await movedOn(fresh);
    assert.equal(site.site.posts().length, 1);
    assert.equal(site.site.posts()[0].body_md, typed);
    assert.notEqual(site.site.posts()[0].id, open.id, "a new post, and not the one that was deleted brought back");
    assert.equal(await kept(fresh, OFFERED()), null, "and nothing is left lying in the browser");
  });
});

inBrowser("on the page of a post that is gone each kept text is shown once, and only the one that is taken or thrown away leaves", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const first = earlier(boxes(null, { title: "A post that is gone", body_md: "the first unsaved text" }), "2026-09-01T10:00:00.000Z", "2026-09-20T09:00:00.000Z");
  const second = earlier(boxes(null, { title: "", body_md: "the second unsaved text" }), "2026-09-01T10:00:00.000Z", "2026-09-27T18:30:00.000Z");
  // the same words as the second, still in the first place of the two
  const again = earlier(boxes(null, { title: "", body_md: "the second unsaved text" }), "2026-09-01T10:00:00.000Z", "2026-09-28T07:00:00.000Z");
  await desk({}, async (d) => {
    await d.stock({ [OFFERED(id)]: [first, second], [UNSAVED(id)]: again });
    // a page the server drew: it cannot see the browser's storage, so it says only that the post is not there
    const html = drawn({ props: { lost: { id } } }).html;
    assert.doesNotMatch(html, /Something was typed|textarea|<button/);
    const page = await d.arrive(html, { lost: { id } });
    await d.wake(page, { lost: { id } });
    await keptForIt(page, 2);
    assert.deepEqual(await page.evaluate(() => window.__mismatch ?? []), []);
    const seen = await page.locator(KEPT_FOR_IT).allInnerTexts();
    assert.match(seen[0], /on 20 September at 09:00, and this browser did not see it saved\. Its title was "A post that is gone"\./, "the oldest first");
    assert.match(seen[1], /on 27 September at 18:30, and this browser did not see it saved\. Its text is in the box below\./, "a text with no title does not claim one");
    assert.deepEqual(await page.locator(`${KEPT_FOR_IT} textarea`).evaluateAll((all) => all.map((box) => box.value)), ["the first unsaved text", "the second unsaved text"]);

    await page.locator(KEPT_FOR_IT).nth(1).getByText("throw it away", { exact: true }).click();
    await keptForIt(page, 1);
    assert.deepEqual(await kept(page, OFFERED(id)), [first], "the one thrown away is off the list");
    assert.equal(await kept(page, UNSAVED(id)), null, "and so is the copy of it that was still in the first place");
    assert.equal(await kept(page, OFFERED()), null, "thrown away is not taken anywhere");
    assert.deepEqual((await look(page)).pushed, []);

    await page.locator(KEPT_FOR_IT).nth(0).getByText("take it to a new post", { exact: true }).click();
    await movedOn(page);
    assert.equal(await kept(page, OFFERED(id)), null);
    assert.deepEqual((await kept(page, OFFERED())).map((o) => [o.at, o.fields.title, o.fields.body_md]), [[first.at, "A post that is gone", "the first unsaved text"]]);
    assert.equal((await look(page)).says, "This post is not on the site. It may have been deleted.", "with nothing left to show, the page says what it always said");
  });
  // boxes that were typed back to nothing are not a text
  await desk({}, async (d) => {
    await d.stock({ [UNSAVED(id)]: earlier(boxes(null, { published: true }), "2026-09-01T10:00:00.000Z") });
    const page = await d.open({ lost: { id } });
    await settle(page);
    assert.equal((await look(page)).says, "This post is not on the site. It may have been deleted.");
  });
  // A kept text with nothing in the big box. The page said "Its text is in the box below." over
  // an empty box, and what had been typed was in boxes it did not show.
  for (const [fields, said] of [
    [{ title: "Only a title was typed" }, 'and this browser did not see it saved. Its title was "Only a title was typed". It has no text. To keep it, press "take it to a new post".'],
    [{ tags: "go, notes", excerpt: "One line for the list." }, 'and this browser did not see it saved. It has no text. Its tags were "go, notes". Its one line for the list page was "One line for the list.". To keep it, press "take it to a new post".'],
    [{ slug: "an-address", cover_url: "/covers/a.png" }, 'and this browser did not see it saved. It has no text. Its address was "an-address". Its cover image address was "/covers/a.png". To keep it, press "take it to a new post".'],
  ]) {
    await desk({}, async (d) => {
      await d.stock({ [UNSAVED(id)]: earlier(boxes(null, fields), "2026-09-01T10:00:00.000Z") });
      const page = await d.open({ lost: { id } });
      await keptForIt(page, 1);
      const told = (await look(page)).says;
      assert.ok(told.includes(said), told);
      assert.doesNotMatch(told, /in the box below/, "there is no text, so no box is pointed at");
      assert.equal(await page.locator(`${KEPT_FOR_IT} textarea`).count(), 0, "and no empty box is drawn");
      // it is taken to a new post like any other, with everything it held
      await page.getByText("take it to a new post", { exact: true }).click();
      await movedOn(page);
      assert.deepEqual((await kept(page, OFFERED())).map((o) => o.fields), [boxes(null, fields)]);
    });
  }
  // a text already offered on the page for a new post is not listed there twice
  await desk({}, async (d) => {
    const there = earlier(boxes(null, { body_md: "the first unsaved text", title: "A post that is gone" }), null, "2026-09-10T09:00:00.000Z");
    await d.stock({ [UNSAVED(id)]: first, [OFFERED()]: [there, second] });
    const page = await d.open({ lost: { id } });
    await keptForIt(page, 1);
    await page.getByText("take it to a new post", { exact: true }).click();
    await movedOn(page);
    assert.deepEqual((await kept(page, OFFERED())).map((o) => o.at), [second.at, first.at]);
  });
});

inBrowser("when the browser will not store a text in its new place, it stays on the page of the post that is gone, and the page says so", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const mine = earlier(boxes(null, { title: "A post that is gone", body_md: "typed for a post that was then deleted" }), "2026-09-01T10:00:00.000Z");
  await desk({ storage: "full" }, async (d) => {
    await d.stock({ [UNSAVED(id)]: mine });
    const page = await d.open({ lost: { id } });
    await keptForIt(page, 1);
    await page.getByText("take it to a new post", { exact: true }).click();
    await page.waitForFunction((sel) => /would not store it in its new place/.test(document.querySelector(sel)?.textContent ?? ""), KEPT_FOR_IT);
    assert.match((await look(page)).says, /This browser would not store it in its new place, so it is still here and nowhere else\. Copy it from the box\./);
    assert.deepEqual((await look(page)).pushed, [], "the page does not move on to an offer that is not there");
    assert.deepEqual(await kept(page, UNSAVED(id)), mine);
    assert.equal(await kept(page, OFFERED()), null);
    assert.equal(await page.locator(`${KEPT_FOR_IT} textarea`).inputValue(), "typed for a post that was then deleted");
  });
  // a kept text with no text in it has no box to copy from, and the line does not send the writer to one
  await desk({ storage: "full" }, async (d) => {
    await d.stock({ [UNSAVED(id)]: earlier(boxes(null, { title: "Only a title was typed" }), "2026-09-01T10:00:00.000Z") });
    const page = await d.open({ lost: { id } });
    await keptForIt(page, 1);
    await page.getByText("take it to a new post", { exact: true }).click();
    await page.waitForFunction((sel) => /would not store it in its new place/.test(document.querySelector(sel)?.textContent ?? ""), KEPT_FOR_IT);
    assert.match((await look(page)).says, /This browser would not store it in its new place, so it is still here and nowhere else\. Copy it from this page\./);
    assert.doesNotMatch((await look(page)).says, /from the box/);
  });
});

/** on the page for a new post: one line for each other post this browser keeps text for */
const ELSEWHERE = 'form > [role="note"]';
const elsewhere = (page) => page.locator(ELSEWHERE).evaluateAll((all) => all.map((el) => ({ says: el.textContent.replace(/\s+/g, " ").trim(), to: el.querySelector("a")?.getAttribute("href") ?? null })));

inBrowser("the page for a new post says which other posts this browser keeps text for, and links to each", async () => {
  // Text kept for a post that was then deleted is shown on that post's own page, and once the
  // tab was closed nothing on the desk led there: the list no longer has the post.
  const site = await newDesk();
  assert.ok((await site.save(site.form({ title: "Notes on the cache", body_md: LONG }))).saved);
  const open = site.site.posts()[0];
  const typed = `${LONG}\n\nTwo hours of new text.`;
  await desk({}, async (d) => {
    d.state.save = (fields) => site.save(fields);
    const page = await d.open({ post: open });
    await page.locator(BODY).fill(typed);
    site.site.remove(open.slug);                       // deleted in another tab
    await page.locator(SAVE).click();
    await refused(page);
    // the writer does not press the second button, and closes the tab
    await page.close();

    // Write something
    const fresh = await d.open();
    await fresh.waitForSelector(ELSEWHERE);
    assert.deepEqual((await look(fresh)).offers, [], "it is not an offer here: it was not typed for a new post");
    assert.deepEqual(await elsewhere(fresh), [{
      says: 'Something typed for another post, "Notes on the cache", is kept in this browser, which did not see it saved. It can be had back on that post\'s own page, unless the post already says the same. open that post',
      to: `/admin/edit/${open.id}`,
    }]);
    assert.equal((await kept(fresh, UNSAVED(open.id))).fields.body_md, typed, "looking moved nothing");

    // the link, followed: the page of the post that is gone, which shows the text and can take it to a new post
    const gone = await d.open({ lost: { id: open.id } });
    await keptForIt(gone, 1);
    await gone.getByText("take it to a new post", { exact: true }).click();
    await movedOn(gone);
    const after = await d.open();
    await offered(after, 1);
    assert.deepEqual(await elsewhere(after), [], "taken here, it is an offer on this page and no longer kept for another post");
  });
});

inBrowser("the line about other posts is drawn only on the page for a new post, only by the script, and only for a text that says something", async () => {
  const [first, second, third] = ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
  const stocked = {
    [UNSAVED(first)]: earlier(boxes(null, { title: "The first of them", body_md: "kept for the first" }), "2026-09-01T10:00:00.000Z"),
    // one post with a text in each of its two places is one post
    [OFFERED(first)]: [earlier(boxes(null, { title: "An older title", body_md: "an older text for the first" }), "2026-09-01T10:00:00.000Z")],
    // a text with no title
    [OFFERED(second)]: [earlier(boxes(null, { body_md: "kept for the second" }), "2026-09-01T10:00:00.000Z")],
    // boxes typed back to nothing are not a text
    [UNSAVED(third)]: earlier(boxes(null, { published: true }), "2026-09-01T10:00:00.000Z"),
    // what a new post keeps is this page's own, and is offered on it
    [OFFERED()]: [earlier(boxes(null, { title: "From the train", body_md: "kept for a new post" }), null)],
    // and things the desk did not write
    "desk:unsaved:not-a-post": earlier(boxes(null, { body_md: "under a name that is no post's id" }), null),
    "desk:offered:55555555-5555-4555-8555-555555555555": "{ not what the desk writes",
    "something:else": "x",
  };
  await desk({}, async (d) => {
    await d.stock(stocked);
    const page = await d.open();
    await offered(page, 1);
    assert.deepEqual(await elsewhere(page), [
      { says: 'Something typed for another post, "The first of them", is kept in this browser, which did not see it saved. It can be had back on that post\'s own page, unless the post already says the same. open that post', to: `/admin/edit/${first}` },
      { says: "Something typed for another post is kept in this browser, which did not see it saved. It can be had back on that post's own page, unless the post already says the same. open that post", to: `/admin/edit/${second}` },
    ]);
    // the page of a post has its own text to offer, and does not list the others
    const post = aPost();
    const edit = await d.open({ post });
    await settle(edit);
    assert.deepEqual(await elsewhere(edit), []);
  });
  // the server cannot look in the browser, so the page it draws has no such line
  assert.doesNotMatch(drawn({ props: {} }).html, /kept in this browser|role="note"/);
  // a browser that cannot be looked in: the page for a new post opens as it always did
  await desk({ storage: false }, async (d) => {
    const page = await d.open();
    await settle(page);
    assert.deepEqual(await elsewhere(page), []);
    assert.equal((await look(page)).form, true);
  });
});

// ---------------------------------------------------------------- the page could not read the post

inBrowser("when the page could not read the post the editor draws no form at all, only the sentence", async () => {
  // empty boxes with the post's id in the form would have saved an empty post over the real one
  await desk({}, async (d) => {
    const post = aPost();
    const mine = earlier(boxes(post, { body_md: "typed last week" }), post.updated_at);
    await d.stock({ [UNSAVED(post.id)]: mine });
    const unread = await d.open({ lost: { id: post.id, reason: "fetch failed" } });
    await settle(unread);
    const told = await look(unread);
    assert.equal(told.form, false);
    assert.match(told.says, /^The database did not answer, so this post could not be opened\. Nothing was changed\. Load the page again in a moment\. \(fetch failed\)/);
    assert.equal(await unread.getByText("load this page again", { exact: true }).getAttribute("href"), `/admin/edit/${post.id}`, "and the link under it leads back to this post, not to the desk");
    assert.deepEqual(await kept(unread, UNSAVED(post.id)), mine, "and what this browser was keeping for the post is left where it is");
    assert.equal(await unread.locator(KEPT_FOR_IT).count(), 0, "nor is it shown as text for a post that is gone: nobody has said the post is gone");

    const missing = await d.open({ lost: { id: "22222222-2222-4222-8222-222222222222" } });
    const none = await look(missing);
    assert.equal(none.form, false);
    assert.match(none.says, /^This post is not on the site\. It may have been deleted\./);
  });
});

inBrowser("a refused save drawn on a page that could not read the post still has its boxes, its id and its stamp", async () => {
  // with the script off Next runs the save and then draws the page again, and that read can fail too
  const post = aPost();
  const typed = boxes(post, { body_md: "First line.\n\nSecond line.\n\nTyped with the script off.", published: true });
  const lost = { id: post.id, reason: "fetch failed" };
  const first = drawn({ props: { post } });
  const state = answered({ error: "The database did not answer, so nothing was saved. Press save again in a moment. (fetch failed)", fields: typed, opened: post.updated_at }, first);
  const html = drawn({ props: { lost }, formState: state }).html;
  await desk({ script: false }, async (d) => {
    const page = await d.arrive(html, { lost });
    const seen = await look(page);
    assert.equal(seen.form, true);
    assert.equal(seen.body_md, typed.body_md);
    assert.equal(seen.tick, true);
    assert.equal(seen.sends.id, post.id);
    assert.equal(seen.sends.opened, post.updated_at);
    assert.equal(seen.refusals.length, 2);
  });
  await desk({}, async (d) => {
    const page = await d.arrive(html, { lost });
    await d.wake(page, { lost }, state);
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    assert.deepEqual((await kept(page, UNSAVED(post.id))).fields, typed);
    assert.deepEqual(await page.evaluate(() => window.__mismatch ?? []), []);
  });
});

// ---------------------------------------------------------------- a page knows which version of the post it was opened on

inBrowser("the form carries the stamp of the post it was opened on, and keeps it when the page above hands it a newer post", async () => {
  await desk({}, async (d) => {
    const post = aPost({ published: true, published_at: "2026-09-01T10:00:00.000Z" });
    const page = await d.open({ post });
    const sends = (await look(page)).sends;
    assert.equal(sends.id, post.id);
    assert.equal(sends.opened, post.updated_at);
    assert.equal("published_at" in sends, false, "the day it went out is the site's to keep, not the form's");
    await page.locator(BODY).fill("typed over the version this page was opened on");
    // the page above draws again with the post as someone else has just saved it
    await page.evaluate((newer) => window.redraw({ post: newer }), aPost({ body_md: "saved from somewhere else", updated_at: "2026-09-02T08:00:00.000Z", published: true, published_at: "2026-09-01T10:00:00.000Z" }));
    await settle(page);
    const after = await look(page);
    assert.equal(after.body_md, "typed over the version this page was opened on");
    assert.equal(after.sends.opened, post.updated_at, "the stamp stays with the boxes, so the site can refuse this page");

    const fresh = await d.open();
    const none = (await look(fresh)).sends;
    assert.equal("id" in none, false);
    assert.equal("opened" in none, false);
  });
});

// ---------------------------------------------------------------- next to all of the above

inBrowser("with storage switched off in the browser the editor still opens, takes typing and saves", async () => {
  await desk({ storage: false }, async (d) => {
    const post = aPost();
    const page = await d.open({ post });
    await page.locator(BODY).fill("typed with storage off");
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.equal(carried(d.state.sent[0]).body_md, "typed with storage off");
  });
});

inBrowser("run the way next dev runs it, with every effect twice, the editor makes no offer of the text in its own boxes", async () => {
  await desk({ mode: "development" }, async (d) => {
    const post = aPost();
    const old = earlier(boxes(post, { body_md: "kept text" }), post.updated_at);
    await d.stock({ [UNSAVED(post.id)]: old });
    const page = await d.open({ post }, { strict: true });
    await offered(page);
    await page.locator(BODY).fill("typed today");
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    await settle(page);
    assert.deepEqual(await kept(page, OFFERED(post.id)), [old]);
    await press(page, 0, "put it back");
    await offered(page, 1);
    assert.deepEqual((await kept(page, OFFERED(post.id))).map((o) => o.fields.body_md), ["typed today"]);
    d.state.save = async () => SAVED;
    await page.locator(SAVE).click();
    await movedOn(page);
    assert.equal(d.state.sent.length, 1);
    assert.equal(carried(d.state.sent[0]).body_md, "kept text");
  });
  // and a page that arrives holding a refused save does not offer that save's own boxes back to itself
  await desk({ mode: "development" }, async (d) => {
    const post = aPost();
    const typed = boxes(post, { body_md: "typed before the script" });
    const first = drawn({ props: { post } });
    const state = answered({ error: "Nothing was saved. For the test.", fields: typed, opened: post.updated_at }, first);
    const page = await d.arrive(drawn({ props: { post }, formState: state }).html, { post });
    await d.wake(page, { post }, state, { strict: true });
    await page.waitForFunction((key) => localStorage.getItem(key) !== null, UNSAVED(post.id));
    await settle(page);
    assert.deepEqual((await look(page)).offers, []);
    assert.deepEqual(await kept(page, OFFERED(post.id)) ?? [], []);
    assert.deepEqual((await kept(page, UNSAVED(post.id))).fields, typed, "they are kept, in the one place, as this sitting's typing");
    assert.deepEqual(await page.evaluate(() => window.__mismatch ?? []), []);
  });
});
