/**
 * The desk's real code in this process: savePost, deletePost, the desk's reads, the proxy and
 * the pages, on a site from site.mjs.
 *
 *   const desk = await newDesk();
 *   await desk.save(desk.form({ title: "A title", body_md: "Some text." }));   // what savePost answered
 *   desk.site.posts();                                                         // what the site holds now
 *
 * site.mjs runs the desk as a process of its own for each save. That is right for the post
 * command's tests, and it cannot reach in to make a read fail, hold a save back, or look at
 * what a refusal handed back. Here the same code runs where a test can hold it.
 */
import { join } from "node:path";
import { newSite } from "./site.mjs";
import { buildDesk } from "./build.mjs";

let once;
/** the server code is converted once for each process, and each desk gets a site of its own */
async function code() {
  if (once) return once;
  const first = newSite();
  const built = buildDesk(join(first.dir, "desk-built"));
  const { getStore } = await import(built.store);
  const store = getStore();
  return (once = { built, store, real: { ...store } });
}

const BOXES = ["title", "slug", "tags", "excerpt", "cover_url", "body_md"];

export async function newDesk() {
  const { built, store, real } = await code();
  // whatever the last test did to the store is undone
  Object.assign(store, real);
  const site = newSite();
  Object.assign(process.env, { SIM_STATE: join(site.dir, "state.json"), ADMIN_PASSWORD: "sim-only-password", SESSION_SECRET: "sim-only-secret-used-nowhere-else" });
  const auth = await import(built.auth);
  const actions = await import(built.actions);
  const posts = await import(built.posts);
  await auth.startSession();

  return {
    site, auth, actions, posts, store, built,
    /**
     * The form as the editor sends it for `post`, or for a new post when there is none, with
     * some of it changed. `opened: null` sends no stamp, `as_new: true` presses "save it as a
     * new post", and anything under `also` is sent as it is, for fields a page never has.
     */
    form(change = {}, post = null) {
      const boxes = { title: post?.title ?? "", slug: post?.slug ?? "", tags: post?.tags?.join(", ") ?? "", excerpt: post?.excerpt ?? "", cover_url: post?.cover_url ?? "", body_md: post?.body_md ?? "", ...change };
      const form = new FormData();
      const id = "id" in change ? change.id : post?.id;
      const opened = "opened" in change ? change.opened : post?.updated_at;
      if (id) form.set("id", id);
      if (opened !== null && opened !== undefined) form.set("opened", opened);
      for (const name of BOXES) form.set(name, name === "body_md" ? boxes[name].replace(/\r\n|\r|\n/g, "\r\n") : boxes[name]);
      if (change.published ?? post?.published ?? false) form.set("published", "on");
      if (change.as_new) form.set("as_new", "1");
      for (const [name, value] of Object.entries(change.also ?? {})) form.set(name, value);
      return form;
    },
    /** @param {FormData | [string, string][]} form the form, or its fields as a browser handed them over */
    save(form) {
      if (Array.isArray(form)) { const pairs = form; form = new FormData(); for (const [k, v] of pairs) form.append(k, v); }
      return actions.savePost(undefined, form);
    },
    /** make one kind of read or write fail the next `times` it is asked, the way a sleeping database does */
    failing(what, times = Infinity, why = "fetch failed") {
      const was = store[what];
      let left = times;
      store[what] = async function (...args) { if (left-- > 0) throw new Error(why); return was.apply(store, args); };
      return () => { store[what] = was; };
    },
    /** one of the desk's pages, as the function Next would call */
    async page(name) { return (await import(built.page(name))).default; },
    async proxy() { return import(built.proxy); },
  };
}
