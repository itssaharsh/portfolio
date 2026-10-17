// npm test
// Every combination plan() can be handed, about 94,000 of them, checked against what must
// always be true. The truth here does not come from the code under test: each post is built
// to stand in a known relation to the file (word for word, nearly, mostly, partly, not at
// all, a part of it, or it and more), so the check knows what the right answer is without
// asking version() or relate().
//
// Where plan() stops and asks, the ways out are read off the sentence it printed and each is
// tried as printed, so a sentence that offers what would be refused, or names one post and
// changes another, fails here.
//
// It exists because five reviews in a row each found a new state in which the command changed
// the wrong post, and the last one found them by writing this grid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan } from "./post-plan.mjs";
import { textToPost, keptCopy, autoSummary, likeness, slugify } from "./post-text.mjs";

const long = (seed) => Array.from({ length: 30 }, (_, i) => `${seed}${i}`).join(" ") + ".";
const paras = (...seeds) => seeds.map(long).join("\n\n");
/** the text in the file is always these four paragraphs */
const FILE = paras("fa", "fb", "fc", "fd");
/** a post on the site stands to it in one of these ways */
const REL = {
  identical: FILE,
  near: FILE.replace("fa3 ", "fa-three ").replace("fb3 ", "fb-three ").replace("fc3 ", "fc-three ").replace("fd3 ", "fd-three "),
  most: paras("fa", "fb", "fc", "zz"),      // three quarters of it is in the file
  part: paras("fa", "yy", "xx", "ww"),      // a quarter of it is
  none: paras("qa", "qb", "qc", "qd"),
  // two that are not as long as the file, one each way, so it matters which text holds which
  opening: `${long("fa")}\n\n${Array.from({ length: 15 }, (_, i) => `fb${i}`).join(" ")}`,   // the first paragraph and a half of the file: all of it is in the file, and a third of the file is in it
  longer: paras("fa", "fb", "fc", "fd", "za", "zb"),   // the file and two paragraphs more: two thirds of it is in the file, and all of the file is in it
};
const TITLE = { exact: "Notes on the cache", tidy: "Notes on the Cache!", other: "Something else entirely" };
/** the post a file last made has an older title, or, once a corrected title has been posted, the file's own */
const MADE_TITLE = { older: "An older title", same: "Notes on the cache" };
/**
 * Whether a post is plainly the same piece of writing as the text in hand. Word for word or
 * nearly so always is. So is one where most of the earlier text is still there in the later,
 * under the same title. Under a new title that is not enough: it is what a correction quoting
 * most of an old post looks like.
 * Which text is the earlier one matters for the two that are not as long as the file. In the
 * first grid the post on the site is the earlier and the file the later. In the second the
 * kept copy is the earlier, and of a copy cut down to its opening most is gone.
 * @param {"post" | "copy"} [earlier]
 */
const plainlySame = (rel, title, earlier = "post") =>
  rel === "identical" || rel === "near" || (title !== "other" && (rel === "most" || rel === "longer" || (rel === "opening" && earlier === "post")));
/** neither plainly the same nor nothing to do with it: the only posts there is anything to ask about */
const partly = (rel, title, earlier) => rel !== "none" && !plainlySame(rel, title, earlier);
/**
 * The posts the site would call a second copy of the file, by how each was built: one of the
 * two texts holds most of the other. The site lets no new post in beside one of these unless
 * it is told the post is meant as a separate one, and none at all under a title a post
 * already has. plan() never sees those two refusals, so they are kept here, by hand.
 */
const SECOND_COPY = new Set(["identical", "near", "most", "opening", "longer"]);

// the posts really do stand to the file the way their names say, measured and not assumed,
// and none of them sits near a line the code draws
test("the fixtures are what they are called", () => {
  const share = (rel) => likeness(REL[rel], FILE);
  assert.deepEqual([share("identical").ofPrev, share("identical").ofNext], [1, 1]);
  assert.ok(share("near").ofPrev > 0.85 && share("near").ofPrev < 1 && share("near").ofNext > 0.85);
  assert.ok(share("most").ofPrev > 0.6 && share("most").ofPrev < 0.8, `most: ${share("most").ofPrev}`);
  assert.ok(share("part").ofPrev > 0.15 && share("part").ofPrev < 0.35, `part: ${share("part").ofPrev}`);
  assert.equal(share("none").shared, 0);
  assert.equal(share("opening").ofPrev, 1, "all of the opening is in the file");
  assert.ok(share("opening").ofNext > 0.3 && share("opening").ofNext < 0.45 && share("opening").shared >= 40, `opening: ${share("opening").ofNext}`);
  assert.equal(share("longer").ofNext, 1, "all of the file is in the longer post");
  assert.ok(share("longer").ofPrev > 0.6 && share("longer").ofPrev < 0.72, `longer: ${share("longer").ofPrev}`);
  for (const rel of SECOND_COPY) assert.ok(Math.max(share(rel).ofPrev, share(rel).ofNext) > 0.7 && share(rel).shared >= 40, `${rel} holds most of the file, or the file most of it`);
  for (const rel of Object.keys(REL)) if (!SECOND_COPY.has(rel)) assert.ok(Math.max(share(rel).ofPrev, share(rel).ofNext) < 0.3, `${rel} holds little of the file`);
});

const row = (slug, title, body_md, published) => ({ slug, title, body_md, excerpt: autoSummary(body_md), tags: ["go"], published, published_at: published ? "2026-08-28T21:22:05.913Z" : null, cover_url: null });

const show = (list) => {
  const kinds = {};
  for (const b of list) (kinds[b.what] ??= []).push(b.where);
  return Object.entries(kinds).map(([what, where]) => `${where.length} x ${what}\n      e.g. ${where.slice(0, 3).join("\n           ")}`).join("\n  ");
};

/** the copy the command would keep of a post, read back the way the command reads one. the same few posts come round thousands of times. */
const copies = new Map();
const copyOf = (p, why) => {
  const key = [why, p.slug, p.title, p.published, p.body_md].join("\n");
  if (!copies.has(key)) copies.set(key, textToPost(keptCopy(p, why), { copy: true }));
  return copies.get(key);
};
/**
 * Whether the way back a run gives is one that works. The run kept a copy of `was` and told
 * the writer which flags to type after it. So the copy is put back with exactly those flags,
 * against what the site holds once it has taken what the run sent, and the post has to come
 * out with the title, the text, the tags and the state it had before.
 * @returns {string | null} what went wrong, in words
 */
function wayBackFails(run, was, site) {
  const now = {
    ...was, title: run.send.title, body_md: run.send.body_md,
    excerpt: "excerpt" in run.send ? run.send.excerpt || null : run.send.fresh ? null : was.excerpt,
    tags: "tags" in run.send ? run.send.tags : run.send.fresh ? [] : was.tags,
    published: "published" in run.send ? run.send.published : was.published,
  };
  const back = plan({ post: copyOf(was, run.why), atTarget: now, restoring: true, site, overwrite: run.undo.includes("--overwrite"), published: run.undo.includes("--publish") ? true : run.undo.includes("--draft") ? false : undefined });
  if (back.refuse) return "the way back it gives is refused";
  if (back.existing !== now || back.send.title !== was.title || back.send.body_md !== was.body_md) return "the way back it gives does not put the old title and text back";
  if (("published" in back.send ? back.send.published : now.published) !== was.published) return "the way back it gives leaves the post out when it was not, or takes it down when it was out";
  if (JSON.stringify(back.send.tags) !== JSON.stringify(was.tags)) return "the way back it gives does not put the old tags back";
  return null;
}

/**
 * The ways out a refusal offers, read off its lines the way a person would. Each line under
 * the first can offer one, or two with ", or " between them. A way out is some flags to add,
 * a title or an address of its own to give the post, or both. A title or an address of its
 * own is only ever asked for with the words "give it its own".
 * scripts/sim/site.mjs holds the same reading for the random tester. Keep the two alike.
 * @returns {{ said: string, flags: string[], dropOverwrite: boolean, ownTitle: boolean, ownAddress: boolean }[]}
 */
function waysOut(refusal) {
  const out = [];
  for (const line of refusal.split("\n").slice(1)) {
    for (const part of line.split(", or ")) {
      // what is to be typed is set off by two spaces, after "add" or after "its own address:"
      const add = part.match(/(?:add|address:) {2}((?:--slug \S+|--[a-z-]+)(?: (?:--slug \S+|--[a-z-]+))*)/);
      const way = { said: part.trim(), flags: add ? add[1].split(" ") : [], dropOverwrite: /take --overwrite off/.test(part), ownTitle: /give it its own title/.test(part), ownAddress: /give it its own (?:title and its own )?address/.test(part) };
      if (way.flags.length || way.ownTitle || way.ownAddress) out.push(way);
    }
  }
  return out;
}

test("an ordinary file: nothing goes out, comes down, is copied or is replaced that no flag asked for, and every way out it offers works", () => {
  const bad = [];
  let n = 0;
  let tried = 0;
  for (const answer of [null, "samePost", "separate", "overwrite"])
  for (const flag of [undefined, true, false])
  for (const fileDraft of [null, "yes", "no"])
  for (const givenSlug of [false, true]) {
    /** the file as it would be typed: the title, what it says about itself, and the text. only a handful are ever asked for. */
    const files = new Map();
    const fileWith = (title, slug) => {
      const head = [title, ...[fileDraft ? `draft: ${fileDraft}` : null, slug ? `slug: ${slug}` : null].filter(Boolean)].join("\n");
      if (!files.has(head)) files.set(head, textToPost(`${head}\n\n${FILE}\n`));
      return files.get(head);
    };
    const post = fileWith("Notes on the cache", givenSlug ? "notes-on-the-cache" : null);
    for (const targetRel of [null, ...Object.keys(REL)])
    for (const targetTitle of targetRel ? Object.keys(TITLE) : [null])
    for (const targetLive of targetRel ? [true, false] : [null]) {
      const atTarget = targetRel ? row("notes-on-the-cache", TITLE[targetTitle], REL[targetRel], targetLive) : null;
      // what the file last posted to: nothing, the post at the address itself, or a post somewhere else
      const mades = [[null, null, null], ...(atTarget ? [["own", null, null]] : []), ...Object.keys(REL).flatMap((r) => [true, false].flatMap((l) => Object.keys(MADE_TITLE).map((t) => [r, l, t])))];
      for (const [madeRel, madeLive, madeTitle] of mades) {
        n++;
        const made = madeRel === null ? null : madeRel === "own" ? atTarget : row("the-post-this-file-made", MADE_TITLE[madeTitle], REL[madeRel], madeLive);
        const base = { atTarget, made, published: flag, site: "https://x.test" };
        const r = plan({ ...base, post, [answer ?? "none"]: true });
        const elsewhere = made && made !== atTarget ? made : null;
        /** the made post as the checks below name its title: the file's own, or another */
        const elseTitle = madeTitle === "same" ? "exact" : "other";
        /** the post this file last made is one there is something to ask about. a file that names an address has no such post. */
        const mineInDoubt = Boolean(elsewhere) && !givenSlug && partly(madeRel, elseTitle);
        const where = `answer=${answer ?? "-"} flag=${flag === undefined ? "-" : flag ? "publish" : "draft"} file draft=${fileDraft ?? "-"} names an address=${givenSlug} at the address=${targetRel ? `${targetRel}/${targetTitle}/${targetLive ? "live" : "draft"}` : "-"} last posted to=${madeRel ? (madeRel === "own" ? "the post at the address" : `${madeRel}/${madeTitle} title/${madeLive ? "live" : "draft"}`) : "-"}`;
        const outcome = (x) => (x.refuse ? "asks" : !x.existing ? "new post" : `${x.send.fresh ? "replaces" : "changes"} ${x.existing === atTarget ? "the post at the address" : "the post it last posted to"}`);
        const say = (what) => bad.push({ what, where: `${where} -> ${outcome(r)}` });
        if (r.refuse) {
          // it must not ask when the answer is plain: the post at the address is plainly this text
          if (!answer && atTarget && plainlySame(targetRel, targetTitle)) say("asked about a post that is plainly this one");
          // nor when there is nothing to ask about, and an answer is only turned away for a reason it gives
          if (!answer && !atTarget && !mineInDoubt) say("asked, with nothing at the address and nothing in doubt about the post it last posted to");
          if (answer === "samePost" && (atTarget || (elsewhere && !givenSlug))) say("--same-post was refused though a post is there for it to change");
          if (answer === "separate" && !atTarget) say("--separate was refused with nothing at the address");
          if (answer === "overwrite" && !mineInDoubt) say("--overwrite was refused, and not because the post it last posted to is in doubt");

          // 7. Every way out the question offers works when typed as printed. The post it is
          //    about is read off its first line, and so is each flag.
          const named = r.refuse.split("\n")[0].includes(`/blog/${elsewhere?.slug}`) ? elsewhere : atTarget;
          /** what plan() was shown of the site. it is not shown the post a file last made when the file names an address. */
          const onSite = [[atTarget, targetRel], ...(givenSlug ? [] : [[elsewhere, madeRel]])].filter(([p]) => p);
          for (const way of waysOut(r.refuse)) {
            tried++;
            const typed = { samePost: answer === "samePost", separate: answer === "separate", overwrite: answer === "overwrite" && !way.dropOverwrite };
            let slug = givenSlug ? "notes-on-the-cache" : null;
            for (let i = 0; i < way.flags.length; i++) {
              if (way.flags[i] === "--slug") slug = way.flags[++i];
              else typed[{ "--same-post": "samePost", "--separate": "separate", "--overwrite": "overwrite" }[way.flags[i]]] = true;
            }
            if (way.ownAddress && !way.flags.includes("--slug")) slug = "some-other-words";
            const again = fileWith(way.ownTitle ? "A title all of its own" : "Notes on the cache", slug);
            const address = slug ?? slugify(again.title);
            const there = address === "notes-on-the-cache" ? atTarget : address === elsewhere?.slug ? elsewhere : null;
            // two of the three answers on one line never reach plan(): the command stops at "cannot both be right"
            if ([typed.samePost, typed.separate, typed.overwrite].filter(Boolean).length > 1) { bad.push({ what: "a way out it offers cannot be typed beside the answer already given", where: `${where} -> asks, and offers "${way.said}"` }); continue; }
            // a file or a flag that names an address has no post it last made to go by
            const r2 = plan({ ...base, post: again, atTarget: there, made: slug ? null : made, ...typed });
            const sayOf = (what) => bad.push({ what, where: `${where} -> asks, and to "${way.said}" -> ${outcome(r2)}` });
            if (r2.refuse) { sayOf("a way out it offers is refused when typed as printed"); continue; }
            const aimedAt = way.flags.includes("--slug") ? there : named;
            if (typed.samePost) {
              if (r2.existing !== aimedAt || !aimedAt) sayOf("--same-post, offered, did not change the post the sentence names");
              if (r2.send.fresh) sayOf("--same-post, offered, reset the post");
            } else if (typed.overwrite) {
              if (r2.existing !== aimedAt || !aimedAt || !r2.send.fresh) sayOf("--overwrite, offered, did not replace the post the sentence names");
              const promised = way.said.match(/It goes up as a new post: (published|saved as a draft)/)?.[1];
              if (promised && r2.send.published !== (promised === "published")) sayOf("--overwrite, offered, did not leave the post in the state the sentence promised");
            } else {
              // every other way out is a new post, and the site has to let it in
              if (r2.existing) { sayOf("a way out offered for a new post changed a post instead"); continue; }
              if (onSite.some(([p]) => p.title.trim() === r2.send.title)) sayOf("a way out it offers for a new post is one the site refuses: a post already has that title");
              else if (!r2.send.separate && onSite.some(([, rel]) => SECOND_COPY.has(rel))) sayOf("a way out it offers for a new post is one the site refuses: most of the text is in a post already there, and --separate was not offered with it");
            }
          }
          continue;
        }
        const ex = r.existing;
        const out = "published" in r.send ? r.send.published : ex ? ex.published : false;
        const rel = ex ? (ex === atTarget ? targetRel : madeRel) : null;
        const title = ex ? (ex === atTarget ? targetTitle : elseTitle) : null;

        // 1. a draft goes out only with --publish, or as a new post, or by --overwrite, which is one
        if (ex && !ex.published && out && flag !== true && !(r.send.fresh && answer === "overwrite" && fileDraft !== "yes")) say("a draft went out");
        if (!ex && out && fileDraft === "yes" && flag !== true) say("a new post that says draft went out");
        // 2. a live post comes down only with --draft, or by --overwrite from a file that says draft
        if (ex && ex.published && !out && flag !== false && !(r.send.fresh && answer === "overwrite" && fileDraft === "yes")) say("a live post came down");
        // 3. no second copy: no new post while a post that is plainly this text is in view
        if (!ex && answer !== "separate" && ((atTarget && plainlySame(targetRel, targetTitle)) || (elsewhere && !givenSlug && plainlySame(madeRel, elseTitle)))) say("a new post went up beside one that is plainly this text");
        // 4. a post that shares nothing is changed only by --overwrite or --same-post, and one that
        //    shares part only by an answer. it makes no difference whose file it is: the same
        //    file and the same title are how next week's notes arrive.
        if (ex && rel === "none" && answer !== "overwrite" && answer !== "samePost") say("a post with none of this text was changed");
        if (ex && !plainlySame(rel, title) && rel !== "none" && !answer) say("a partly matching post was changed with no answer given");
        if (r.send.fresh && answer !== "overwrite") say("replaced as a new post without --overwrite");
        //    and with the post it last posted to in doubt, nothing is done until that is answered
        if (!answer && mineInDoubt && !(atTarget && plainlySame(targetRel, targetTitle))) say("the post it last posted to is partly this text, and it went ahead without asking");
        // 5. the answers mean what they say
        if (answer === "samePost" && !ex) say("--same-post made a post");
        if (answer === "separate" && ex) say("--separate changed a post");
        if (answer === "samePost" && r.send.fresh) say("--same-post reset the post");
        if (answer === "overwrite" && ex && !r.send.fresh && !plainlySame(rel, title)) say("--overwrite was given, and the post was changed in place instead");
        // --overwrite replaces what is at the address, and never the post the file last made
        if (r.send.fresh && ex !== atTarget) say("--overwrite replaced a post that is not the one at the address");
        // the answer goes to the post the question was about: when the post it last posted to
        // shares nothing with the text, the only question that can have been asked is about the address
        if (answer === "samePost" && ex && ex === elsewhere && atTarget && madeRel === "none") say("--same-post changed a post the question was not about");
        // and a post at the address that is plainly this text is the one any answer is about
        if (ex && ex !== atTarget && atTarget && plainlySame(targetRel, targetTitle) && answer !== "separate") say("changed another post while the one at the address is plainly this text");
        // 6. whatever changes is kept first
        if (ex && !r.same && !r.keep) say("a change with no copy kept");
        if (r.send.fresh && r.why !== "overwrite") say("a replaced post whose copy does not say it was kept before an overwrite");
        // 8. what it says of the post the file last made is what it did to it
        if (r.notes.some((x) => /left alone/.test(x)) && (!elsewhere || ex === elsewhere)) say("said the post this file last posted to was left alone, and changed it");
        if (r.notes.some((x) => /points at this post instead/.test(x)) && (!elsewhere || ex !== atTarget)) say("said the file now points at the post at the address, and changed another");
        // 9. and the way back it prints is one that works
        const lost = ex && r.keep ? wayBackFails(r, ex, base.site) : null;
        if (lost) say(`${lost} (${r.undo.join(" ") || "no flag"})`);
      }
    }
  }
  assert.ok(n > 90000, `only ${n} combinations`);
  assert.ok(tried > 50000, `only ${tried} ways out were tried`);
  assert.equal(bad.length, 0, `${bad.length} of ${n} combinations broke a rule:\n  ${show(bad)}`);
});

test("a kept copy being put back: it makes nothing live by itself, and takes a live post down only as the undo it is", () => {
  const COPY = FILE;
  const bad = [];
  let n = 0;
  let tried = 0;
  for (const kept of ["update", "overwrite", null])
  for (const copyLive of [true, false])
  for (const flag of [undefined, true, false])
  for (const overwrite of [false, true])
  for (const nowRel of [null, ...Object.keys(REL)])
  for (const nowTitle of nowRel ? Object.keys(TITLE) : [null])
  for (const nowLive of nowRel ? [true, false] : [null]) {
    n++;
    let text = keptCopy(row("notes-on-the-cache", "Notes on the cache", COPY, copyLive), kept ?? "update");
    if (!kept) text = text.replace(/^kept: .*\n/m, "");    // a copy from before copies said why they were kept
    const post = textToPost(text);
    const atTarget = nowRel ? row("notes-on-the-cache", TITLE[nowTitle], REL[nowRel], nowLive) : null;
    const base = { post, atTarget, restoring: true, site: "https://x.test" };
    const r = plan({ ...base, published: flag, overwrite });
    const where = `kept=${kept ?? "(no line)"} copy was ${copyLive ? "live" : "a draft"} flag=${flag === undefined ? "-" : flag ? "publish" : "draft"} overwrite=${overwrite} there now=${nowRel ? `${nowRel}/${nowTitle}/${nowLive ? "live" : "draft"}` : "nothing"}`;
    /** what is there now is the copy's own post, as far as anyone can tell. the copy is the earlier of the two texts. */
    const itsOwn = nowRel && plainlySame(nowRel, nowTitle, "copy");
    /** what is there now has neither its title nor any of its text */
    const stranger = nowRel === "none" && nowTitle === "other";
    const isUndo = kept === "overwrite" && nowRel && !itsOwn;
    /** a copy of a draft, a live page it would change (title or text), and nothing said about which it should be */
    const clash = !copyLive && nowLive && !(nowRel === "identical" && nowTitle === "exact") && flag === undefined;
    if (r.refuse) {
      const asksAboutAStranger = stranger && !isUndo && !overwrite;
      const asksWhichState = !isUndo && !stranger && clash;
      if (!asksAboutAStranger && !asksWhichState) bad.push({ what: "refused a copy it should have put back", where });
      // each flag the question offers, typed as printed, puts the copy back at its own address, in the state the sentence says
      for (const way of waysOut(r.refuse)) {
        tried++;
        const typed = { published: flag, overwrite };
        for (const f of way.flags) {
          if (f === "--overwrite") typed.overwrite = true;
          else typed.published = f === "--publish";
        }
        const r2 = plan({ ...base, ...typed });
        const sayOf = (what) => bad.push({ what, where: `${where} -> asks, and to "${way.said}" -> ${r2.refuse ? "asks again" : r2.send.fresh ? "replaces" : "changes in place"}` });
        if (r2.refuse) sayOf("a way out it offers is refused when typed as printed");
        else if (r2.existing !== atTarget) sayOf("a way out it offers did not put the copy back at its own address");
        else if (way.flags.includes("--overwrite") && (!r2.send.fresh || r2.send.published !== (flag ?? false))) sayOf("--overwrite, offered, did not replace what is there with the copy as a draft");
        else if (!way.flags.includes("--overwrite") && r2.send.published !== typed.published) sayOf("--publish or --draft, offered, did not leave the page in that state");
      }
      continue;
    }
    const ex = r.existing;
    const out = "published" in r.send ? r.send.published : ex ? ex.published : false;
    const say = (what) => bad.push({ what, where: `${where} -> ${!ex ? "new post" : r.send.fresh ? "replaces" : r.same ? "nothing to change" : "changes in place"}, ${out ? "live" : "draft"}` });
    if ((!ex || !ex.published) && out && flag !== true) say("a copy made something live by itself");
    if (isUndo) {
      if (!r.send.fresh) say("the undo of an overwrite was done as a change in place, so the state and date of what replaced it carry over");
      if (flag === undefined && out !== (copyLive && ex.published)) say("the undo of an overwrite did not go back as a draft unless it was live then and the address is live now");
    } else if (stranger) {
      if (!overwrite) say("an older version was written over another post altogether, and nobody was asked");
      else if (!r.send.fresh || (flag === undefined && out)) say("told to replace another post with this copy, it did not go back as a draft");
    } else if (ex) {
      if (r.send.fresh) say("an older version of the same post reset it");
      if (flag === undefined && out !== ex.published) say("an older version of the same post changed whether it is out");
      if (clash) say("a draft's words were put on a live page, and nobody was asked");
      // put back with nothing asked and nothing said about a draft on a live page would be a run that explains nothing
      if (!copyLive && nowLive && flag === undefined && !r.notes.some((x) => /stays live.*--draft/.test(x))) say("a copy of a draft was put back on a live page with no word that the page stays live");
    }
    if (ex && !r.same && !r.keep) say("a change with no copy kept");
    // putting a copy back keeps a copy too, and the way back from that has to work as well
    const lost = ex && r.keep ? wayBackFails(r, ex, base.site) : null;
    if (lost) say(`${lost} (${r.undo.join(" ") || "no flag"})`);
  }
  assert.ok(n > 1500, `only ${n} combinations`);
  assert.ok(tried > 200, `only ${tried} ways out were tried`);
  assert.equal(bad.length, 0, `${bad.length} of ${n} combinations broke a rule:\n  ${show(bad)}`);
});
