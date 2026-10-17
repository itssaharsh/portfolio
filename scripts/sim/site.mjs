/**
 * A whole site in a temp folder, for testing the post command end to end without a server, a
 * network or the real database.
 *
 *   const site = newSite();
 *   site.write("notes.txt", "A title\n\nSome text.\n");
 *   const run = site.post("notes.txt", "--draft");   // { code, out, sent }
 *   site.posts();                                     // what the site holds now
 *
 * The command that runs is a byte copy of scripts/post.mjs and its two modules, put in a root
 * of its own, because the command finds its .env.local, its .post-backups and the address of
 * the site next to itself. The copy therefore cannot see the real ones. Its requests are
 * answered in the same process by the real route (see build.mjs and preload.mjs), and the
 * posts live in a JSON file.
 *
 * It exists because the first way this command was tested was against the real database, and
 * one test post went out on the live blog.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const HERE = fileURLToPath(new URL(".", import.meta.url));
export const ORIGIN = "http://site.invalid";

/** every folder made here is swept when the process ends, unless someone asks to look at it afterwards */
const made = [];
let sweep = true;
// The real path of each folder, whole, with no link left in it. The command reads where it is
// and where it was run from that way, so a folder spelt through a link, as the temp folder on
// a Mac is, would have this file and the command call one file by two names. It also makes
// the path whole where TMPDIR was given from where the tests were started.
const temp = (prefix) => { const d = realpathSync(mkdtempSync(join(tmpdir(), prefix))); made.push(d); return d; };
process.on("exit", () => { if (sweep) for (const d of made) rmSync(d, { recursive: true, force: true }); });
/** leave the folders behind, to look at what a failed run left */
export const keepFolders = () => { sweep = false; };

let builtOnce;
/** the server code is converted once for each process that asks */
const built = () => (builtOnce ??= build(temp("post-sim-built-")));

export function newSite() {
  const dir = temp("post-sim-");
  const root = join(dir, "root");
  const work = join(dir, "work");
  const keep = join(root, ".post-backups");
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "content"));
  mkdirSync(work);
  for (const f of ["post.mjs", "post-plan.mjs", "post-text.mjs"]) copyFileSync(join(REPO, "scripts", f), join(root, "scripts", f));
  writeFileSync(join(root, "content", "data.ts"), `export const SITE_URL = "${ORIGIN}";\n`);
  const state = join(dir, "state.json");
  const wire = join(dir, "wire.jsonl");
  writeFileSync(state, '{"posts":[]}');

  const code = built();
  // nothing is inherited from the real environment except where to find node
  const env = {
    PATH: process.env.PATH, HOME: dir, TZ: "UTC",
    ADMIN_PASSWORD: "sim-only-password", SESSION_SECRET: "sim-only-secret-used-nowhere-else",
    SIM_STATE: state, SIM_WIRE: wire, SIM_ROUTE: code.route, SIM_AUTH: code.auth, SIM_ACTIONS: code.actions,
  };
  const load = () => JSON.parse(readFileSync(state, "utf8"));

  return {
    dir, work, keep,
    /** put a text file where the command will be run from */
    write(name, text) { writeFileSync(join(work, name), text); },
    read(name) { return readFileSync(join(work, name), "utf8"); },
    /** run the command. `sent` is every request it made, in order. */
    post(...args) {
      writeFileSync(wire, "");
      const r = spawnSync(process.execPath, ["--import", join(HERE, "preload.mjs"), join(root, "scripts", "post.mjs"), ...args], { cwd: work, env, encoding: "utf8" });
      const sent = readFileSync(wire, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
      return { code: r.status, out: r.stdout + r.stderr, sent };
    },
    /** save a post at the writing desk, through the real savePost */
    desk(fields) {
      const r = spawnSync(process.execPath, [join(HERE, "desk.mjs"), JSON.stringify(fields)], { env, encoding: "utf8" });
      return { code: r.status, out: r.stdout + r.stderr };
    },
    /** everything on the site, drafts included */
    posts() { return load().posts; },
    at(slug) { return load().posts.find((p) => p.slug === slug); },
    /** put a row straight in, for a state the code can no longer produce, such as CR LF line endings from the old desk */
    put(row) {
      const s = load();
      const now = new Date().toISOString();
      s.posts = s.posts.filter((p) => p.slug !== row.slug);
      s.posts.push({ id: `put-${s.posts.length + 1}-${row.slug}`, excerpt: null, body_text: "", cover_url: null, tags: [], published: false, reading_time: 1, created_at: now, updated_at: now, published_at: null, ...row });
      writeFileSync(state, JSON.stringify(s, null, 2));
    },
    remove(slug) {
      const s = load();
      s.posts = s.posts.filter((p) => p.slug !== slug);
      writeFileSync(state, JSON.stringify(s, null, 2));
    },
    /** the copies the command has kept, oldest first, as paths the command can be given */
    kept() {
      if (!existsSync(keep)) return [];
      // by when they were written. two kept in one second differ only by a suffix, which does not sort by name.
      const when = (f) => statSync(join(keep, f)).mtimeMs;
      return readdirSync(keep).filter((f) => f.endsWith(".txt")).sort((a, b) => when(a) - when(b) || a.length - b.length).map((f) => join("..", "root", ".post-backups", f));
    },
    keptText(path) { return readFileSync(join(work, path), "utf8"); },
  };
}

// ---- reading what the command printed ----
// The random tester and the flow tests read a refusal with these two, so that an answer is
// typed only where the command offered one.

/**
 * The lines a refused run ended on: its last paragraph. A refusal printed with nothing above
 * it starts on an empty line, and that is not one of its lines.
 */
export const refusalOf = (out) => out.trimEnd().split(/\n\s*\n/).at(-1).split("\n").map((l) => l.trim()).filter(Boolean);
/**
 * The ways out a refusal offers, read off the lines under its first the way a person would.
 * What is to be typed is set off by two spaces, after "add" or after "its own address:". A
 * line can offer two ways with ", or " between them, and can ask for a title or an address of
 * its own as well, which it only ever does with the words "give it its own". Without them
 * the same words say where a kept copy goes back to, and offer nothing.
 * scripts/post-plan.grid.test.mjs reads what plan() says the same way, in a copy of its own,
 * so that it needs nothing from this folder. Keep the two alike.
 * @param {string[]} lines
 * @returns {{ said: string, flags: string[], dropOverwrite: boolean, ownTitle: boolean, ownAddress: boolean }[]}
 */
export function waysOut(lines) {
  const out = [];
  for (const line of lines.slice(1)) {
    for (const part of line.split(", or ")) {
      const add = part.match(/(?:add|address:) {2}((?:--slug \S+|--[a-z-]+)(?: (?:--slug \S+|--[a-z-]+))*)/);
      const way = { said: part, flags: add ? add[1].split(" ") : [], dropOverwrite: /take --overwrite off/.test(part), ownTitle: /give it its own title/.test(part), ownAddress: /give it its own (?:title and its own )?address/.test(part) };
      if (way.flags.length || way.ownTitle || way.ownAddress) out.push(way);
    }
  }
  return out;
}
