/**
 * The editor in a real browser with no server: a Chromium tab whose every request to
 * http://desk.test is answered from memory here. A request for anywhere else is refused, so
 * nothing leaves the machine.
 *
 *   const { browser, missing } = await launch();
 *   const desk = await profile(browser);            // one browser profile, so one localStorage
 *   desk.state.save = async (fields) => ...;        // what savePost answers
 *   const page = await desk.open({ post });         // the editor, drawn by its own script
 *   await look(page);                               // what the writer sees and what a save would send
 *
 * A page can also arrive the way a real one does, already drawn by the server, and be woken
 * afterwards: drawn() makes what the server sends (it lives in drawn.mjs, because it needs no
 * browser), arrive() shows it, wake() runs the script. visit() is for a tab that leaves and
 * comes back: it keeps the site answering.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { bundle, REPO } from "./bundle.mjs";

export { drawn, answered } from "./drawn.mjs";
export const ORIGIN = "http://desk.test";
/** what Next sends with a page it draws for each request. It is why the Back button fetches the editor again and does not show the one it had. */
const DRAWN_EACH_TIME = { "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate" };
export const SAVE = "form button:not([type=button]):not([name])";
export const AS_NEW = 'form button[name="as_new"]';

/**
 * Playwright is not a dependency of the site and must not become one, so it is looked for:
 * in the folder PLAYWRIGHT_FROM names, then in the repo's own node_modules, then in whatever
 * `npx playwright` has left in npm's cache, newest first.
 */
function places() {
  const cache = join(homedir(), ".npm", "_npx");
  let left = [];
  try {
    left = readdirSync(cache).map((d) => join(cache, d, "node_modules")).filter((d) => existsSync(join(d, "playwright")));
    left.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  } catch { /* npx has never been run here */ }
  return [process.env.PLAYWRIGHT_FROM, join(REPO, "node_modules"), ...left].filter(Boolean);
}

export const HOW_TO_GET_IT = 'Skipped, because no Playwright with a Chromium it can start was found on this machine: run "npx playwright install chromium" once, or point PLAYWRIGHT_FROM at a folder that has one, then run "npm run desk" again.';

/** @returns {Promise<{ browser: import("playwright").Browser, from: string } | { missing: string }>} */
export async function launch() {
  for (const dir of places()) {
    try {
      const { chromium } = createRequire(join(dir, "/"))("playwright");
      return { browser: await chromium.launch(), from: dir };
    } catch { /* not there, or its browser is not installed. the next place may have one. */ }
  }
  return { missing: HOW_TO_GET_IT };
}

/**
 * One browser profile.
 * @param {{ mode?: "production" | "development", script?: boolean, viewport?: { width: number, height: number }, storage?: false | "full" | "at its limit" }} opts
 *   script: false is a browser with JavaScript switched off. storage: false is one that refuses localStorage, "full" one that will not
 *   take any write at all, and "at its limit" one that takes a write only when it does not make what it holds any longer.
 */
export async function profile(browser, opts = {}) {
  const script = opts.script ?? true;
  // one clock and one way of writing a date, so what the page says does not depend on the machine
  const context = await browser.newContext({ viewport: opts.viewport ?? { width: 1000, height: 900 }, javaScriptEnabled: script, timezoneId: "UTC", locale: "en-GB" });
  // a page that never gets where a test expects is a failed test in a few seconds, not in thirty
  context.setDefaultTimeout(6000);
  const state = {
    /** what savePost does. given the form as [name, value] pairs, answers what savePost answers, or { thrown } for a save that never got an answer. */
    save: async () => ({ saved: true, title: "", slug: "", published: false }),
    /** what /api/upload does */
    upload: async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://blob.test/img.png" }) }),
    /** every form a save carried, in order */
    sent: [],
    /** for a page the server drew: (request) => the editor's html. null is a page that only has its script. */
    page: null,
    /** what the page said that it should not have */
    trouble: [],
  };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/editor.js") return route.fulfill({ contentType: "text/javascript; charset=utf-8", body: bundle(opts.mode) });
    if (url.pathname === "/api/upload") return state.upload(route);
    const html = state.page ? await state.page(request) : null;
    const body = html === null ? `<div id="root"></div><script src="/editor.js"></script>` : `<div id="root">${html}</div>`;
    return route.fulfill({ contentType: "text/html; charset=utf-8", headers: DRAWN_EACH_TIME, body: `<!doctype html><meta charset="utf-8"><title>desk</title>${body}` });
  });
  if (script) {
    await context.exposeFunction("__saveBridge", async (fields) => { state.sent.push(fields); return state.save(fields); });
    await context.addInitScript(() => {
      window.__savePost = async (_last, formData) => {
        const answer = await window.__saveBridge([...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "[a file]"]));
        if (answer && answer.thrown) throw new Error(answer.thrown);
        return answer;
      };
    });
    if (opts.storage === false) {
      await context.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("The operation is insecure.", "SecurityError"); } }); });
    }
    // full: what is there can be read and removed, and nothing more can be written. stock() still can, from its own page.
    if (opts.storage === "full") {
      await context.addInitScript(() => { if (location.pathname !== "/admin") Storage.prototype.setItem = () => { throw new DOMException("The quota has been exceeded.", "QuotaExceededError"); }; });
    }
    // at its limit: what a real browser does when it is full. A write that leaves the site
    // holding no more than before is taken, so a shorter list goes in, and one that grows it is refused.
    if (opts.storage === "at its limit") {
      await context.addInitScript(() => {
        if (location.pathname === "/admin") return;
        const write = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          const was = this.getItem(key);
          if (String(value).length > (was === null ? -key.length : was.length)) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
          return write.call(this, key, value);
        };
      });
    }
  }
  const watched = async () => {
    const page = await context.newPage();
    page.on("pageerror", (e) => state.trouble.push(`page error: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") state.trouble.push(`console error: ${m.text().slice(0, 300)}`); });
    return page;
  };
  const pathFor = (props) => { const id = props?.post?.id ?? props?.lost?.id; return id ? `/admin/edit/${id}` : "/admin/new"; };

  return {
    context, state,
    /** the editor on a page reached from inside the desk: drawn by its own script. strict runs every effect twice, as `next dev` does. */
    async open(props = {}, { strict = false } = {}) {
      const page = await watched();
      await page.goto(`${ORIGIN}${pathFor(props)}`);
      await page.evaluate(([p, s]) => window.mount(p, s), [props, strict]);
      await page.waitForSelector("#root > *");
      // the editor looks in the browser's storage once it is on the screen
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))));
      return page;
    },
    /** a page as it arrives from the server, before its script has run. with script: false it stays that way. */
    async arrive(html, props = {}) {
      state.page = async () => html;
      const page = await watched();
      await page.goto(`${ORIGIN}${pathFor(props)}`);
      state.page = null;
      return page;
    },
    /**
     * A tab on a site that keeps answering: from now on `draw(request)` is asked for every page
     * this profile loads, so the tab can go to another address, come back, and be fetched again.
     */
    async visit(path, draw) {
      state.page = draw;
      const page = await watched();
      await page.goto(`${ORIGIN}${path}`);
      return page;
    },
    /** the script loads and takes over a page the server drew, the way Next does it. strict runs every effect twice, as `next dev` does. */
    async wake(page, props = {}, formState = null, { strict = false } = {}) {
      await page.addScriptTag({ url: `${ORIGIN}/editor.js` });
      await page.evaluate(([p, f, s]) => window.hydrate(p, f, s), [props, formState, strict]);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))));
    },
    /** put things in this browser's storage, as an earlier visit would have left them */
    async stock(things) {
      state.page = async () => "";
      const page = await context.newPage();
      await page.goto(`${ORIGIN}/admin`);
      state.page = null;
      await page.evaluate((things) => { for (const [key, value] of Object.entries(things)) localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); }, things);
      await page.close();
    },
    close: () => context.close(),
  };
}

/** long enough for the editor to have looked in the browser's storage and drawn what it found */
export const settle = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 60)))));

/** what the writer can see, and what the browser would send if save were pressed now */
export function look(page) {
  return page.evaluate(([SAVE, AS_NEW]) => {
    const form = document.querySelector("form");
    const texts = (found) => [...found].map((e) => e.textContent.replace(/\s+/g, " ").trim());
    if (!form) return { form: false, gone: document.getElementById("gone")?.textContent ?? null, says: document.getElementById("root").innerText.replace(/\s+/g, " ").trim(), pushed: window.__pushed ?? [] };
    const box = (name) => form.querySelector(`[name="${name}"]`);
    const boxes = ["title", "slug", "tags", "excerpt", "cover_url", "body_md"];
    const save = document.querySelector(SAVE);
    const asNew = document.querySelector(AS_NEW);
    return {
      form: true,
      ...Object.fromEntries(boxes.map((name) => [name, box(name).value])),
      tick: box("published").checked,
      /** every field a save pressed now would carry, hidden ones included */
      sends: Object.fromEntries(new FormData(form)),
      readOnly: boxes.filter((name) => box(name).readOnly),
      tickHeld: box("published").disabled,
      coverSays: box("cover_url").validationMessage,
      offers: texts(form.querySelectorAll(':scope > [role="status"]:not(p)')),
      refusals: texts(form.querySelectorAll(':scope > [role="alert"]')),
      saved: texts(form.querySelectorAll(':scope > p[role="status"]')),
      notes: texts(form.querySelectorAll('span[role="alert"]')),
      uploading: texts(form.querySelectorAll("span")).find((said) => /^uploading\b/.test(said)) ?? null,
      button: save.textContent, buttonHeld: save.disabled,
      asNew: asNew ? { held: asNew.disabled, says: asNew.textContent } : null,
      pushed: window.__pushed ?? [],
    };
  }, [SAVE, AS_NEW]);
}

/** one thing this browser is keeping for the desk, as it is stored */
export const kept = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
export const keep = (page, key, value) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [key, value]);

/**
 * Files handed to the text box the way a browser hands them over, by a drop or by a paste.
 * @param {{ name: string, type: string, size?: number }[]} files
 */
export const give = (page, how, files) => page.evaluate(([how, files]) => {
  const carried = new DataTransfer();
  for (const f of files) carried.items.add(new File([new Uint8Array(f.size ?? 10)], f.name, { type: f.type }));
  const box = document.querySelector('[name="body_md"]');
  const event = how === "drop" ? new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: carried }) : new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: carried });
  box.dispatchEvent(event);
  return event.defaultPrevented;
}, [how, files]);

/** a post as the store hands one to a page */
export const aPost = (change = {}) => ({
  id: "11111111-1111-4111-8111-111111111111", slug: "a-post", title: "A post", excerpt: null, body_md: "First line.\n\nSecond line.", body_text: "First line. Second line.",
  cover_url: null, tags: ["go"], published: false, reading_time: 1, created_at: "2026-09-01T10:00:00.000Z", updated_at: "2026-09-01T10:00:00.000Z", published_at: null, ...change,
});
