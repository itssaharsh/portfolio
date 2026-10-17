/**
 * What the server sends for a form of the desk, before any script has run in the browser. It
 * needs no browser, so the tests that run without one can draw a form too.
 *
 *   const first = drawn({ props: { post } });                                // the editor, as the page arrives
 *   drawn({ props: { post }, formState: answered(refusal, first) }).html;    // and as it comes back holding an answer
 *   drawn({ of: "delete-form", props: { id, opened } }).html;                // the form on the page that asks before deleting
 *
 * The drawing itself is draw.cjs, run as a process of its own. See there for why.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "desk-editor-"));
process.on("exit", () => rmSync(temp, { recursive: true, force: true }));
let drawings = 0;

/**
 * What the server sends for the editor, or for the form named in `of`: { html, action }.
 * @param {{ of?: "editor" | "delete-form", props?: object, formState?: unknown }} what formState is what a form posted without JavaScript came back with
 */
export function drawn(what = {}) {
  const file = join(temp, `draw-${++drawings}.json`);
  writeFileSync(file, JSON.stringify(what));
  const run = spawnSync(process.execPath, [join(HERE, "draw.cjs"), file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { PATH: process.env.PATH } });
  if (run.status !== 0) throw new Error(`the server's drawing of the ${what.of === "delete-form" ? "delete form" : "editor"} failed:\n${run.stderr}`);
  return JSON.parse(run.stdout);
}

/**
 * What Next hands the page when it draws it again after a form posted without JavaScript: the
 * answer, the key React gave this form (read off a first drawing), and the name of the action.
 */
export function answered(answer, first) {
  const key = first.html.match(/name="\$ACTION_KEY" value="([^"]+)"/)?.[1];
  if (!key) throw new Error("the form the server drew carries no key, so it could not be posted without JavaScript");
  return [answer, key, first.action, 0];
}
