// node draw.cjs <file.json>      the file holds { of, props, formState }
//
// What the server sends for the editor, before any script has run in the browser: the REAL
// app/admin/Editor.tsx, drawn by the react-dom/server that Next ships. savePost is what Next's
// build makes of it in the server's drawing of a client component, a reference to a Server
// Action, which is why the form it draws can be posted with JavaScript switched off.
//
// With of: "delete-form" it draws the other form of the desk that holds an answer, the real
// app/admin/delete/[id]/DeleteForm.tsx, the same way.
//
// It runs as a process of its own (see drawn() in browser.mjs) because Next's copies of React
// ask for each other by the plain names "react" and "react-dom", and pointing those names at
// Next's copies must not leak into the process that runs the tests.
const Module = require("module");
const path = require("path");
const fs = require("fs");

const REPO = path.join(__dirname, "..", "..", "..");
const NEXT = path.join(REPO, "node_modules/next/dist/compiled");
process.env.NODE_ENV = "production";

const theirs = {
  "react": path.join(NEXT, "react/index.js"),
  "react/jsx-runtime": path.join(NEXT, "react/jsx-runtime.js"),
  "react-dom": path.join(NEXT, "react-dom/index.js"),
  "scheduler": path.join(NEXT, "scheduler/index.js"),
};
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) { return theirs[request] ?? resolve.call(this, request, ...rest); };

const React = require("react");
const { renderToPipeableStream } = require(path.join(NEXT, "react-dom/server.node.js"));
const { createServerReference } = require(path.join(NEXT, "react-server-dom-turbopack/client.node.js"));
const ts = require(path.join(REPO, "node_modules/typescript"));

/** the name Next's build would give the action. any name does: it only has to be the same on the form and in the answer. */
const ACTION = "60d0e5c0ffee00000000000000000000000000de5c";

const transpile = (file) =>
  ts.transpileModule(fs.readFileSync(path.join(REPO, file), "utf8"), {
    fileName: file.replace(/\.mjs$/, ".js"),
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, allowJs: true },
  }).outputText;
function load(file, given) {
  const module = { exports: {} };
  new Function("module", "exports", "require", transpile(file))(module, module.exports, (name) => (name in given ? given[name] : require(name)));
  return module.exports;
}
/** what can be drawn, each with the action its form posts to stood in for by a reference to it */
const FORMS = {
  "editor": () => load("app/admin/Editor.tsx", {
    "./actions": { savePost: createServerReference(ACTION) },
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "@/scripts/post-text.mjs": load("scripts/post-text.mjs", {}),
  }).default,
  "delete-form": () => load("app/admin/delete/[id]/DeleteForm.tsx", {
    "../../actions": { deletePost: createServerReference(ACTION) },
  }).default,
};

const { of = "editor", props, formState } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const Form = FORMS[of]();
const { Writable } = require("stream");
let html = "";
const sink = new Writable({ write(chunk, _encoding, done) { html += chunk.toString(); done(); } });
sink.on("finish", () => process.stdout.write(JSON.stringify({ html, action: ACTION })));
const stream = renderToPipeableStream(React.createElement(Form, props || {}), {
  formState: formState ?? null,
  onAllReady() { stream.pipe(sink); },
  onError(e) { console.error(e); process.exitCode = 1; },
});
