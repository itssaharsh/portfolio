/**
 * Turns the REAL server code into something plain Node can run, so the post command and the
 * writing desk can be tested against it without a server, a network or a database.
 *
 * The files are taken from the repo as they are. TypeScript is stripped and nothing else is
 * changed except where they import from. The framework pieces that need a running Next (its
 * cache, its headers, its redirects) and the database are swapped for the stand-ins in this
 * folder. Everything else, the password check, the brake on guessing, the rules for a save, is
 * the code that runs on the site.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const HERE = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(join(REPO, "package.json"));
const ts = require("typescript");

const standIn = (name) => pathToFileURL(join(HERE, "stand-ins", name)).href;
const inRepo = (path) => pathToFileURL(join(REPO, path)).href;

/** @param {string} out the folder to write into */
function converter(out) {
  mkdirSync(out, { recursive: true });
  const built = (name) => pathToFileURL(join(out, name)).href;

  /** where each import goes instead. anything from npm is found in the repo's own node_modules. */
  const swaps = {
    "server-only": standIn("empty.mjs"),
    "next/cache": standIn("cache.mjs"),
    "next/headers": standIn("headers.mjs"),
    "next/navigation": standIn("navigation.mjs"),
    "next/link": standIn("link.mjs"),
    "@/lib/store": standIn("store.mjs"),
    "./store": standIn("store.mjs"),
    "@/lib/auth": built("auth.mjs"),
    "@/lib/posts": built("posts.mjs"),
    "@/scripts/post-text.mjs": inRepo("scripts/post-text.mjs"),
    // the desk's pages reach the actions and the editor from three depths
    "./actions": built("actions.mjs"),
    "../actions": built("actions.mjs"),
    "../../actions": built("actions.mjs"),
    "../Editor": standIn("editor.mjs"),
    "../../Editor": standIn("editor.mjs"),
    "../login/page": standIn("login.mjs"),
    "../../login/page": standIn("login.mjs"),
    "./DeleteForm": built("delete-form.mjs"),
  };

  return (from, to) => {
    const js = ts.transpileModule(readFileSync(join(REPO, from), "utf8"), {
      // the name tells TypeScript whether what it is reading may hold markup
      fileName: from,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const rewritten = js.replace(/(\bfrom\s+|\bimport\s+)(["'])([^"']+)\2/g, (whole, lead, quote, spec) => {
      if (spec.startsWith("node:")) return whole;
      if (swaps[spec]) return `${lead}${quote}${swaps[spec]}${quote}`;
      // a new relative or aliased import has to be given a place above, on purpose
      if (spec.startsWith(".") || spec.startsWith("@/")) throw new Error(`${from} imports ${spec}, and scripts/sim/build.mjs does not know what to give it`);
      return `${lead}${quote}${pathToFileURL(require.resolve(spec)).href}${quote}`;
    });
    writeFileSync(join(out, to), rewritten);
    return built(to);
  };
}

/**
 * What the post command talks to: app/api/posts/route.ts, app/admin/actions.ts, lib/posts.ts
 * and lib/auth.ts.
 *
 * @param {string} out an empty folder to write into
 * @returns {{ route: string, actions: string, auth: string, posts: string }} what was written, as addresses to import
 */
export function build(out) {
  const convert = converter(out);
  return {
    posts: convert("lib/posts.ts", "posts.mjs"),
    auth: convert("lib/auth.ts", "auth.mjs"),
    route: convert("app/api/posts/route.ts", "route.mjs"),
    actions: convert("app/admin/actions.ts", "actions.mjs"),
  };
}

/** the pages of the desk, by the name a test asks for them */
const PAGES = {
  list: "app/admin/page.tsx",
  new: "app/admin/new/page.tsx",
  edit: "app/admin/edit/[id]/page.tsx",
  delete: "app/admin/delete/[id]/page.tsx",
  error: "app/admin/error.tsx",
};

/**
 * The same, and with it what only the desk's own tests need: the proxy, and the pages of the
 * desk. A page is a function that hands back what to draw. It is given a plain link for
 * next/link, and for the editor a stand-in, because the editor is run in a browser instead
 * (scripts/sim/editor). Kept apart from build(), and each page converted only when it is asked
 * for, so that a page with a new import can only ever stop the test that draws it.
 *
 * @param {string} out an empty folder to write into
 */
export function buildDesk(out) {
  const code = build(out);
  const convert = converter(out);
  const done = {};
  return {
    ...code,
    proxy: convert("proxy.ts", "proxy.mjs"),
    /** the form on the page that asks before deleting: the one thing that calls deletePost */
    deleteForm: () => (done.form ??= convert("app/admin/delete/[id]/DeleteForm.tsx", "delete-form.mjs")),
    /** @param {keyof typeof PAGES} name */
    page(name) {
      // that page draws the form above, which is the real one here too
      if (name === "delete") this.deleteForm();
      return (done[name] ??= convert(PAGES[name], `page-${name}.mjs`));
    },
    editor: standIn("editor.mjs"),
    login: standIn("login.mjs"),
    store: standIn("store.mjs"),
  };
}
