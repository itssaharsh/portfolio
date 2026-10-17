/**
 * What `./post` decides before it sends anything. No files, no network, no clock, so every
 * decision in here can be tested, and is, in post-plan.test.mjs.
 *
 * Two jobs: reading the flags, and working out what a post will and will not change on the site.
 * What a dry run says about the rules is worded here too, beside the rules it describes, so
 * that the sentences can be tested against them.
 */
import { autoSummary, likeness, sameTitle, slugify, version, SUMMARY_MAX } from "./post-text.mjs";

/* Every name here was checked against npm 10, 11 and 12. Versions 10 and 11 keep any flag typed
   before a double dash and hand these back through the environment untouched. They do NOT do
   that for a name they can stretch into one of npm's own settings: --replace became
   replace-registry-host and swallowed the flag after it, --local vanished, and --update would
   become update-notifier. Version 12 refuses to run at all when it meets a flag it does not
   know, which is the safe way to fail, and still hands on --dry-run, which it does know.
   --help is the exception on all three: npm answers it itself, so through npm it is
   npm run post -- --help. A new flag needs the same check before it is added:
   npm run env --newflag */
export const SWITCHES = ["draft", "publish", "same-post", "separate", "overwrite", "dry-run", "localhost", "help"];
export const VALUES = ["title", "tags", "summary", "slug", "site"];
const RENAMED = { replace: "overwrite", local: "localhost", update: "same-post" };
/** pairs that answer the same question two ways */
const EITHER = [["draft", "publish"], ["same-post", "separate"], ["same-post", "overwrite"], ["separate", "overwrite"]];
/** what --slug will not take as it stands: a slash, a colon, a space, or anything that only means something inside a whole address */
const AWKWARD = /[/:\s?#%]/;
/**
 * An address that can be printed bare for the writer to type after --slug: letters, digits,
 * dots, dashes and underscores, and not a dash first. Anything else is either refused by the
 * flag or read by a shell as its own. An ampersand ends the command there, a quote opens a
 * string, and a star is matched against the names of files.
 */
export const PLAIN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/**
 * The address of a post the way a browser shows it. --slug takes that form whatever the stored
 * address holds, and asks the site for exactly it, so this is what is printed for the writer
 * to type back when the last part alone would be refused.
 */
export const wholeAddress = (site, slug) => `${site}/blog/${encodeURIComponent(slug).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
export const DOUBLE_DASH = `Put a double dash before the flags:  npm run post notes.txt -- --draft\n  Or skip npm, which needs none:  ./post notes.txt --draft`;

const no = (message) => { throw new Error(message); };

/**
 * @param {string[]} argv what was typed after the command
 * @param {Record<string, string | undefined>} [env] the environment, where npm leaves the flags it kept
 * @returns {{ files: string[] } & Record<string, string | boolean>} throws an Error worded for the person
 */
export function readArgs(argv, env = {}) {
  const out = { files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // typed out of habit from the npm form. npm takes it away itself, so it only arrives here from ./post
    if (a === "--") continue;
    if (a === "-h") { out.help = true; continue; }
    if (!a.startsWith("--")) {
      if (a.length > 1 && a.startsWith("-")) no(`There is no ${a}. Flags are spelt out and start with two dashes. Try --help.`);
      out.files.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const flag = eq === -1 ? a : a.slice(0, eq);
    const inline = eq === -1 ? undefined : a.slice(eq + 1);
    const name = flag.slice(2);
    if (SWITCHES.includes(name)) {
      // --draft=false would otherwise switch it on, or off, depending on who is guessing
      if (inline !== undefined) no(`${flag} takes nothing after it. To not use it, leave it out.`);
      out[name] = true;
      continue;
    }
    if (RENAMED[name]) no(`There is no ${flag}. It is --${RENAMED[name]}.`);
    if (!VALUES.includes(name)) no(`There is no ${flag}. Try --help.`);
    const value = inline ?? argv[++i];
    // `--tags --dry-run` once meant a post tagged --dry-run, published for real
    if (value === undefined || (inline === undefined && value.startsWith("--"))) {
      no(`${flag} needs something after it${value ? `, and what came next was ${value.split("=")[0]}` : ""}.${value ? `\n  If it really does start with two dashes, write it as ${flag}=...` : ""}`);
    }
    // no tags at all is a real answer. no title is not.
    if (!value.trim() && name !== "tags") no(`${flag} needs something after it.`);
    out[name] = value;
  }

  /* `npm run post notes.txt --draft`, with the double dash forgotten, never reaches this file:
     npm keeps the flag for itself and passes only the file name. It does leave a trace in the
     environment, and without reading it a slip of the keyboard would publish a draft. Only the
     flags listed above can be read back this way. A misspelt one is gone for good, which is
     the reason the docs teach ./post. */
  const kept = (name) => env[`npm_config_${name.replace(/-/g, "_")}`];
  const hijacked = env.npm_config_replace_registry_host;
  if (hijacked === "true" || hijacked?.startsWith("--")) no(`npm took --replace for one of its own settings, and with it whatever flag came next.\n  The flag is --overwrite now. ${DOUBLE_DASH}`);
  for (const name of SWITCHES) if (kept(name) === "true") out[name] = true;
  for (const name of VALUES) {
    const v = kept(name);
    if (v === undefined || v === "" || out[name] !== undefined) continue;
    if (v === "true") no(`npm kept --${name} for itself and lost what came after it.\n  ${DOUBLE_DASH}`);
    out[name] = v;
  }

  for (const [a, b] of EITHER) if (out[a] && out[b]) no(`--${a} and --${b} cannot both be right. Pick one.`);

  // The command prints whole addresses, so a whole address pasted back has to work. Only the
  // flag is tidied this way. A slug: line in a file is kept as written, because a kept copy
  // carries a stored address on that line and it has to go back exactly.
  if (typeof out.slug === "string") {
    let slug = out.slug.trim();
    // An address copied out of a browser. What follows a question mark or a hash is not part
    // of it: left on, "#the-fix" once published a new post at an address nobody had typed.
    const whole = /^https?:\/\//i.test(slug) || /^\/?blog\//i.test(slug);
    if (whole) slug = slug.replace(/[?#].*$/, "");
    slug = slug.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/?blog\//i, "").replace(/^\/+|\/+$/g, "");
    // A browser writes a space as %20 and a slash as %2F. The last part is read back only once
    // it has been taken, so a slash that was written that way is not taken for one more part.
    if (whole && !slug.includes("/")) {
      try { slug = decodeURIComponent(slug); } catch { /* a percent sign that stands for no character is taken as typed */ }
      // An address typed at the old desk is stored as typed, and can hold a character the flag
      // refuses. Pasted whole, it is tidied to the form the site would have made, and what was
      // pasted is kept beside it so the site can be asked for exactly that first.
      if (AWKWARD.test(slug)) {
        out.pasted = slug;
        slug = slugify(slug);
      }
    }
    if (!slug || AWKWARD.test(slug)) no("--slug takes the last part of an address, like  --slug notes-on-the-cache");
    out.slug = slug;
  }
  return out;
}

const when = (d) => (d ? Date.parse(d) : null);
/** the desk stores the line endings a browser sends. they are not a change to the text. */
const plain = (s) => s.replace(/\r\n?/g, "\n");

/** which parts of the post on the site would come out different. an empty list means leave it alone. */
function whatChanges(existing, send) {
  return [
    existing.title !== send.title && "the title",
    plain(existing.body_md) !== plain(send.body_md) && "the text",
    "excerpt" in send && (existing.excerpt ?? "") !== send.excerpt.trim().slice(0, SUMMARY_MAX) && "the summary",
    "tags" in send && JSON.stringify(existing.tags ?? []) !== JSON.stringify(send.tags) && "the tags",
    "published" in send && existing.published !== send.published && "whether it is out",
    "published_at" in send && when(existing.published_at) !== when(send.published_at) && "the date",
    "cover_url" in send && (existing.cover_url ?? null) !== send.cover_url && "the cover",
  ].filter(Boolean);
}

/**
 * How the text in hand relates to a post: "same", "different" or "unsure".
 *
 * It is version() from post-text.mjs with one thing added. Under the same title, most of the
 * old text still being there is enough to call it the same post. Under a new title it is not:
 * a correction that quotes half of a post has that too, and so does a follow up that quotes a
 * short post whole. So with a new title it is the same post only when nearly all of each text
 * is in the other, which is what a fixed title and a few fixed typos look like.
 * A post with no text has nothing to lose, so anything is a version of it.
 * @param {{ title: string, body_md: string }} old the earlier of the two
 * @param {{ title: string, body_md: string }} next the later one
 * @returns {"same" | "different" | "unsure"}
 */
export function relate(old, next) {
  if (!old.body_md.trim()) return "same";
  const v = version(old.body_md, next.body_md);
  if (v !== "same" || sameTitle(old.title, next.title)) return v;
  const { ofPrev, ofNext } = likeness(old.body_md, next.body_md);
  return ofPrev >= 0.8 && ofNext >= 0.8 ? "same" : "unsure";
}

/**
 * Works out what to send. It updates a post when the file is plainly a version of it, makes a
 * new one when the file is plainly new, and in every case between it stops and asks, because
 * a wrong guess one way replaces a post and the other way publishes a second copy of one.
 * The person answers with a flag:
 *   --same-post   this is a new version of the post the question named. change it where it is.
 *   --separate    this is a new post. put it beside the one that looks like it.
 *   --overwrite   this is a different post. replace the one at the address with it.
 *
 * What counts as plain:
 *   The post at the address is changed when the text is plainly the same (see relate above),
 *   and for no other reason. Not because the title is the same: two weeks of "Weeknotes" share
 *   a title and a sign off. Not because this file made that post: the same file gets used for
 *   next week's. A text that only partly matches is asked about, whoever sends it.
 *   A post this file made before, now under another title, is changed only when the text is
 *   plainly the same. If the text has next to nothing in common with it, the file name was
 *   reused for something else, and the old post is left alone.
 *
 * The rest leans towards doing less:
 *   Anything the file and the flags do not mention is left as it is on the site.
 *   Whether a post that is already there is out or not is changed by --draft and --publish,
 *   with two exceptions, and each of them puts a different post at the address: --overwrite,
 *   and the undo of an overwrite. A `draft: yes` left in the file from the day it was first
 *   saved must not take a live post down weeks later.
 *   An overwrite is a new post. Nothing of the old one carries over, not its date, cover, tags
 *   or summary, and not whether it was out.
 *   A kept copy being put back never makes anything live by itself. One kept before an
 *   overwrite is the undo of it: it takes the place of whatever is at its address now, without
 *   asking, and goes back as a draft unless it was live then and the address is live now. The
 *   exception is when what is there is plainly the copy's own post, which it then changes as
 *   an older version of it. A copy kept before an update, or one from before copies said why
 *   they were kept, is an older version of a post. It is asked about in two cases: when what
 *   sits at its address now is another post altogether, and when the copy was of a draft and
 *   the page is live now, because then its text has never been out.
 *
 * @param {object} o
 * @param {ReturnType<typeof import("./post-text.mjs").textToPost>} o.post what the file turned into
 * @param {null | Site} o.atTarget what is at the address the file asks for, or its title makes
 * @param {null | Site} [o.made] the post at the address this file last posted to, if one is there
 * @param {boolean} [o.published] what the command line says about publishing. undefined when it says nothing.
 * @param {boolean} [o.samePost]
 * @param {boolean} [o.separate]
 * @param {boolean} [o.overwrite]
 * @param {boolean} [o.restoring] the file is a copy this command kept
 * @param {string} [o.site]
 * @returns {{ refuse: string } | { send: Record<string, unknown>, notes: string[], existing: null | Site, keep: boolean, why: "update" | "overwrite", wasLive: boolean, changes: string[], undo: string[], same?: true }}
 *   undo: the flags to type after the kept copy so that putting it back leaves the post as it was
 *
 * @typedef {{ slug: string, title: string, body_md: string, excerpt: string | null, tags: string[], published: boolean, published_at?: string | null, cover_url?: string | null }} Site
 */
export function plan({ post, atTarget, made = null, published: flag, samePost = false, separate = false, overwrite = false, restoring = false, site = "" }) {
  /** whether the file itself wants the post out. only a new post listens to this. */
  const fileSaysOut = !(post.given.draft && post.draft);
  const target = post.slug ?? slugify(post.title);
  const at = (p) => `${site}/blog/${p.slug}`;
  const notes = [];
  const send = { title: post.title, body_md: post.body_md };
  /** how this text stands to a post that was there first. asked more than once of the same post, so it is worked out once. */
  const stands = new Map();
  const standsTo = (old) => stands.get(old) ?? stands.set(old, relate(old, post)).get(old);
  if (post.date) send.published_at = post.date;
  if (post.given.cover) send.cover_url = post.cover || null;

  const create = () => {
    send.slug = target;
    send.published = flag ?? fileSaysOut;
    send.excerpt = post.excerpt;
    if (post.given.tags) send.tags = post.tags;
    if (separate) send.separate = true;
    return { send, notes, existing: null, keep: false, why: "update", wasLive: false, changes: [], undo: [] };
  };

  /**
   * What has to be typed after the kept copy for the put back to leave the post as it was
   * before this run. A kept copy never changes by itself whether a post is out, so where this
   * run changed that, the flag that changes it back goes with it. And where this run put
   * another title and wholly other text on a post without calling it an overwrite, which only
   * --same-post does, the copy would be asked about as another post altogether. So it needs
   * --overwrite, and --publish as well if the post was live, since that way round it goes
   * back as a draft.
   */
  const undo = (existing, why) => {
    const estranged = why === "update" && standsTo(existing) === "different" && !sameTitle(existing.title, post.title);
    const endsLive = "published" in send ? send.published : existing.published;
    const state = endsLive !== existing.published || (estranged && existing.published);
    return [estranged && "--overwrite", state && (existing.published ? "--publish" : "--draft")].filter(Boolean);
  };

  /** change a post where it is. nothing it has is reset, and only a flag changes whether it is out. */
  const update = (existing, { copy = false } = {}) => {
    send.slug = existing.slug;
    // the site asks for this before it lets a title change at an address
    if (existing.title.trim() !== post.title) send.replace = true;

    if (flag !== undefined) send.published = flag;
    else if (!existing.published) notes.push(`It is a draft on the site and stays one${copy && post.given.draft && !post.draft ? ", though the copy was of a live post" : ""}. --publish puts it out.`);
    // A copy of a draft gets this far against a live post with no flag only when the title and
    // the text on the page are already the copy's, since anything else is asked about first.
    // So no words of a draft go out here. It is still said, or the run would do nothing to
    // the page and say nothing about why.
    else if (post.given.draft && post.draft) notes.push(`${copy ? "The copy was of a draft" : "The file says draft: yes"}, but the post is live and stays live. --draft takes it off the site.`);

    // a copy that had no summary gets none back, rather than one cut from its opening
    if (copy) send.excerpt = post.given.summary ? post.excerpt : "";
    else if (post.given.summary) send.excerpt = post.excerpt;
    else if (!existing.excerpt || existing.excerpt === autoSummary(existing.body_md)) send.excerpt = post.excerpt;
    // All that is known is that it differs from what would be cut. It may have been written by
    // hand, or cut from an earlier text, so it is shown: a stale one is then seen.
    else notes.push(`The summary on the site is not the one this command would cut from the text there, so it is left as it is. --summary changes it. It reads: "${existing.excerpt}"`);
    if (post.given.tags) send.tags = post.tags;

    if (send.replace && !sameTitle(existing.title, post.title)) notes.push(`The title changed and the address did not. It is still /blog/${existing.slug}, so links to it keep working.`);

    const changes = whatChanges(existing, send);
    if (changes.length === 0) return { send, notes, existing, keep: false, why: "update", wasLive: existing.published, changes, undo: [], same: true };
    return { send, notes, existing, keep: true, why: "update", wasLive: existing.published, changes, undo: undo(existing, "update") };
  };

  /** put a different post where one is. it is a new post, and inherits nothing. */
  const replace = (existing, out) => {
    send.slug = existing.slug;
    send.replace = true;
    send.fresh = true;
    send.published = out;
    send.tags = post.tags;
    send.excerpt = restoring && !post.given.summary ? "" : post.excerpt;
    return { send, notes, existing, keep: true, why: "overwrite", wasLive: existing.published, changes: whatChanges(existing, send), undo: undo(existing, "overwrite") };
  };

  // ---- a copy this command kept, being put back ----
  if (restoring) {
    // a copy goes back where it came from, so there is nothing for these two to answer
    const answer = samePost ? "--same-post" : separate ? "--separate" : null;
    if (answer) return { refuse: `This file is a copy the command kept, and posting it puts that version back at its own address.\n  ${answer} does not go with that. Leave it off. --draft and --publish still work.` };
    const copyLive = post.given.draft && !post.draft;
    if (!atTarget) {
      // the post is gone. it comes back, and a copy never makes anything live by itself.
      const back = create();
      send.published = flag ?? false;
      if (!post.given.summary) send.excerpt = "";
      // putting a copy back is the undo, so the site is not to stop it for looking like another post
      send.separate = true;
      if (flag === undefined && copyLive) notes.push("The copy was of a live post. It is back as a draft. --publish puts it out.");
      return back;
    }
    // the copy is the earlier text, and what is at its address now is the later one
    const r = relate(post, atTarget);
    // Undoing an overwrite: the copy says it was kept before one, and what is there now is not
    // plainly the copy's own post. This has to mirror the rule that allowed the overwrite, or
    // the undo of a same title overwrite would be taken for an edit and leave a draft's text live.
    if (post.kept === "overwrite" && r !== "same") {
      // Live again only if it was live then and the address is live now. A draft is never left
      // live because the post that replaced it was, and nothing goes out without --publish.
      if (flag === undefined && copyLive && !atTarget.published) notes.push("The copy was of a live post. What is there now is a draft, so it goes back as a draft. --publish puts it out.");
      return replace(atTarget, flag ?? (copyLive && atTarget.published));
    }
    // An older version of one post, and another post altogether now sits at its address. Changing
    // that one in place would put this text on whatever page it is, live or not, so it is asked about.
    if (r === "different" && !sameTitle(atTarget.title, post.title)) {
      // said for the command as it was typed: --publish cannot be added to a command that has --draft
      const goesBack = flag === undefined ? "It goes back as a draft unless you also add --publish." : flag ? "With --publish it goes back live." : "With --draft it goes back as a draft.";
      if (!overwrite) return { refuse: `What is at ${at(atTarget)} now is "${atTarget.title}", a different post from the one this copy was taken of.\n  To replace it with this copy, add  --overwrite. ${goesBack}` };
      return replace(atTarget, flag ?? false);
    }
    // The copy was of a draft and the page is live. Changing it in place would put text on a
    // live page that was never out, and taking the page down would unpublish it. Which of the
    // two is right depends on whether this is still the same post, and the texts cannot always
    // say. So neither is done without being told.
    const differs = plain(atTarget.body_md) !== plain(post.body_md) || atTarget.title.trim() !== post.title;
    if (differs && post.given.draft && post.draft && atTarget.published && flag === undefined) {
      return { refuse: `This copy is of a draft, and what is at ${at(atTarget)} now is live.\n  To put the copy back and leave the page live, add  --publish\n  To put it back as a draft, add  --draft` };
    }
    return update(atTarget, { copy: true });
  }

  /**
   * How to put this one somewhere else. The site lets no second post in under a title that is
   * already there, whatever its address, and an address the file names itself is not moved by
   * a new title. So the answer depends on which of the two is in the way. The post this file
   * last made is on the site as well, so its title is in the way just the same.
   * @param {boolean} [beside] Say --separate too, because this text is partly that post's.
   *   Without it the site refuses a new post when one of the two texts holds most of the
   *   other, and under a new title the command asks again when this file made that post.
   *   --separate is the answer to both, and costs nothing where neither would have happened.
   */
  const elsewhere = (existing, beside = false) => {
    const titleTaken = [existing, made].some((p) => p && p.title.trim() === post.title);
    if (titleTaken && post.given.slug) return `give it its own title and its own address${beside ? ", and add  --separate" : ""}`;
    if (titleTaken) return `give it its own title${beside ? " and add  --separate" : ""}`;
    if (post.given.slug) return `give it its own address:  --slug some-other-words${beside ? " --separate" : ""}`;
    return beside ? "give it its own title and add  --separate, or add  --slug some-other-words --separate" : "give it its own title, or add  --slug some-other-words";
  };
  /** what to type after --slug to reach a post. an address typed at the old desk can hold a character the flag refuses or a shell takes for its own, and then it is given whole. */
  const typed = (p) => (PLAIN.test(p.slug) ? p.slug : wholeAddress(site, p.slug));

  // ---- the person said which it is ----
  if (separate) {
    if (atTarget) return { refuse: `--separate puts this beside what is already on the site, and "${atTarget.title}" already lives at ${at(atTarget)}.\n  For a second post, ${elsewhere(atTarget)}` };
    return create();
  }
  /** the post this file made before, when that is not simply what is at the address in question */
  const mine = !post.given.slug && made && made.slug !== atTarget?.slug ? made : null;
  const rTarget = atTarget ? standsTo(atTarget) : null;
  const rMine = mine ? standsTo(mine) : null;
  // It names the address and what is there now. That post may no longer be the one this file
  // made, if something else took the address since, so it is not called that.
  const there = mine ? `This file last posted to ${at(mine)}, which holds "${mine.title}"` : "";

  if (samePost) {
    // The answer goes to the post the question was about. A post at the address that is plainly
    // this text is never asked about, so it is that one. Otherwise the one question about the
    // post this file made before is asked when the text is partly the same as it, and when the
    // text has next to nothing in common with that post, the question was about the address.
    const it = rTarget === "same" ? atTarget : mine && (!atTarget || rMine !== "different") ? mine : atTarget;
    if (!it) return { refuse: `--same-post says this is a new version of a post that is already on the site, and ${target ? `nothing is at ${site}/blog/${target}` : "this title makes no address to look for one at"}.\n  Add  --slug  with the last part of that post's address, like  --slug notes-on-the-cache` };
    return update(it);
  }

  // ---- nobody said, so only what is plain is done ----
  // the post at the address is plainly this text: that settles it, whatever else this file once made
  if (rTarget === "same") {
    if (mine && rMine !== "same") notes.push(`${there}. From now on it points at this post instead.`);
    return update(atTarget);
  }
  if (rMine === "same") return update(mine);
  if (rMine === "unsure") {
    // As it stands, --separate is refused when something sits at the address the title makes,
    // and the site refuses it when the post this file last made carries the title. A title of
    // its own gets past both. A title that makes no address needs one to be given.
    const titleTaken = [atTarget, mine].some((p) => p && p.title.trim() === post.title);
    const apart = atTarget || titleTaken ? "give it its own title and add  --separate" : target ? "add  --separate" : "add  --slug some-other-words --separate";
    const lines = [
      `${there}, and this text is partly the same as that post and partly new.`,
      `If it is a new version of that post, ${overwrite ? "take --overwrite off and " : ""}add  --same-post`,
      `If it is a new post, ${overwrite ? `take --overwrite off${apart.startsWith("add") ? " and" : ","} ` : ""}${apart}`,
    ];
    // --overwrite cannot answer this one. It replaces what is at an address, and acting on it
    // here would replace a post the question never named. So it is said where it does reach.
    if (overwrite && atTarget) lines.push(`--overwrite replaces what is at an address, and this question is about another post. To replace "${atTarget.title}" at ${at(atTarget)} with this one, add  --slug ${typed(atTarget)} --overwrite`);
    else if (overwrite) lines.push(`--overwrite replaces what is at an address, and ${target ? `nothing is at ${site}/blog/${target}` : "this title makes none"}. To replace the post this file last posted to with this one, add  --slug ${typed(mine)} --overwrite`);
    return { refuse: lines.join("\n  ") };
  }
  /** said when the file name turns out to have been reused for something else */
  const reused = mine ? `${there}.` : null;

  if (!atTarget) {
    if (reused) notes.push(`${reused} This text shares next to nothing with that post, so it is a new post and that one was left alone.`);
    return create();
  }

  const r = rTarget;
  const titled = sameTitle(atTarget.title, post.title);
  if (overwrite) {
    if (reused) notes.push(`${reused} That one was left alone.`);
    return replace(atTarget, flag ?? fileSaysOut);
  }
  const partly = "this text is partly the same as it and partly new";
  const found = titled
    ? `A post called "${atTarget.title}" already lives at ${at(atTarget)}, and ${r === "different" ? "next to none of its text is in this file" : partly}.`
    : r === "different"
      ? `A different post, "${atTarget.title}", already lives at ${at(atTarget)}.`
      : `Another post, "${atTarget.title}", already lives at ${at(atTarget)}, and ${partly}.`;
  /** what --overwrite would make of it, said for the command as it was typed */
  const out = flag ?? fileSaysOut;
  return {
    refuse: `${found}\n  If this is ${titled ? "that post rewritten" : "a new version of that post"}, add  --same-post\n  If it is a different post, ${elsewhere(atTarget, r !== "different")}\n  To replace that post with this one, add  --overwrite. It goes up as a new post: ${out ? "published" : "saved as a draft"}, and dated ${post.date ? "as the file says" : out ? "today" : "the day it goes out"}.`,
  };
}

/** a long sentence broken into lines a terminal can show, at spaces only */
function wrapped(text, width = 92) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * What a dry run says the rules are, for the file and the flags in hand. The site is not
 * asked anything, so every line is an "if", and none may promise what plan() would refuse: no
 * new post under --same-post or from a title that makes no address, nothing changed where it
 * is under --separate, and no stopping to ask about the address once an answer was given.
 * A kept copy gets the rule for its own kind, read off its kept: and draft: lines.
 * @param {object} o
 * @param {ReturnType<typeof import("./post-text.mjs").textToPost>} o.post what the file turned into
 * @param {string} o.target the address the file asks for or its title makes. empty when the title makes none.
 * @param {string} [o.remembered] the address this file last posted to, when it names none itself
 * @param {boolean} [o.published] what the command line says about publishing. undefined when it says nothing.
 * @returns {string[]} lines to print one under the other. each rule starts a line of its own.
 */
export function dryRun({ post, target, remembered, site = "", restoring = false, published: flag, samePost = false, separate = false, overwrite = false }) {
  const lines = [];
  const say = (rule) => lines.push(...wrapped(rule));

  if (restoring) {
    const answer = samePost ? "--same-post" : separate ? "--separate" : null;
    const copyLive = post.given.draft && !post.draft;
    /** said only where no flag settles it */
    const asItIs = flag === undefined ? ", and stays a draft or stays live as it is." : ".";
    /** the one thing an older version is asked about that is not another post: a draft's words going onto a live page */
    const draftOnLive = post.given.draft && post.draft && flag === undefined;
    say(`This file is a copy the command kept. Posting it puts that version back at ${site}/blog/${target}.`);
    if (answer) say(`${answer} does not go with a kept copy, so the command would stop. Leave it off.`);
    say(flag === undefined ? "It never makes a post live by itself." : flag ? "With --publish it goes back live." : "With --draft it goes back as a draft, and a live page there comes off the site.");
    if (post.kept === "overwrite") {
      const comesBack = flag !== undefined ? "" : copyLive ? " It goes back live if the page there is live now, and as a draft if it is not." : " It goes back as a draft.";
      say(`It was kept before an overwrite, so it is the undo of that one: it takes the place of whatever is at that address now, without asking.${comesBack}`);
      // only then can it be asked anything: everything else at the address it replaces, as a draft
      say(`If what is there is plainly this copy's own post, it is changed as an older version of it instead${asItIs}${draftOnLive ? " The copy is of a draft, so if that post is live and the copy would change its title or its text, the command stops and asks for --publish or --draft." : ""}`);
    } else {
      say(`It goes back as an older version of the post at that address: the post is changed where it is${asItIs}`);
      // said of that post, and before the line about any other post, because over another post
      // altogether this question is never the one that is asked
      if (draftOnLive) say("This copy is of a draft. If that post is live now and the copy would change its title or its text, the command stops and asks for --publish or --draft.");
      if (!overwrite) say("If what sits at that address now is another post altogether, the command stops and asks for --overwrite instead.");
      else say(`With --overwrite, another post altogether at that address is replaced by this copy instead${flag === undefined ? ", which goes back as a draft unless --publish is added." : "."}`);
    }
    say(`If nothing is at that address any more, the post comes back ${flag ? "live" : "as a draft"}.`);
    return lines;
  }

  /** what the file and the flags make of a new post, and of one put in another's place */
  const out = flag ?? !(post.given.draft && post.draft);
  const asNew = out ? "and it is published" : "saved as a draft";
  /** whether a post that is changed where it is ends up out: as a sentence, and as the end of one */
  const state = flag === undefined ? "It stays a draft or stays live unless --draft or --publish says otherwise. A draft: line in the file does not count then."
    : flag ? "--publish puts it out if it is a draft." : "--draft makes it a draft, so a live post comes off the site.";
  const andState = `, and ${flag === undefined ? `it${state.slice(2)}` : state}`;

  if (!target) {
    // a title with nothing to make an address from can still go to the post this file made before, and nowhere else
    say(`The title makes no address, so it can only go to the post this file last posted to, /blog/${remembered}.`);
    if (separate) say("With --separate it has to be a new post, and a new post needs an address. Pass --slug with one.");
    else if (samePost) {
      say(`With --same-post that post is changed where it is${andState}`);
      say("If that post is gone, the command stops.");
    } else {
      say(`If this text is plainly a new version of that post, it is changed where it is${andState}`);
      say("If it is only partly the same, the command stops and asks.");
      say("If it shares next to nothing with that post, or that post is gone, the command stops as well: a new post needs an address. Pass --slug with one.");
      if (overwrite) say("--overwrite replaces what is at an address, and this title makes none, so it changes nothing here.");
    }
    return lines;
  }

  /** the post this file made before only comes into it when that is not the address in hand, and --separate looks at neither */
  const elsewhere = remembered && remembered !== target;
  // The address is the one a new post would get. A post typed at the old desk can be stored
  // under another spelling of it, Go Notes for go-notes, and the site finds that post for
  // this address and leaves its spelling alone. Only --separate never goes to a post that is
  // already there, so only then is the one address the whole of it.
  say(`It would go to ${site}/blog/${slugify(target) || target}${separate ? "." : ", or to a post the site already holds under another spelling of that address, which keeps the spelling it has."}`);
  if (separate) {
    say(`With --separate it goes up as a new post there, ${asNew}.`);
    say("If a post is already at that address, the command stops and says what a second post needs: its own title, its own address, or both.");
  } else if (samePost) {
    say("With --same-post it changes the post at that address, where it is, and never makes a new one.");
    say(state);
    if (elsewhere) say(`This file last posted to /blog/${remembered}. That post is the one changed instead when nothing is at the address above, or when this text is at least partly that post's and the post at the address above is not plainly this text.`);
    say(elsewhere ? "If neither post is there, the command stops." : "If nothing is there, the command stops.");
  } else {
    say(`If nothing is there, it is a new post, ${asNew}.`);
    say(`If the same post is there, it is changed where it is${andState}`);
    if (!overwrite) say("If another post is there, or the command cannot tell whether it is the same one, it stops and asks.");
    else say(`With --overwrite, any other post at that address is replaced by this one as a new post: ${out ? "published" : "saved as a draft"}, and dated ${post.date ? "as the file says" : out ? "today" : "the day it goes out"}.`);
    if (elsewhere) say(`This file last posted to /blog/${remembered}. Unless the post at the address above is plainly this text, that one comes first: if this text is plainly a new version of it, it is the one changed, and if it is only partly the same, the command stops and asks.${overwrite ? " --overwrite does not answer that question." : ""}`);
  }
  return lines;
}
