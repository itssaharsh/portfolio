/**
 * Plain text in, a post out. No dependencies, so it runs anywhere Node does and the tests
 * beside it need nothing installed.
 *
 * The rules, in the order they are applied:
 *   The first line is the title. One that is itself a setting, like  draft: yes , stops the
 *   post: the file has no title line, and that line would be published as the title. So does
 *   one that is only shaped like a setting, like  summary: ... , when settings sit straight
 *   under it. Written as  title: draft: yes  it is a title all the same.
 *   Lines under it may say  tags: a, b   summary: ...   slug: some-words   draft: yes
 *   and, less often,  date: 2026-08-28  for the day it went out and  cover: https://...  for
 *   a picture above the text. They may also sit under a blank line, when the block there
 *   opens with one. A block that opens with a summary line and no other setting is a
 *   paragraph: "Summary: we shipped it." is a fair way to start a post.
 *   A setting line may be indented by up to three spaces. Four spaces or a tab is code, with
 *   the exceptions given further down.
 *   A line that starts like one of those but cannot be read stops the post with an error when
 *   real settings sit beside it, or when it is a draft or a date gone wrong. A draft line of
 *   three words or fewer that is not a yes or a no has gone wrong: nobody opens a post that
 *   way. Guessing would publish a draft with its settings as the opening.
 *   Settings sit together, in one place. A setting line left under a line that is not one, or
 *   in a second block under the first, stops the post as well, because the reader stops at the
 *   first line that is not a setting and the rest would be published as text. The block the
 *   reader stopped in and the one after it are held to this. So is each block after those for
 *   as long as the one above it holds a line shaped like a setting, because a summary that
 *   stands alone is read as a paragraph, and a draft line under it would go out with it.
 *   Further down, a line like that is the writer's own business. A copy the command kept is
 *   not held to it at all: its text goes back exactly, whatever it opens with.
 *   Blank lines separate paragraphs. Lines inside a paragraph are left as they are, so text
 *   wrapped at a fixed width stays one paragraph. Where a paragraph is a set of lines too long
 *   to have been wrapped by hand, each line is its own. Where a file has no blank lines at all,
 *   each line is its own unless the lines look like one paragraph wrapped at a fixed width.
 *   A short line standing alone is a heading when it starts with a capital or a digit and does
 *   not end in a full stop, comma, colon, semicolon, question mark, exclamation mark or
 *   ellipsis. It is deliberately hard to qualify: not the first or last thing in the post, not
 *   next to another short line, nothing in brackets, no columns of numbers. A missed heading
 *   costs two typed characters to put back. A wrong one changes what the writer said.
 *   A file in which every paragraph is indented was typed like a letter, and loses the indents.
 *   So does the first line of a paragraph when no other line of it is indented, which is how
 *   a book sets one. A setting line indented in either way is not code. It would lose its
 *   indent and be published as text. Nor is one that stands under a line of text: markdown
 *   shows it as part of that paragraph. And one that stands straight under the title or the
 *   settings, with no blank line between, is where settings go: indented there it may be a
 *   setting that slipped in by the tab key as easily as a sample of code, and taken for code
 *   it once sent a draft out. So a file is looked at once more without those indents, as far
 *   down as before. A line that was meant as a setting stops the post, and so does one that
 *   would have been read as a setting where it stands. For the last kind the error gives both
 *   ways out: take the indent off, or put a blank line above the sample.
 *   Otherwise indented text is code, as markdown says, and a file that says  format: markdown
 *   has said what its indents are.
 *   Anything already written as markdown is left exactly as it is, code blocks included, with
 *   one exception: a short line that is only bold is read as a heading too.
 *   A file that says  format: markdown  under its title is not reshaped at all. That is how
 *   the copy kept of a replaced post goes back exactly as it was.
 *   With a title passed in, the whole file is the post. A file that has setting lines of its
 *   own, anywhere in its first two blocks or in a block held to the rule above, is refused
 *   then, because they would be published as text and a draft would go out. There too the
 *   file is looked at once more without the indents that do not make a line code.
 */

const FENCE = /^\s*(`{3,}|~{3,})/;
const INDENTED = /^( {4}|\t)/;
const RULE = /^\s*(-{3,}|={3,})\s*$/;
/** a list item, a quote, a table row or indented code: lines that belong with their neighbours */
const GROUPED = /^(\s*([-*+]\s|\d+[.)]\s|>|\|)| {4}|\t|.*\S\s\|\s\S)/;
/** every paragraph indented: typed like a letter. markdown would show the whole post as code. */
const typedLikeALetter = (blocks) => { const plain = blocks.filter((b) => !FENCE.test(b[0])); return plain.length > 0 && plain.every((b) => INDENTED.test(b[0])); };
/** a book style paragraph: only its first line is indented, so it cannot be code */
const setLikeABook = (block) => block.length > 1 && INDENTED.test(block[0]) && block.slice(1).every((l) => !INDENTED.test(l));
/** a line without its indent */
const flushLeft = (line) => line.replace(/^[ \t]+/, "");
/** a block that is already markdown or html, so it must not be read as prose */
const MARKED = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||`{3,}|~{3,}|!\[|<|={3,}$|-{3,}$)/;
const ENDS_A_SENTENCE = /[.!?…]["'”’)\]]*$/;

/** the same rule as slugify in lib/posts.ts, so the command can tell which address a title will get */
export const slugify = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");

/** how much of a summary is kept. the command, /api/posts and the writing desk all cut here. */
export const SUMMARY_MAX = 1000;

/**
 * What a cover may be: an http or https address, or a path on this site. The command, the site
 * and the box at the writing desk all ask this one function, so none can store what another
 * would refuse.
 * @param {string} v
 */
export function coverFits(v) {
  if (v.length > 2000 || /\s/.test(v)) return false;
  // one slash and then not another, or a backslash: two would be a different site
  if (/^\/(?![/\\])/.test(v)) return true;
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

/**
 * What a list of tags is stored as: trimmed, no blanks, no repeats, eight at most. The command,
 * /api/posts and the writing desk all call this, so none of them can store what another would change.
 * @param {string[]} tags
 */
export const tidyTags = (tags) => [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 8);

const stripMd = (s) =>
  s
    .replace(/!\[[^\]]{0,500}\]\([^)]{0,2000}\)/g, "")
    .replace(/\[([^\]]{0,500})\]\([^)]{0,2000}\)/g, "$1")
    .replace(/`([^`\n]*)`/g, "$1")
    // only where they open or close a word. to_tsvector and BLOG_STORE keep their underscores.
    .replace(/(^|[\s(\["'“‘])(\*\*|__|\*|_|~~)(?=\S)/gm, "$1")
    .replace(/(?<=\S)(\*\*|__|\*|_|~~)(?=$|[\s.,;:!?)\]"'”’])/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(\d+)\\\./gm, "$1.");

const withoutCode = (md) => md.replace(/(`{3,}|~{3,})[\s\S]*?\1/g, " ").replace(/`[^`\n]*`/g, " ");

/**
 * Word for word what toPlainText in lib/posts.ts does, so the count printed here is the count
 * on the page. The label and the address of a link are bounded in both, because without a
 * bound a long run of open brackets takes minutes to get through.
 */
const sitePlain = (md) =>
  md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]{0,500}\]\([^)]{0,2000}\)/g, " ")
    .replace(/\[([^\]]{0,500})\]\([^)]{0,2000}\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** scripts that are written without spaces. a whole clause would otherwise count as one word. */
const UNSPACED = "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Thai}\\p{Script=Lao}\\p{Script=Khmer}\\p{Script=Myanmar}";
const LETTER = `(?:(?![${UNSPACED}])[\\p{L}\\p{N}])`;
const WORD = new RegExp(`[${UNSPACED}]|${LETTER}+(?:['’]${LETTER}+)*`, "gu");
/** the words of a text, with markup, punctuation, case and line endings out of the way */
const wordsOf = (md) => md.toLowerCase().match(WORD) ?? [];
/** every run of three words in a row. two texts that share many of these share actual sentences. */
function runsOf(md) {
  const w = wordsOf(md);
  const out = new Set();
  for (let i = 0; i + 3 <= w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  if (!out.size && w.length) out.add(w.join(" "));
  return out;
}
/**
 * How much two texts have in common, counted in runs of three words, so a fixed typo costs
 * three runs and not a whole paragraph, and a line ending or a dash costs nothing.
 * @returns {{ shared: number, ofPrev: number, ofNext: number }} the two shares run from 0 to 1
 */
export function likeness(prev_md, next_md) {
  const a = runsOf(prev_md);
  const b = runsOf(next_md);
  let shared = 0;
  for (const r of a) if (b.has(r)) shared++;
  return { shared, ofPrev: a.size ? shared / a.size : 0, ofNext: b.size ? shared / b.size : 0 };
}
/** enough shared text to mean something. a sign off that two short posts share falls under it. */
const ENOUGH = 25;
/**
 * Is `next` a later version of `prev`? Three answers, because a wrong yes replaces a post and
 * a wrong no publishes a second copy of one, and the command can always ask instead.
 *   "same"       the same words, or most of the old text is still there
 *   "different"  next to nothing in common, either way round
 *   "unsure"     anything else. the command stops and asks.
 * An old text with no words in it has nothing to lose, so anything is a version of it.
 * @returns {"same" | "different" | "unsure"}
 */
export function version(prev_md, next_md) {
  if (!wordsOf(prev_md).length) return "same";
  const { shared, ofPrev, ofNext } = likeness(prev_md, next_md);
  if (ofPrev === 1 && ofNext === 1) return "same";
  if (ofPrev >= 0.5 && shared >= ENOUGH) return "same";
  if (ofPrev < 0.1 && ofNext < 0.1) return "different";
  return "unsure";
}
/**
 * Does one of two texts hold most of the other? This is what the site asks, in
 * app/api/posts/route.ts, before it lets a new post in: a corrected copy sent under a new
 * title, or a cut down one, is most likely the same post arriving twice. It only ever leads
 * to a question, so it leans towards yes.
 */
export function secondCopy(a_md, b_md) {
  const { shared, ofPrev, ofNext } = likeness(a_md, b_md);
  if (!shared) return false;
  return (ofPrev === 1 && ofNext === 1) || (Math.max(ofPrev, ofNext) >= 0.5 && shared >= ENOUGH);
}
/** two titles that would make the same address are the same title: a capital or a comma is not a new post */
export const sameTitle = (a, b) => a.trim() === b.trim() || (slugify(a) !== "" && slugify(a) === slugify(b));

/** long enough that no editor wrapped it, not counting a long address sitting inside it */
const isLongProse = (l) => l.length > 120 && l.split(/\s+/).filter((w) => w.length <= 40).join(" ").length > 100;

/** true when the lines look like one editor wrapped them all at the same width */
function wrappedByHand(lines) {
  if (lines.length < 3) return false;
  const max = Math.max(...lines.map((l) => l.length));
  if (max > 100) return false;
  return lines.filter((l) => l.length >= max - 25).length / lines.length >= 0.6;
}

/** blocks are separated by blank lines. a fenced block is one block whatever is inside it. */
function splitBlocks(lines) {
  const blocks = [];
  let cur = [];
  let fence = null;
  const flush = () => { if (cur.length) { blocks.push(cur); cur = []; } };
  for (const line of lines) {
    const f = line.match(FENCE);
    if (fence) {
      cur.push(line);
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) { fence = null; flush(); }
      continue;
    }
    if (f) { flush(); fence = f[1]; cur.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    cur.push(line);
  }
  flush();
  return blocks;
}

/** the text of a heading, or null. see the rules at the top for why it says no so often. */
function headingCandidate(block) {
  if (block.includes("\n") || INDENTED.test(block)) return null;
  let t = block.trim();
  const bold = t.match(/^(\*\*|__)(.+)\1$/);
  if (bold) t = bold[2].trim();
  else if (MARKED.test(t)) return null;
  if (t.length > 60 || t.split(/\s+/).length > 8) return null;
  if (!/^[A-Z0-9\u00C0-\u00DE]/.test(t) || t.includes("://")) return null;
  if (/[.,;:!?…]["'”’)\]]*$/.test(t)) return null;
  if (/[()[\]{}|/\\=<>]|\s{2,}|\t/.test(t)) return null;
  return t;
}

/** decides whether the lines of one block are one paragraph or several */
function shapeBlock(block, onlyBlock) {
  if (FENCE.test(block[0])) return [block.join("\n")];

  // A row of dashes or equals signs straight under text. Markdown would turn everything above
  // it into a heading, which is only what the writer meant when it sits under one short line.
  const at = block.findIndex((l, i) => i > 0 && RULE.test(l));
  if (at > 0) {
    const above = block.slice(0, at);
    const below = block.slice(at + 1);
    const heading = above.length === 1 ? headingCandidate(above[0]) : null;
    return [
      ...(heading ? [`## ${heading}`] : shapeBlock(above, false)),
      ...(heading || block[at].includes("=") ? [] : ["---"]),
      ...(below.length ? shapeBlock(below, false) : []),
    ];
  }

  if (setLikeABook(block)) block = [flushLeft(block[0]), ...block.slice(1)];

  if (block.length === 1 || block.every((l) => GROUPED.test(l))) return [block.join("\n")];

  const prose = block.filter((l) => !GROUPED.test(l)).map((l) => l.trimEnd());
  const finished = prose.filter((l) => ENDS_A_SENTENCE.test(l)).length / Math.max(1, prose.length);
  // a line that stops mid sentence at about the width of a line: the mark of a wrapped paragraph
  const wraps = prose.slice(0, -1).some((l) => !ENDS_A_SENTENCE.test(l) && l.length >= 50);
  const everyLine = onlyBlock
    // no blank lines anywhere in the file: either one wrapped paragraph, or a line per thought
    ? finished >= 0.6 || (!wrappedByHand(prose) && !wraps)
    // a paragraph per line, with the odd blank line thrown in
    : prose.some(isLongProse) && !wraps;
  if (!everyLine) return [block.join("\n")];

  const out = [];
  let cur = [];
  for (const line of block) {
    if (cur.length && !(GROUPED.test(line) && GROUPED.test(cur[cur.length - 1]))) { out.push(cur.join("\n")); cur = []; }
    cur.push(line);
  }
  if (cur.length) out.push(cur.join("\n"));
  return out;
}

function makeExcerpt(blocks) {
  const first = blocks.find((b) => !MARKED.test(b.trim()) && !INDENTED.test(b));
  if (!first) return "";
  const plain = stripMd(first).replace(/\s+/g, " ").trim();
  if (plain.length <= 200) return plain;
  let end = -1;
  for (const m of plain.slice(0, 201).matchAll(/[.!?]["'”’)]*(?=\s)/g)) {
    const before = plain.slice(0, m.index);
    // "e.g." and "Dr." end a word, not a sentence
    if (m[0][0] === "." && /(?:\b(?:e\.g|i\.e|etc|vs|cf|approx|Mr|Mrs|Ms|Dr|No|Fig)|\b[A-Za-z])$/.test(before)) continue;
    if (m.index + m[0].length <= 200) end = m.index + m[0].length;
  }
  if (end >= 60) return plain.slice(0, end);
  const cut = plain.slice(0, 200);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
}

/** the summary this file would give a post, worked out again from the markdown the site stores */
export const autoSummary = (body_md) => makeExcerpt(splitBlocks(body_md.split("\n")).map((b) => b.join("\n")));

const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function findWarnings(title, body, words) {
  const prose = `${title}\n${withoutCode(body)}`;
  const out = [];
  const dashes = (prose.match(/[—–]/g) ?? []).length;
  const hyphens = (prose.match(/\S - \S/g) ?? []).length;
  const doubles = (prose.match(/\s--\s|[A-Za-z]--[A-Za-z]/g) ?? []).length;
  const found = [
    dashes && plural(dashes, "em or en dash", "em or en dashes"),
    hyphens && `${plural(hyphens, "hyphen")} used as a dash`,
    doubles && `${plural(doubles, "place")} where two hyphens stand in for a dash`,
  ].filter(Boolean);
  // the rule is said on the first of these, whichever it is, so none of them points at nothing
  found.forEach((f, i) => out.push(`${f}. ${i === 0 ? "The site keeps dashes out of prose." : "Same rule."}`));
  // a word twice in a row, on one line or across one line break. the title, a heading and the
  // paragraph under it are separate, or "Notes on Go" above "Go is" would count.
  const doubled = new Set();
  for (const part of [title, ...withoutCode(body).split(/\n\s*\n/)]) {
    for (const m of part.matchAll(/\b([A-Za-z']+)(?:[ \t]+|[ \t]*\n[ \t]*)\1\b/gi)) doubled.add(`${m[1]} ${m[1]}`.toLowerCase());
  }
  if (doubled.size) out.push(`Doubled ${doubled.size === 1 ? "word" : "words"}: ${[...doubled].map((d) => `"${d}"`).join(", ")}.`);
  if (words < 40) out.push(`Only ${plural(words, "word")}. Is this the whole post?`);
  if (title.length > 90) out.push(`The first line is used as the title, and this one is ${title.length} characters long.`);
  return out;
}

/**
 * A day, or a moment with its time zone written out, and one that is really on the calendar.
 * A time with no zone is refused: this machine and the server would each read it as their own.
 * The same test is in app/api/posts/route.ts.
 */
export function isDay(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2}))?$/.test(v)) return false;
  // the whole value has to be a moment. this is what refuses 25:00.
  if (Number.isNaN(Date.parse(v))) return false;
  // no post was written before 1970, and the database has no year 0
  const year = Number(v.slice(0, 4));
  if (year < 1970 || year > 2200) return false;
  // 2026-02-30 parses, as the second of March, so the day is built again and compared.
  // it is tested before it is formatted: an impossible day throws there instead of answering no.
  const day = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === v.slice(0, 10);
}

/** up to three spaces may come first. four, or a tab, is code, as it is everywhere else in a file. */
const SETTING = /^ {0,3}(tags?|summary|excerpt|slug|draft|format|date|cover|kept)\s*:\s*(.*)$/i;
const keyOf = (m) => m[1].toLowerCase().replace(/^tag$/, "tags").replace(/^excerpt$/, "summary");
/** a yes or a no keeps its meaning in quotes or brackets, so one pair comes off, straight or curly */
const PAIRS = { '"': '"', "'": "'", "“": "”", "‘": "’", "(": ")", "[": "]", "{": "}" };
const bare = (v) => (v.length > 1 && PAIRS[v[0]] === v[v.length - 1] ? v.slice(1, -1).trim() : v);
/** a line only counts as a setting when its value looks like one */
const FITS = {
  tags: (v) => v.length <= 160 && v.split(",").every((t) => { t = t.trim(); return t.length <= 30 && t.split(/\s+/).length <= 4 && !/[.!?]$/.test(t); }),
  summary: () => true,
  slug: (v) => /^\S{1,120}$/.test(v),
  draft: (v) => /^(y|yes|true|1|on|n|no|false|0|off)$/i.test(bare(v)),
  format: (v) => /^(markdown|md|text)$/i.test(v),
  date: (v) => isDay(v),
  cover: (v) => v === "" || coverFits(v),
  kept: (v) => /^(update|overwrite)$/.test(v),
};
const YES = /^(y|yes|true|1|on)$/i;
/** a file that says it is markdown is taken as written, indents and all */
const isMarkdown = (format) => /^(markdown|md)$/i.test(format ?? "");

/**
 * A draft or a date that was plainly meant as a setting and has a slip in it. For a draft that
 * is a value which starts with a yes or a no, or one of three words or fewer, nothing after the
 * colon included: "draft: yep" is a slip, and "Draft: the first one is always the worst." is
 * a sentence.
 */
const goneWrong = (key, value) =>
  (key === "draft" && (/^(y|yes|n|no|true|false|on|off|0|1)\b/i.test(value) || value.split(/\s+/).filter(Boolean).length <= 3)) ||
  (key === "date" && /^\d{4}-\d{1,2}-\d{1,2}/.test(value));
/** a line that is read as a setting where settings go: one of their names, with a value that fits it */
const readsAsSetting = (line) => { const m = line.match(SETTING); return Boolean(m && FITS[keyOf(m)](m[2].trim())); };
/** a line that sets something other than the summary. a first sentence can open "Summary:", so that alone proves nothing. */
const realSetting = (line) => { const m = line.match(SETTING); return Boolean(m && keyOf(m) !== "summary" && FITS[keyOf(m)](m[2].trim())); };
/** a line the writer meant as a setting: one that really sets something, or a draft or a date gone wrong */
const meantAsSetting = (line) => { const m = line.match(SETTING); return Boolean(m) && (realSetting(line) || goneWrong(keyOf(m), m[2].trim())); };
const WHAT_FITS = "A slug has no spaces, a tag is at most four words, draft is yes or no, a date is a real day written like 2026-08-28, a cover starts with http, https or a slash, and format is markdown or text.";

/**
 * Takes the settings off the top of the lines. After `format: markdown` a value is taken as
 * written, which is what lets a kept copy carry anything the site held. Draft and date are
 * the exception and are always checked, because a slip in either changes whether or when a
 * post goes out.
 * @param {"under the title" | "under a blank line"} [where] only changes the advice in the error
 */
function readSettings(lines, meta, where = "under the title") {
  let taken = 0;
  let asWritten = false;
  while (lines.length) {
    const m = lines[0].match(SETTING);
    if (!m) break;
    const key = keyOf(m);
    const value = m[2].trim();
    if (!FITS[key](value) && (!asWritten || key === "draft" || key === "date")) {
      // prose that happens to start with "Draft:", or a setting with a slip in it? if a real
      // setting sits beside it before the next blank line, it was meant as one. so was
      // "draft: yes, not ready", which as prose would publish the draft, and "date: 2026-02-30",
      // which as prose would send the post out dated today.
      const until = lines.findIndex((l) => !l.trim());
      const rest = lines.slice(1, until === -1 ? lines.length : until);
      if (taken > 0 || rest.some(realSetting) || goneWrong(key, value)) {
        // A blank line above it makes it the opening of the text only when settings were read
        // above it and nothing from here to the next blank line was meant as one. Anywhere else
        // the same line would be stopped again, so the blank line is not offered there.
        const blankLineHelps = where === "under the title" && taken > 0 && !goneWrong(key, value) && !rest.some(meantAsSetting);
        const advice = blankLineHelps
          ? "Fix it, or put a blank line above it if it is the first sentence of the post."
          : "Fix it, or word it another way if it is the first sentence of the post.";
        throw new Error(`This line ${where} looks like a setting but cannot be read as one:\n    ${lines[0]}\n  ${WHAT_FITS}\n  ${advice}`);
      }
      break;
    }
    meta[key] = value;
    if (key === "format" && isMarkdown(value)) asWritten = true;
    lines.shift();
    taken++;
  }
  return taken;
}

/**
 * Does a block open with settings? It does when, among the setting shaped lines it starts
 * with, one really sets something or is a draft or a date gone wrong. A block that opens
 * "Summary: we shipped it." and nothing else of the kind is a paragraph.
 * @returns {string | null} the line that settles it
 */
function opensWithSettings(lines) {
  for (const line of lines) {
    const m = line.match(SETTING);
    if (!m) return null;
    if (realSetting(line) || goneWrong(keyOf(m), m[2].trim())) return line;
  }
  return null;
}

/** the lines of the block that starts at `from`: up to a blank line, or a code fence, which is a block of its own */
function blockAt(lines, from) {
  let to = from;
  while (to < lines.length && lines[to].trim() && !FENCE.test(lines[to])) to++;
  return lines.slice(from, to);
}
/** where the next block starts: `from`, or the first line after the blank lines there */
function pastBlanks(lines, from) {
  let at = from;
  while (at < lines.length && !lines[at].trim()) at++;
  return at;
}
/**
 * Does a block hold a line shaped like a setting, whether or not it was read as one? A summary
 * that stands alone is read as a paragraph, and to the writer it is still the place the
 * settings are. So the block under such a block is looked at as well.
 */
const holdsSettingShape = (block) => block.some((l) => SETTING.test(l));

/**
 * The lines without the indents that do not make them code, and for each line that lost one,
 * why. Indented text is code, except in four places.
 * Two are where the shaping further down takes an indent off: every line of a file typed like
 * a letter, and the first line of a paragraph set like a book.
 * One is markdown's own: an indented line that stands under a line of text is shown as part
 * of that paragraph, however far in it is.
 * And one is a matter of where it stands: straight under the title, or under the settings,
 * with no blank line between. That is where settings go, so a line indented there may be a
 * setting that slipped in by a tab as easily as a sample of code, and it is asked about.
 * A setting line indented in any of those ways is not safely code, so each look for a setting
 * left behind is taken on these lines as well. A row of dashes or equals signs under text
 * starts a paragraph of its own here, as it does in shapeBlock.
 * @param {string[]} lines
 * @param {boolean} [top] the first of these lines stands where settings go
 * @returns {{ lines: string[], why: Map<number, "a letter" | "a book" | "under text" | "where settings go"> }}
 */
function withIndentsOff(lines, top = false) {
  const why = new Map();
  const out = [...lines];
  const off = (i, reason) => { out[i] = flushLeft(lines[i]); if (out[i] !== lines[i]) why.set(i, reason); };
  if (typedLikeALetter(splitBlocks(lines))) {
    lines.forEach((_, i) => off(i, "a letter"));
    return { lines: out, why };
  }
  let from = 0;
  for (let i = 0; i <= lines.length; i++) {
    const ends = i === lines.length || !lines[i].trim() || FENCE.test(lines[i]) || (i > from && RULE.test(lines[i]));
    if (!ends) continue;
    let j = from;
    // a paragraph set like a book loses the indent of its first line wherever it stands
    if (setLikeABook(lines.slice(from, i))) off(j++, "a book");
    // otherwise the block that opens the lines, when it opens with an indent: as far as the indent goes
    else if (top && from === 0) for (; j < i && INDENTED.test(lines[j]); j++) off(j, "where settings go");
    // Under a line of text an indented line carries the paragraph on. Under a list item, a
    // quote or a table row it belongs to that, and is left as it is.
    for (let prose = false; j < i; j++) {
      if (!INDENTED.test(lines[j])) prose = !GROUPED.test(lines[j]);
      else if (prose) off(j, "under text");
    }
    from = i + 1;
  }
  return { lines: out, why };
}

/**
 * Stops the post when a line that was meant as a setting is left where it would be published
 * as text. The reader has taken what it can by now, and it stops at the first line that is not
 * a setting. So a setting under a wrapped summary was never reached, and neither was one in a
 * second block under the first, nor one under a summary that stood alone and was taken for a
 * paragraph. Each of those once sent a draft out with "draft: yes" in its opening.
 * @param {string[]} lines what is left once the settings have been taken off the top
 * @param {number} taken how many settings were read
 * @param {{ lines: string[], why: Map<number, string> }} [bare] the same lines without the indents that do not make them code, when the look is on those
 */
function noSettingLeftBehind(lines, taken, bare) {
  /** the lines as they were typed, when the look is on the lines without their indents */
  const typed = bare ? lines : undefined;
  if (bare) lines = bare.lines;
  /** settings sit above the block in hand: some were read, or a block passed on the way down holds a line shaped like one */
  let above = taken > 0;
  /** @param {string} [shown] the line as it is printed, when that is not the line as it would be read */
  const said = (line, where, move, shown = line) => {
    const fix = readsAsSetting(line) ? move : `${WHAT_FITS}\n  Fix it and ${move[0].toLowerCase()}${move.slice(1)}`;
    return new Error(`${where}, so it would be published as text:\n    ${shown}\n  ${fix}`);
  };
  // The file was looked at as it was typed first, and nothing was found. So a line found now
  // was hidden by an indent. In a letter that is true of every line found: it lost its own
  // indent, or it sits under lines that lost theirs. Anywhere else it is true of a line that
  // lost its own, and any other is told what it would be told had no line been indented.
  // The line is not told to take the indent off where it stands. Under an indented summary
  // that leaves a file that is no letter, with the line as a paragraph of it.
  const letter = Boolean(typed) && typedLikeALetter(splitBlocks(typed));
  const loose = (i) => Boolean(typed) && (letter || typed[i] !== lines[i]);
  const unindented = (i) => {
    const reason = letter ? "a letter" : bare.why.get(i);
    // Where settings go, the line is shown as it was typed, indent and all, and both ways
    // out are given: it is as likely a slip of the tab key as a sample, and only the writer knows.
    if (reason === "where settings go") {
      return said(lines[i], `This line looks like a setting, but it is indented, and straight under ${above ? "the settings" : "the title"} an indented line is taken for a sample of code`,
        "Take the indent off if it is a setting. If it is a sample of code, put a blank line above it.", typed[i]);
    }
    const because = reason === "a letter" ? "every paragraph in this file is indented and loses its indent"
      : reason === "under text" ? "an indented line straight under a line of text is not code and is shown as part of that paragraph"
      : "an indent on only the first line of a paragraph is not code and comes off";
    return said(lines[i], `This line looks like a setting, but ${because}`,
      "Write it straight under the title, with no indent in front of it, or word it another way if it belongs to the text.", reason === "under text" ? typed[i] : lines[i]);
  };
  const stray = (i) => loose(i) ? unindented(i) : said(lines[i], "This line looks like a setting, but it sits under a line that is not one",
    `${above ? "Move it up with the other settings" : "Move it above the text"}, or word it another way if it belongs to the text.`);

  // The line the reader stopped at. Without the indent it is about to lose, it would have been
  // read as a setting, which a summary line is there with no proof asked. Or, under settings
  // that were read, it would have been refused as one that cannot be read.
  if (typed && typed[0] !== lines[0] && SETTING.test(lines[0]) && (readsAsSetting(lines[0]) || taken > 0)) throw unindented(0);
  // the rest of the block the reader stopped in
  const here = blockAt(lines, 0);
  const left = here.findIndex(meantAsSetting);
  if (left !== -1) throw stray(left);
  // And the block after it. Those two are the places a writer could take for the place
  // settings go. A block that holds a line shaped like a setting is such a place too, read or
  // not, so the look goes on to the block under it, and stops at the first block that holds
  // none. What comes after that is text, whatever it looks like.
  let at = here.length;
  for (;;) {
    at = pastBlanks(lines, at);
    const next = blockAt(lines, at);
    const apart = above ? opensWithSettings(next) : null;
    if (apart) {
      throw loose(at + next.indexOf(apart)) ? unindented(at + next.indexOf(apart)) : said(apart, "The settings in this file are in two places, and this line sits apart from the others",
        "Put it with the others, with no blank line between them, or word it another way if it belongs to the text.");
    }
    const hidden = next.findIndex(meantAsSetting);
    if (hidden !== -1) throw stray(at + hidden);
    if (!holdsSettingShape(next)) return;
    above = true;
    at += next.length;
  }
}

/**
 * With a title passed in: the first line of the file that was meant as a setting of its own, in
 * its first two blocks or in a block after them for as long as the one above it holds a line
 * shaped like a setting. That is as far down as a file is looked at with no title passed in.
 * @returns {string | undefined}
 */
function settingOfItsOwn(lines) {
  for (let at = 0, nth = 1; ; nth++) {
    const block = blockAt(lines, at);
    const own = block.find(meantAsSetting);
    if (own) return own;
    if (!block.length || (nth > 1 && !holdsSettingShape(block))) return undefined;
    at = pastBlanks(lines, at + block.length);
  }
}

/**
 * The copy kept of a post the command is about to replace, written so that posting the file
 * puts back exactly what the site had: the title even if it starts with a hash, an address
 * typed at the desk with a dot in it, an empty list of tags, and the text untouched.
 * It also says why it was kept. A copy kept before an overwrite is the undo of that overwrite.
 * A copy kept before an ordinary update is an older version of the same post.
 * @param {{ title: string, slug: string, published: boolean, tags?: string[], excerpt?: string | null, body_md: string, published_at?: string | null, cover_url?: string | null }} p
 * @param {"update" | "overwrite"} [why]
 */
export function keptCopy(p, why = "update") {
  return [
    `title: ${p.title}`,
    "format: markdown",
    `kept: ${why}`,
    `slug: ${p.slug}`,
    `draft: ${p.published ? "no" : "yes"}`,
    `tags: ${(p.tags ?? []).join(", ")}`,
    ...(p.published_at ? [`date: ${new Date(p.published_at).toISOString()}`] : []),
    `cover: ${p.cover_url ?? ""}`,
    ...(p.excerpt ? [`summary: ${p.excerpt.replace(/\s+/g, " ").trim()}`] : []),
    "",
    // the desk stores the line endings a browser sends. a file keeps the plain kind.
    p.body_md.replace(/\r\n?/g, "\n"),
    "",
  ].join("\n");
}

/**
 * @param {string} raw the contents of the text file
 * @param {{ title?: string, tags?: string[], summary?: string, slug?: string, copy?: boolean }} [opts] copy: the file is one the command kept
 */
export function textToPost(raw, opts = {}) {
  // A copy the command kept is whatever the site held. If a broken character was typed at the
  // desk, the copy has it too, and refusing the copy would mean that post can never be changed.
  if (!opts.copy && /[\uFFFD\u0000]/.test(raw)) throw new Error("That file is not saved as UTF-8, so its quotes and accents would come out broken. Save it as UTF-8 and run this again.");
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  if (!lines.length) throw new Error("The file is empty.");

  const meta = {};
  let title = opts.title?.trim();
  /** with a title passed in, a first line that was written as a title is now the opening of the text */
  let demoted = null;
  if (title) {
    // The whole file is the post, so setting lines of its own would be published as text, and
    // a draft: yes among them would be ignored. The file's own settings could sit at the very
    // top, under its first line, under a row of === or --- beneath that, or under a blank line
    // after any of those, and a wrapped line can hide one. So every line of the first two
    // blocks is looked at, and of each block after them for as long as the one above it holds
    // a line shaped like a setting, which is how the file is read with no title passed in.
    // A kept copy is held to this as well: its header is nothing but setting lines, and none
    // of them is text. Then the file is looked at again without the indents that do not make
    // a line code: a draft line indented like the rest of a letter, like the first line of a
    // paragraph in a book, under a line of text, or at the very top of the file.
    const asTyped = settingOfItsOwn(lines);
    const own = asTyped ?? settingOfItsOwn(withIndentsOff(lines, true).lines);
    if (own) {
      // Leaving the title off is only a way out when the file then reads without complaint.
      // It does not when the setting hides under a line of text, and it does not when the
      // file has no title line of its own, because its first setting would be the title.
      let readsAlone = true;
      try { textToPost(raw, { ...opts, title: undefined }); } catch { readsAlone = false; }
      const wayOut = readsAlone
        ? "Leave --title off and let the first line of the file be the title, or take the setting lines out."
        : "Take the setting lines out, or word them another way if they belong to the text.";
      // Found only without its indent, the line may be a sample of code and not a setting at
      // all. A fence says so in a way no indent can.
      const sample = asTyped ? "" : " If it is a sample of code, put it between two lines of three backticks.";
      throw new Error(`With a title passed in, the whole file is the post, and this file has a setting line of its own:\n    ${own}\n  It would be published as text, and a draft: yes would be ignored. ${wayOut}${sample}`);
    }
    if (lines.length > 1 && !lines[1].trim() && headingCandidate(lines[0])) demoted = lines[0].trim();
  }
  if (!title) {
    const first = lines.shift();
    // A file with no title line has a setting where its title should be. Taken for the title,
    // a draft: yes there would be the name of a post that went out. No indent makes the line
    // anything else, because a title cannot be code. A line that is only shaped like a
    // setting, a summary say, can be a title when it stands alone. With settings straight under
    // it, it was meant as one of them, and the post would go out under it.
    if (meantAsSetting(first.trim()) || (SETTING.test(first.trim()) && opensWithSettings(lines))) throw new Error(`The first line of a file is its title, and this one looks like a setting:\n    ${first.trim()}\n  Put the title on a line above it. If that line really is the title, write it as  title: ${first.trim()}`);
    // "title: # of allocations" keeps its hash. a bare "# My post" loses the markdown mark.
    title = (/^ {0,3}title\s*:/i.test(first) ? first.replace(/^ {0,3}title\s*:\s*/i, "") : first.replace(/^#{1,6}\s+/, "")).trim();
    if (lines.length && RULE.test(lines[0])) lines.shift();
    // settings sit under the title. with a title passed in, the whole file is the post.
    let taken = readSettings(lines, meta);
    if (taken === 0) {
      // or under a blank line, when the block there opens with them
      let i = 0;
      while (i < lines.length && !lines[i].trim()) i++;
      if (i > 0 && opensWithSettings(lines.slice(i))) {
        lines.splice(0, i);
        taken = readSettings(lines, meta, "under a blank line");
      }
    }
    // A kept copy is told by where it was read from, or by the kept: line every copy has
    // carried since copies began to say why they were kept. Its text is whatever the site held.
    if (!opts.copy && meta.kept === undefined) {
      noSettingLeftBehind(lines, taken);
      // A file typed like a letter loses its indents further down, and so does the first line
      // of a paragraph set like a book. A setting line indented in one of those ways would
      // lose its indent too and go out as text. So would one under a line of text, and one
      // straight under the title may have been meant as a setting. So the look is taken again
      // on the lines without those indents. A file that says it is markdown keeps every
      // indent, as code.
      if (!isMarkdown(meta.format)) noSettingLeftBehind(lines, taken, withIndentsOff(lines, true));
    }
  }
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) throw new Error("There is nothing under the title. The first line is the title and the post starts on the next.");

  let shaped;
  let body_md;
  const headings = [];
  const noteHeading = (b) => { const h = !FENCE.test(b) && b.match(/^#{1,6}\s+(.+)$/); if (h) headings.push(h[1].trim()); };
  if (isMarkdown(meta.format)) {
    body_md = lines.join("\n");
    shaped = splitBlocks(lines).map((b) => b.join("\n"));
    shaped.forEach(noteHeading);
  } else {
    // typed bullets become real ones before anything decides what is a list
    const body = lines.map((l) => l.replace(/^(\s*)[•·▪◦]\s+/, "$1- "));
    let raws = splitBlocks(body);
    if (typedLikeALetter(raws)) raws = raws.map((b) => (FENCE.test(b[0]) ? b : b.map(flushLeft)));
    const blocks = raws.flatMap((b) => shapeBlock(b, raws.length === 1));
    const candidates = blocks.map((b, i) => (i === 0 ? null : headingCandidate(b)));
    shaped = blocks.map((b, i) => {
      // not the last thing in the post, and two short lines in a row are a sign off, not two headings
      if (candidates[i] && i !== blocks.length - 1 && !candidates[i - 1] && !candidates[i + 1]) {
        headings.push(candidates[i]);
        return `## ${candidates[i]}`;
      }
      noteHeading(b);
      // "2019. That was the year" is a sentence. markdown would number it as item one of a list.
      return b.includes("\n") ? b : b.replace(/^(\d{3,})\.(\s)/, "$1\\.$2");
    });
    body_md = shaped.join("\n\n");
  }

  const words = sitePlain(body_md).split(/\s+/).filter(Boolean).length;
  const tags = tidyTags(opts.tags ?? (meta.tags ?? "").split(","));
  const summary = (opts.summary ?? meta.summary ?? "").trim();

  return {
    title,
    body_md,
    excerpt: summary || makeExcerpt(shaped),
    tags,
    slug: (opts.slug ?? meta.slug ?? "").trim() || undefined,
    /** what the file itself says. the flags on the command line are the command's business. */
    draft: YES.test(bare(meta.draft ?? "")),
    /** the day the post went out and its cover, when the file names them */
    date: meta.date || undefined,
    cover: meta.cover,
    /** which of these the writer actually asked for, so nothing already on the site is changed by a guess */
    given: {
      tags: opts.tags !== undefined || meta.tags !== undefined,
      summary: Boolean(summary),
      slug: Boolean((opts.slug ?? meta.slug ?? "").trim()),
      draft: meta.draft !== undefined,
      cover: meta.cover !== undefined,
    },
    words,
    /** the same sum the site uses, so the number shown here is the number on the page */
    minutes: Math.max(1, Math.round(words / 220)),
    headings,
    /** why a kept copy was kept: before an update, or before an overwrite */
    kept: meta.kept,
    warnings: [
      ...(demoted ? [`With a title passed in, the whole file is the post, so its first line is now the opening of the text: "${demoted}"`] : []),
      ...findWarnings(title, body_md, words),
    ],
  };
}
