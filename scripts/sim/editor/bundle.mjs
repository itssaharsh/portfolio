/**
 * One browser script holding the REAL app/admin/Editor.tsx, so the editor can be run in a
 * browser with no server behind it.
 *
 * Taken from the repo as they are: Editor.tsx and scripts/post-text.mjs, with TypeScript
 * stripped by TypeScript's own transpileModule, and the React that Next ships and runs in the
 * browser (node_modules/next/dist/compiled). Stood in for, because they need a running Next:
 * ./actions, whose savePost is whatever the test says it is, and next/navigation, whose router
 * writes down where it was sent. Nothing else.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = fileURLToPath(new URL("../../..", import.meta.url));
const require = createRequire(join(REPO, "package.json"));
const ts = require("typescript");
const NEXT = join(REPO, "node_modules/next/dist/compiled");

/** the file as the browser can run it. a name ending in .mjs is given as .js, or TypeScript leaves its exports alone. */
export const transpile = (path) =>
  ts.transpileModule(readFileSync(join(REPO, path), "utf8"), {
    fileName: path.replace(/\.mjs$/, ".js"),
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, allowJs: true },
  }).outputText;

const made = {};

/** @param {"production" | "development"} mode which build of React. the site runs the first, `next dev` the second. */
export function bundle(mode = "production") {
  if (made[mode]) return made[mode];
  const react = (file) => readFileSync(join(NEXT, file.replace("MODE", mode)), "utf8");
  const mods = {
    "react": react("react/cjs/react.MODE.js"),
    "react/jsx-runtime": react("react/cjs/react-jsx-runtime.MODE.js"),
    "react-dom": react("react-dom/cjs/react-dom.MODE.js"),
    "react-dom/client": react("react-dom/cjs/react-dom-client.MODE.js"),
    "scheduler": react("scheduler/cjs/scheduler.MODE.js"),
    // Next hands out one router for the life of the page, and so does this
    "next/navigation": `const router = { push(to) { (window.__pushed ||= []).push(to); } }; exports.useRouter = () => router;`,
    // savePost is given what the real one is given, the last answer and the form, and answers
    // what the test says. It has the shape Next's own call to the server has: a promise made
    // now, inside a transition, and settled by something else later.
    "./actions": `const React = require("react");
      exports.savePost = (prev, formData) => new Promise((resolve, reject) => {
        React.startTransition(() => { window.__savePost(prev, formData).then(resolve, reject); });
      });`,
    "@/scripts/post-text.mjs": transpile("scripts/post-text.mjs"),
    "editor": transpile("app/admin/Editor.tsx"),
    "harness": `
      const React = require("react");
      const { createRoot, hydrateRoot } = require("react-dom/client");
      const Editor = require("editor").default;
      // stands where Next's error page stands: when a save throws, the editor is gone from the screen
      class Boundary extends React.Component {
        constructor(props) { super(props); this.state = { gone: null }; }
        static getDerivedStateFromError(e) { return { gone: String((e && e.message) || e) }; }
        render() { return this.state.gone ? React.createElement("p", { id: "gone" }, this.state.gone) : this.props.children; }
      }
      const tree = (props, strict) => {
        const editor = React.createElement(Boundary, null, React.createElement(Editor, props || {}));
        return strict ? React.createElement(React.StrictMode, null, editor) : editor;
      };
      let root = null;
      // a page reached by a link inside the desk: nothing is on the screen until the script draws it
      window.mount = (props, strict) => { if (root) root.unmount(); root = createRoot(document.getElementById("root")); root.render(tree(props, strict)); };
      // a page that arrived already drawn by the server, woken the way Next wakes it
      window.hydrate = (props, formState, strict) => {
        root = hydrateRoot(document.getElementById("root"), tree(props, strict), { formState: formState ?? null, onRecoverableError(e) { (window.__mismatch ||= []).push(String((e && e.message) || e)); } });
      };
      // the same editor, handed something new by the page above it, as happens when a save went through
      window.redraw = (props) => root.render(tree(props, false));
      window.reactVersion = React.version;
    `,
  };
  const defs = Object.entries(mods)
    .map(([name, code]) => `${JSON.stringify(name)}: function (module, exports, require, process) {\n${code}\n}`)
    .join(",\n");
  return (made[mode] = `(function () {
  const defs = {\n${defs}\n};
  const loaded = {};
  const process = { env: { NODE_ENV: ${JSON.stringify(mode)} } };
  // Next's own copies of React ask for each other by their full names
  const also = { "next/dist/compiled/react": "react", "next/dist/compiled/react-dom": "react-dom", "next/dist/compiled/scheduler": "scheduler" };
  function require(name) {
    name = also[name] || name;
    if (loaded[name]) return loaded[name].exports;
    if (!defs[name]) throw new Error("the editor asked for " + name + ", and scripts/sim/editor/bundle.mjs has nothing to give it");
    const module = (loaded[name] = { exports: {} });
    defs[name](module, module.exports, require, process);
    return module.exports;
  }
  require("harness");
})();`);
}
