"use client";

import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { savePost, type Fields } from "./actions";
import type { Post } from "@/lib/store/types";
import { coverFits } from "@/scripts/post-text.mjs";

/**
 * A text this browser is keeping: when it was typed, over which version of the post, and what
 * was in the boxes. `by` is a mark of the page it was typed on, made afresh each time the
 * editor is opened, so two tabs on one post can tell their texts apart. `gone` marks one that
 * was typed for a post since deleted and then taken to the page for a new post, so the offer
 * there does not say it was typed on that page.
 */
type Unsaved = { at: string; over?: string | null; by?: string; gone?: true; fields: Fields };
/** the page could not hand over a post: its read failed for `reason`, or, with no reason, the post is not there */
type Lost = { id: string; reason?: string };

/** Vercel refuses a request over 4.5MB with an answer the page cannot read, so a big image is stopped here */
const MAX_IMAGE = 4 * 1024 * 1024;
const COVER_RULE = "An address that starts with http or https, or a path on this site that starts with a slash";
const label = "font-mono text-[10px] tracking-[.1em] uppercase text-ink-2";
const said = "border border-ink bg-chalk p-3 text-[.9rem] text-ink";
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** the six boxes that hold text. the tick is not text, and is never taken from a kept copy. */
const TEXT = ["title", "slug", "tags", "excerpt", "cover_url", "body_md"] as const;
const ONE_LINE = ["title", "slug", "tags", "excerpt", "cover_url"] as const;
const EMPTY: Fields = { title: "", slug: "", tags: "", excerpt: "", cover_url: "", body_md: "", published: false };

const oneLine = (text: string) => text.replace(/[\r\n]/g, "");
/**
 * The boxes as they open on a post. A one line box cannot hold a line break, and a text box
 * hands its text back with plain line endings, so both are made so here. Otherwise a row the
 * old desk left with CR LF in it would look typed in the moment it was opened.
 */
const boxesOf = (post: Post): Fields => ({
  title: oneLine(post.title), slug: oneLine(post.slug), tags: oneLine((post.tags ?? []).join(", ")), excerpt: oneLine(post.excerpt ?? ""),
  cover_url: oneLine(post.cover_url ?? ""), body_md: post.body_md.replace(/\r\n?/g, "\n"), published: post.published,
});
/** compared box by box, never by how the two happen to be written down */
const sameText = (a: Fields, b: Fields) => TEXT.every((name) => a[name] === b[name]);
const sameOffer = (a: Unsaved, b: Unsaved) => a.at === b.at && sameText(a.fields, b.fields);

/** what storage holds may come from an older build of the desk, or not be the desk's at all */
function asUnsaved(found: unknown): Unsaved | null {
  if (!found || typeof found !== "object") return null;
  const { at, over, by, gone, fields } = found as { at?: unknown; over?: unknown; by?: unknown; gone?: unknown; fields?: unknown };
  if (!fields || typeof fields !== "object") return null;
  const box = (name: string) => { const value = (fields as Record<string, unknown>)[name]; return typeof value === "string" ? value : ""; };
  return {
    at: typeof at === "string" ? at : "",
    // a copy from before the desk noted the version has no `over` at all, and that has to stay visible
    ...(over === undefined ? {} : { over: typeof over === "string" ? over : null }),
    ...(typeof by === "string" && by ? { by } : {}),
    ...(gone === true ? { gone: true as const } : {}),
    fields: { title: box("title"), slug: box("slug"), tags: box("tags"), excerpt: box("excerpt"), cover_url: box("cover_url"), body_md: box("body_md"), published: (fields as Record<string, unknown>).published === true },
  };
}
// something in storage that cannot be read as what the desk wrote is treated as nothing there
const parsed = (text: string | null): unknown => { try { return JSON.parse(text ?? "null"); } catch { return null; } };
// these throw when storage is switched off, and every caller catches
const readOne = (key: string) => asUnsaved(parsed(localStorage.getItem(key)));
const readList = (key: string): Unsaved[] => {
  const found = parsed(localStorage.getItem(key));
  return Array.isArray(found) ? found.map(asUnsaved).filter((one): one is Unsaved => one !== null) : [];
};
const writeList = (key: string, list: Unsaved[]) => { if (list.length) localStorage.setItem(key, JSON.stringify(list)); else localStorage.removeItem(key); };
/** what the smaller boxes of a kept text held, as sentences, for a page that has no boxes to show them in */
const smallBoxes = (f: Fields) => [f.slug && `Its address was "${f.slug}".`, f.tags && `Its tags were "${f.tags}".`, f.excerpt && `Its one line for the list page was "${f.excerpt}".`, f.cover_url && `Its cover image address was "${f.cover_url}".`].filter(Boolean).join(" ");

/**
 * The editor does not throw away what was typed, and it does not change whether a post is out
 * unless the writer ticks or unticks the box in this sitting.
 *
 * A save the site refuses comes back as a sentence, shown above the button, with every box
 * still holding what was in it and the tick where the writer left it. That is why every box
 * is held here and not left to the browser: React puts a form back to its defaults when its
 * action answers. A tick only gets its default once, so that is kept in step by hand.
 *
 * A save that never gets an answer at all, because the connection dropped, takes the editor
 * off the screen (app/admin/error.tsx stands in its place). So every change is also written to
 * this browser, at desk:unsaved:<the post's id, or new>, with the stamp of the version of the
 * post it was typed over and a mark of the page it was typed on, and the boxes are written
 * there again at the press of save. A save that goes through removes that text, and only if
 * it is still exactly what the save carried.
 *
 * A text found there on arrival, and different from the post, is an offer. Offers have a place
 * of their own, desk:offered:<id or new>, oldest first, so typing with an offer on the screen
 * is kept like any other typing and cannot write over it. Only the writer's own buttons take
 * an offer off that list, with two exceptions that lose nothing. A text that says exactly what
 * the post says is dropped, on arrival or as a save of that very text goes through, because
 * the site already holds it. And a text another tab moved there gives way to a newer text of
 * the page it came from, as is said below.
 * "put it back" is a swap: what was typed in this sitting goes on offer first, and the offer
 * that was put back leaves the list only once the boxes that took it are written down, so
 * there is no moment at which it is kept in neither place. It never takes the tick, and it
 * takes the address only when the post has not been saved again since the offer was typed
 * over it. Where the desk cannot tell, the address is left alone and the offer says so.
 *
 * Two tabs on one post, or both on a new one, share the one kept place. So nothing is written
 * there without a look at what it holds: at every letter typed, at the press of save, and when
 * a save is refused. A text in it that another page wrote, and that says neither what the post
 * says nor what is about to be written, goes on the list of offers before anything goes over
 * it, and the tab that moved it shows it as an offer at once. Without that, a paragraph typed
 * in one tab was gone at the first letter typed in the other. As a page writes a newer text it
 * takes its own earlier one off that list, which is what the mark is for, and a page is never
 * offered its own boxes. The tab that saves second is refused by the site. Two tabs each
 * writing a new post share a place the same way, and nothing refuses either of them.
 *
 * A text kept for a post that has since been deleted has no boxes to go back into, and no
 * other page opens that post's id. So the page that says the post is not on the site shows
 * the text, and "take it to a new post" puts it on offer where a new post is written.
 *
 * While a save is on its way the boxes are read only and an image is turned away, so the boxes
 * cannot come to hold more than the save carried. While an image is uploading, save waits.
 *
 * What this cannot do, and does not pretend to:
 *   A page drawn by the server and then woken takes over what the one line boxes and the tick
 *   hold at that moment. That is the writer's doing only if nothing else moves them first, so
 *   the tick is marked autoComplete off: a browser that comes back to the page, or loads it
 *   again, would otherwise put the tick of the page it had before over the one the site sent.
 *   The big text box cannot be taken over: by the time any code here runs, React has put the
 *   server's text back, so words typed in it before the script loaded are lost.
 *   A browser with storage switched off keeps nothing, and one that is full keeps nothing
 *   more. The editor works, and says "copy it" where it would have said "it is kept". When
 *   the browser will not take a text into the offers, it stays where it is and nothing is
 *   written over it. One found that way on arrival is offered from the place it is in, and
 *   nothing typed is kept until the writer has put it back or thrown it away.
 *   Two tabs that write in the very same instant are not kept apart. Each reads the list and
 *   writes it back, and a browser gives a page no lock to hold in between.
 *   A tab does not hear what another tab did. An offer drawn on one tab stays on its screen,
 *   still saying the browser did not see the text saved, after another tab has saved that very
 *   text or thrown it away, until the page is loaded again. Nothing is lost by it: a save from
 *   the tab that fell behind is refused by the site, and says why.
 *
 * With JavaScript switched off none of the keeping runs, and the form still posts. A refusal
 * then comes back with what was in the boxes, and the page is drawn again with them filled in
 * and the answer at the top of the form as well as above the button, since nothing can scroll
 * to it. A save that worked says so, with a link back to the desk, since nothing can move the
 * page on. One thing is lost that way: after the sign in has run out, a save pressed with
 * JavaScript off comes back as the sign in, and what was typed is not shown again. Showing the
 * editor to someone who is not signed in would put the stored draft in the page.
 */
export default function Editor({ post, lost }: { post?: Post; lost?: Lost }) {
  const router = useRouter();
  const [state, save, saving] = useActionState(savePost, undefined);
  /**
   * What this page is, settled when it is first drawn and not looked up again. The page above
   * hands over a newer post when a save has gone through, and the boxes do not follow it, so
   * neither may the stamp: a stamp newer than the boxes would let old text be saved over the post.
   * When the page arrives holding a refused save, the stamp is the one that save carried, not
   * the one of the post as it was read afterwards, for the same reason.
   */
  const [page] = useState(() => {
    const back = state && "error" in state ? state : null;
    return {
      id: post?.id ?? lost?.id,
      opened: back ? back.opened : post?.updated_at ?? "",
      /** the newest version of the post this page knows of: the one it read, or failing that the one its boxes carry */
      seen: post?.updated_at ?? (back ? back.opened : ""),
      /** the post as opened, to compare kept texts with. null when the page could not read one. */
      stored: post ? boxesOf(post) : lost ? null : EMPTY,
      /** with no post and no refused save to draw the boxes from, there is no form: see below */
      form: Boolean(post) || !lost || back !== null,
      lost,
      arrivedWith: state,
    };
  });
  const [f, setF] = useState<Fields>(() => (state && "error" in state ? state.fields : page.stored ?? EMPTY));
  const [offers, setOffers] = useState<Unsaved[]>([]);
  /** on the page for a new post: the other posts this browser keeps a text for */
  const [elsewhere, setElsewhere] = useState<{ id: string; title: string }[]>([]);
  /** images not yet in the text */
  const [uploads, setUploads] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  /** the script is running. nothing drawn before this may promise what only the script can do. */
  const [awake, setAwake] = useState(false);
  /** whether the boxes are written down in this browser: yes, no because it refused, or there was nothing typed to write */
  const [keptHere, setKeptHere] = useState<"yes" | "no" | "nothing">("nothing");
  /** an offer that could not be swapped in, because the browser would not store what it would have replaced */
  const [stuck, setStuck] = useState<Unsaved | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const tick = useRef<HTMLInputElement>(null);
  const cover = useRef<HTMLInputElement>(null);
  const answer = useRef<HTMLElement | null>(null);
  const atAnswer = (el: HTMLElement | null) => { answer.current = el; };
  /** where the caret has to go once an image has written itself into the text */
  const caret = useRef<number | null>(null);
  /** an untouched text box says its caret is at 0, which is not where anybody put it */
  const hadCaret = useRef(false);
  /** nothing is kept in the browser until something has been typed. boxes that came back with a refused save were. */
  const typed = useRef(Boolean(state && "error" in state));
  const typedAt = useRef<string | null>(null);
  /** what the save now on its way was sent with */
  const sent = useRef<Fields | null>(null);
  /** see `by` above. null until this page has written something down. */
  const mark = useRef<string | null>(null);
  /**
   * An older text still in the first place, because the browser would not move it on arrival.
   * It is offered from there, and while it is, nothing is written to that place: the offer
   * says so, and the boxes would go over it.
   */
  const unmoved = useRef<Unsaved | null>(null);
  /** that text once the boxes have taken it. The place is then theirs to write in, though they may differ from it by an address. */
  const taken = useRef<Unsaved | null>(null);
  /**
   * An offer the boxes have just taken. It stays on the list until the boxes are written down,
   * and is not shown meanwhile. Taken off first, it was in no place at all when the browser
   * then refused the boxes, and a closed tab lost it.
   */
  const leaving = useRef<Unsaved | null>(null);
  const KEY = `desk:unsaved:${page.id ?? "new"}`;
  const OFFERS = `desk:offered:${page.id ?? "new"}`;
  const OFFERS_OF_NEW = "desk:offered:new";

  const touch = () => { typed.current = true; typedAt.current = new Date().toISOString(); };
  const set = <K extends keyof Fields>(name: K, value: Fields[K]) => { touch(); setF((old) => ({ ...old, [name]: value })); };
  /** this page's mark, made in the browser the first time it writes something down */
  const me = () => (mark.current ??= `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
  /**
   * The offers as this page shows them. Its own boxes are never among them: another tab may
   * have moved them to the list while this one stayed open. Nor is an offer the boxes have
   * taken and not yet written down. A text that could not be moved on arrival is not on the
   * list, and is shown after it.
   */
  const show = (list: Unsaved[]) => setOffers([
    ...list.filter((o) => o.by !== mark.current && !(leaving.current && sameOffer(o, leaving.current))),
    ...(unmoved.current ? [unmoved.current] : []),
  ]);
  /**
   * The boxes are written to the one kept place. Another tab on the same post writes there too,
   * so the place is looked at first, every time. A text in it that this page did not write, and
   * that says neither what the post says nor what is about to be written, goes on the list of
   * offers before anything goes over it: written over, a paragraph typed in a tab since closed
   * would be nowhere. A page takes its own earlier text off that list as it writes a newer one,
   * so two tabs typed in turn each have one text there and no more.
   */
  const keep = (fields: Fields) => {
    try {
      if (unmoved.current) throw new Error("an older text is in the place, and has not been answered");
      const there = readOne(KEY);
      const own = there?.by === me() || Boolean(there && taken.current && sameOffer(there, taken.current));
      let list: Unsaved[] | null = null;
      if (there && !own && !sameText(there.fields, fields) && !(page.stored && sameText(there.fields, page.stored))) {
        list = [...readList(OFFERS).filter((o) => !sameText(o.fields, there.fields)), there];
        // If the browser will not take it, this throws, and the text stays where it is with
        // nothing written over it. The next write looks again, and moves it once it can.
        writeList(OFFERS, list);
        show(list);
      }
      localStorage.setItem(KEY, JSON.stringify({ at: typedAt.current ?? new Date().toISOString(), over: page.id ? page.opened : null, by: me(), fields } satisfies Unsaved));
      setKeptHere("yes");
      if (leaving.current) {
        // the boxes that took an offer are written down, so only now does it leave the list
        const out = leaving.current;
        leaving.current = null;
        try {
          const all = readList(OFFERS);
          const rest = all.filter((o) => !sameOffer(o, out));
          if (rest.length !== all.length) writeList(OFFERS, rest);
        } catch { /* then it stays, and is offered once more than it need be */ }
      }
      if (!own) {
        // The place was empty or another tab's, so this page's earlier text may be on the list,
        // moved there by that tab. What was just written is newer, and only now that it is
        // written does the earlier one leave: taken off first, it would be nowhere if the
        // browser had then refused the newer text.
        const all = list ?? readList(OFFERS);
        const rest = all.filter((o) => o.by !== me());
        if (rest.length !== all.length) try { writeList(OFFERS, rest); } catch { /* then it stays, and is offered once more than it need be */ }
      }
    } catch {
      setKeptHere("no");
    }
  };
  /**
   * Save was pressed. The boxes are written down now and not only when an answer comes, because
   * none may: the connection can drop, and the editor is then off the screen.
   */
  const pressed = () => {
    sent.current = f;
    if (typed.current) keep(f);
  };
  /**
   * Has the post been saved again since this text was typed over it? "no", "yes", or "unknown"
   * when the desk cannot tell: the text was kept before the desk noted versions, its stamp
   * says nothing, or it was typed over a version newer than any this page knows of. Both
   * stamps are the site's own, so no browser's clock comes into it, and nothing is said about
   * when the words were typed: a tab left open can be typed in long after the post was saved
   * somewhere else.
   */
  const since = (o: Unsaved): "no" | "yes" | "unknown" => {
    if (page.id === undefined) return "no";
    if (o.over && o.over === page.seen) return "no";
    return Date.parse(o.over ?? "") < Date.parse(page.seen) ? "yes" : "unknown";
  };

  useEffect(() => { setAwake(true); }, []);

  // A page drawn by the server can be typed in before this script has loaded. React keeps what
  // the one line boxes and the tick hold then, and knows nothing about it: at the next letter
  // typed anywhere they snapped back. So what they hold is taken over here, and counts as typed.
  useLayoutEffect(() => {
    const el = form.current;
    if (!el) return;
    for (const name of ONE_LINE) {
      const box = el.elements.namedItem(name);
      if (box instanceof HTMLInputElement && box.value !== f[name]) set(name, box.value);
    }
    if (tick.current && tick.current.checked !== f.published) set("published", tick.current.checked);
    // once, as the page wakes
  }, []);

  // React puts a form back to its defaults when its action answers, and the default of a tick is
  // whatever it was when the page was drawn. After a refused save the tick went back to what the
  // site holds, and the next save sent that. So the default is kept in step with the tick.
  useLayoutEffect(() => { if (tick.current) tick.current.defaultChecked = f.published; }, [f.published]);

  // the cover's rule is set from what the box holds, not from the last key pressed in it, so a
  // value that arrives any other way is judged too, and a slip that has gone is forgiven
  useLayoutEffect(() => {
    const value = f.cover_url.trim();
    cover.current?.setCustomValidity(value && !coverFits(value) ? COVER_RULE : "");
  }, [f.cover_url]);

  // on arrival: is there something here that was typed and never seen to save? It moves to the
  // offers, and its first place is free for this sitting's typing. Where React runs every
  // effect twice, the second run finds this sitting's own boxes in that place, and they are
  // told apart from an older text below.
  useEffect(() => {
    if (!page.form) {
      // A post that is not on the site has no boxes for a kept text to go back into. What is
      // kept for it is looked for and left where it is, and the page shows it when it is
      // the page that says the post is gone. Nothing is moved by looking.
      try {
        const listed = readList(OFFERS);
        const first = readOne(KEY);
        setOffers((first && !listed.some((o) => sameText(o.fields, first.fields)) ? [...listed, first] : listed).filter((o) => !sameText(o.fields, EMPTY)));
      } catch { /* storage is switched off, and the page says what it says without it */ }
      return;
    }
    try {
      const mine = readOne(KEY);
      const before = readList(OFFERS);
      // a text that says what the post says is on the site already, and is not an offer
      const listed = before.filter((o) => !(page.stored && sameText(o.fields, page.stored)));
      let list = listed;
      if (mine) {
        const isThePost = page.stored !== null && sameText(mine.fields, page.stored);
        // nor are the boxes this page arrived holding, which are about to be written down again
        if (!isThePost && !sameText(mine.fields, f)) list = [...listed.filter((o) => !sameText(o.fields, mine.fields)), mine];
      }
      try {
        // into its new place first, and out of the old one only once that has worked
        if (mine || list.length !== before.length) writeList(OFFERS, list);
        if (mine) localStorage.removeItem(KEY);
      } catch {
        // The browser can be read and will take no more. A text that was to be moved is still
        // in the first place, and this sitting's typing must not go over it, so nothing is
        // written there until it has been answered. It is offered from where it is, after the
        // offers already on the list: left unseen, it was promised back and never shown.
        if (mine && list !== listed) unmoved.current = mine;
      }
      setOffers(list);
    } catch {
      // storage is switched off, and the desk works without it
    }
    // once, as the page wakes
  }, []);

  // The page for a new post is where "Write something" leads, and it looks in this browser for
  // more than its own text. What is kept for another post is shown only where that post is
  // opened, and nothing on the desk leads to a post that has been deleted. So this page says
  // which posts this browser keeps a text for, with a link to each. It only looks.
  useEffect(() => {
    if (page.id !== undefined) return;
    try {
      const found = new Map<string, string>();
      // sorted, every desk:offered comes before any desk:unsaved, so the text typed last has the last word on the title
      for (const key of Object.keys(localStorage).sort()) {
        const [, place, id] = /^desk:(unsaved|offered):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(key) ?? [];
        if (!id) continue;
        const texts = (place === "unsaved" ? [readOne(key)] : readList(key)).filter((one): one is Unsaved => one !== null && !sameText(one.fields, EMPTY));
        if (texts.length) found.set(id, texts[texts.length - 1].fields.title);
      }
      setElsewhere([...found].sort(([a], [b]) => a.localeCompare(b)).map(([id, title]) => ({ id, title })));
    } catch { /* storage is switched off, and the page opens without it */ }
    // once, as the page wakes
  }, []);

  // every change is kept in this browser, whether or not an older text is on offer
  useEffect(() => { if (typed.current) keep(f); }, [f]);

  // A refused save writes the boxes down again at once. Another tab on the same post may have
  // taken the one shared place and then emptied it with its own save, and a tab closed now
  // must lose nothing.
  useEffect(() => {
    if (state && "error" in state && typed.current) keep(f);
  }, [state]);

  // It saved, and it is back to the desk. The kept text goes only if it is still what that save
  // carried. If a box has come to hold more since, the text stays and is offered next time. The
  // editor does not stay to save again: a new post has no id until the page is drawn again, so
  // a second save from here would be a second post.
  useEffect(() => {
    if (!state || !("saved" in state)) return;
    try {
      const carried = sent.current;
      const mine = readOne(KEY);
      if (mine && carried && sameText(mine.fields, carried) && mine.fields.published === carried.published) localStorage.removeItem(KEY);
      // Another tab may have moved this very text to the list of offers. The site holds it now,
      // and an offer of it would say the browser never saw it saved.
      const list = readList(OFFERS);
      const left = carried ? list.filter((o) => !sameText(o.fields, carried)) : list;
      if (left.length !== list.length) writeList(OFFERS, left);
    } catch { /* as above */ }
    router.push("/admin");
  }, [state, KEY, router]);

  // an answer that arrives is brought into view. Enter in the title box sends a save from the
  // top of the page, and the answer is drawn above the button at the bottom of it.
  useEffect(() => {
    if (state && state !== page.arrivedWith) answer.current?.scrollIntoView({ block: "nearest" });
  }, [state, page]);

  // after an image lands, the caret sits just after it, so a second image lands beside the
  // first and typing carries on where it was
  useLayoutEffect(() => {
    if (caret.current === null || !ta.current) return;
    ta.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [f.body_md]);

  const refusal = state && "error" in state ? state : null;
  const done = state && "saved" in state ? state : null;
  /** a save is on its way, or has gone through and the page is moving on: nothing here may change */
  const locked = saving || (awake && done !== null);

  /** drop an image anywhere in the text and it uploads, then writes itself in at the cursor */
  async function upload(files: File[]) {
    const lines: string[] = [];
    const note = (line: string) => { lines.push(line); setNotes([...lines]); };
    setNotes([]);
    const images = files.filter((file) => {
      if (file.type.startsWith("image/")) return true;
      note(`${file.name} was left out. The browser does not call it an image, and only images go in.`);
      return false;
    });
    // counted, so the note and the wait on the save button last until the last one is in
    let left = images.length;
    setUploads((n) => n + images.length);
    try {
      for (const file of images) {
        if (file.size > MAX_IMAGE) { note(`${file.name} is over 4MB, which is more than the site takes. Make it smaller and drop it in again.`); left--; setUploads((n) => n - 1); continue; }
        const fd = new FormData();
        fd.append("file", file);
        let url = "";
        try {
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.url) { note(json?.error ?? `That did not upload. The site answered ${res.status}.`); break; }
          url = json.url;
        } catch {
          note("That did not upload. The connection dropped.");
          break;
        }
        const md = `\n\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n\n`;
        // built from the text as it is now, not as it was when the image was dropped. otherwise
        // anything typed during the upload is lost, and of two images only the second survives.
        const el = ta.current;
        touch();
        setF((old) => {
          // a text box that never had the caret gets the image at the end, not above its first line
          const at = hadCaret.current ? Math.min(el?.selectionStart ?? old.body_md.length, old.body_md.length) : old.body_md.length;
          caret.current = at + md.length;
          return { ...old, body_md: old.body_md.slice(0, at) + md + old.body_md.slice(at) };
        });
        left--;
        setUploads((n) => n - 1);
      }
    } finally {
      // whatever happened to an upload, the ones that will now not happen are no longer counted
      if (left) setUploads((n) => n - left);
    }
  }
  /** files dropped or pasted in. while nothing here may change they are turned away, with a line saying why. */
  function takeIn(files: File[]) {
    if (!locked) return void upload(files);
    setNotes([saving
      ? "A save is on its way, so nothing new was taken in. Drop or paste it again when the save has answered."
      : "This page has saved and is moving on, so nothing new was taken in."]);
  }

  /** a swap: what was typed in this sitting goes on offer before the boxes take the older text */
  function putBack(o: Unsaved) {
    const mine: Unsaved | null = typed.current && !sameText(f, o.fields) && !(page.stored && sameText(f, page.stored))
      ? { at: typedAt.current ?? new Date().toISOString(), over: page.id ? page.opened : null, fields: f }
      : null;
    let list: Unsaved[] | null = null;
    try {
      // The offer itself is left on the list. It comes off in keep(), once the boxes that took
      // it are written down, so there is no moment at which it is in neither place.
      list = readList(OFFERS);
      if (mine) {
        list = [...list.filter((x) => !sameText(x.fields, mine.fields) || sameOffer(x, o)), mine];
        writeList(OFFERS, list);
      }
    } catch {
      // nothing is put back over text the browser would not keep
      if (mine) return setStuck(o);
      list = null;
    }
    // A text that never left the first place stays there as the boxes take it, and the boxes are
    // written over it from now on. Taken out first, it would be in no place at all if the browser
    // then refused the boxes.
    if (o === unmoved.current) { unmoved.current = null; taken.current = o; } else leaving.current = o;
    if (list) show(list); else setOffers((old) => old.filter((x) => x !== o));
    setStuck(null);
    touch();
    // never the tick. and the address only when the post has not been saved again since: it may have moved.
    setF((old) => ({ ...old, title: o.fields.title, tags: o.fields.tags, excerpt: o.fields.excerpt, cover_url: o.fields.cover_url, body_md: o.fields.body_md, slug: since(o) === "no" ? o.fields.slug : old.slug }));
  }
  function throwAway(o: Unsaved) {
    if (o === unmoved.current) {
      // it never left the first place, so that is where it is thrown away from, and the place is free again
      try {
        const first = readOne(KEY);
        if (first && sameOffer(first, o)) localStorage.removeItem(KEY);
      } catch { /* what could not be removed is offered again the next time the page is opened */ }
      unmoved.current = null;
      // what was typed while the place was taken has been in the boxes only, and is written down now
      if (typed.current) keep(f);
      return setOffers((old) => old.filter((x) => x !== o));
    }
    try {
      const list = readList(OFFERS).filter((x) => !sameOffer(x, o));
      writeList(OFFERS, list);
      show(list);
    } catch {
      setOffers((old) => old.filter((x) => x !== o));
    }
  }

  /** on the page of a post that is gone: this text leaves both of the places it may be kept in */
  function forget(o: Unsaved) {
    try {
      const first = readOne(KEY);
      if (first && sameText(first.fields, o.fields)) localStorage.removeItem(KEY);
      const list = readList(OFFERS);
      if (list.some((x) => sameOffer(x, o))) writeList(OFFERS, list.filter((x) => !sameOffer(x, o)));
    } catch { /* what could not be removed is shown again the next time the page is opened */ }
    setStuck(null);
    setOffers((old) => old.filter((x) => x !== o));
  }
  /** a post that is gone cannot take its text back, so the text goes on offer where a new post is written */
  function toNewPost(o: Unsaved) {
    try {
      // into its new place first, and out of the old one only once that has worked
      writeList(OFFERS_OF_NEW, [...readList(OFFERS_OF_NEW).filter((x) => !sameText(x.fields, o.fields)), { ...o, gone: true }]);
    } catch {
      return setStuck(o);
    }
    forget(o);
    router.push("/admin/new");
  }

  const savedLine = (bottom: boolean) => done ? (
    <p role="status" ref={bottom ? atAnswer : undefined} className={`m-0 ${said}`}>
      Saved. "{done.title}" is {done.published
        ? <>live at <a href={`/blog/${done.slug}`} className="underline underline-offset-[3px]">/blog/{done.slug}</a></>
        : <>a draft, so only the desk shows it. Its address is /blog/{done.slug}</>}. <a href="/admin" className="underline underline-offset-[3px]">Back to the desk.</a>
    </p>
  ) : null;

  // The page could not hand over a post, and no refused save came back with boxes to draw. A
  // form here would be empty boxes over the post's id, and one press of save would write an
  // empty post over the real one. So there is no form, only what happened.
  if (!page.form) {
    if (done) return <div className="mt-6">{savedLine(true)}</div>;
    if (page.lost?.reason !== undefined) return (
      <div role="alert" className={`mt-6 ${said} font-bold`}>
        <p className="m-0">The database did not answer, so this post could not be opened. Nothing was changed. Load the page again in a moment. ({page.lost.reason})</p>
        <p className="m-0 mt-2 font-mono text-[11px] tracking-[.1em] uppercase font-normal"><a href={`/admin/edit/${page.id}`} className="underline underline-offset-[3px]">load this page again</a></p>
      </div>
    );
    // Whatever this browser still keeps for the post is shown under the sentence, once the
    // script has looked. It was offered nowhere: no other page opens the id of a post that is gone.
    return (
      <div className="mt-6 grid gap-4">
        <p className={`m-0 ${said}`}>This post is not on the site. It may have been deleted.</p>
        {offers.map((o, i) => (
          <div key={`${o.at} ${i}`} role="status" className={`grid gap-2 ${said}`}>
            {/* A text with nothing in the big box gets no box, and its smaller boxes are said in words: a sentence that pointed at an empty box was untrue. */}
            <p className="m-0">
              {[
                `Something was typed for it here ${Number.isNaN(Date.parse(o.at)) ? "earlier" : `on ${when(o.at)}`}, and this browser did not see it saved.`,
                o.fields.title && `Its title was "${o.fields.title}".`,
                o.fields.body_md ? "Its text is in the box below." : "It has no text.",
                !o.fields.body_md && smallBoxes(o.fields),
                'To keep it, press "take it to a new post". The page for a new post opens with it on offer, to put back and save.',
              ].filter(Boolean).join(" ")}
            </p>
            {o.fields.body_md ? <textarea readOnly rows={8} value={o.fields.body_md} aria-label="The text that was typed" className="bg-chalk border border-[#C9C4B2] px-3 py-3 font-mono text-[13.5px] leading-[21px] text-ink resize-y" /> : null}
            {stuck === o ? <p role="alert" className="m-0 font-bold">This browser would not store it in its new place, so it is still here and nowhere else. Copy it from {o.fields.body_md ? "the box" : "this page"}.</p> : null}
            <p className="m-0 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] tracking-[.1em] uppercase">
              <button type="button" className="uppercase underline underline-offset-[3px] py-1" onClick={() => toNewPost(o)}>take it to a new post</button>
              <button type="button" className="uppercase underline underline-offset-[3px] py-1" onClick={() => forget(o)}>throw it away</button>
            </p>
          </div>
        ))}
      </div>
    );
  }

  /** the answer to the last save. drawn above the button, and at the top of the form too on a page that arrived holding it. */
  const answered = (bottom: boolean) => refusal ? (
    <div role="alert" ref={bottom ? atAnswer : undefined} className={`${said} font-bold`}>
      <p className="m-0">{refusal.error}</p>
      {refusal.stale ? (
        <>
          {/* what became of the typing. only the script can have kept it, so only the script says it did. */}
          {!awake ? <noscript><p className="m-0 mt-2">If you typed something here, copy it before you load the page again, then paste it in.</p></noscript>
            : keptHere === "yes" ? <p className="m-0 mt-2">What you typed is also kept in this browser. Load the page again and it is offered back, to put on top of the post as it is now, unless the post already says the same.</p>
            : keptHere === "no" ? <p className="m-0 mt-2">This browser would not keep what you typed. Copy it before you load the page again, then paste it in.</p>
            : null}
          {/* a plain link. after a form posted without JavaScript, the browser's own reload would post it again. */}
          <p className="m-0 mt-2 font-mono text-[11px] tracking-[.1em] uppercase font-normal"><a href={`/admin/edit/${page.id}`} className="underline underline-offset-[3px]">load this page again</a></p>
        </>
      ) : null}
    </div>
  ) : savedLine(bottom);

  return (
    <form ref={form} action={save} onSubmit={pressed} className="mt-6 grid gap-4">
      {page.id ? (
        <>
          <input type="hidden" name="id" value={page.id} />
          {/* which version of the post these boxes were typed over. the site refuses a save from a page older than the post. */}
          <input type="hidden" name="opened" value={page.opened} />
        </>
      ) : null}

      {state && state === page.arrivedWith ? answered(false) : null}

      {offers.map((o, i) => (
        <div key={`${o.at} ${i}`} role="status" className={said}>
          <p className="m-0">Something was typed {o.gone ? "" : "here "}{Number.isNaN(Date.parse(o.at)) ? "earlier" : `on ${when(o.at)}`}{o.gone ? " for a post that is no longer on the site" : ""}, and this browser did not see it saved.</p>
          {since(o) === "yes" ? <p className="m-0 mt-2">It was typed over an older version of this post. Putting it back and then saving would write over what was saved after that version. The address is left as it is now.</p>
            : since(o) === "unknown" ? <p className="m-0 mt-2">The desk cannot tell whether this post has been saved again since this was typed over it. If it has, putting this back and then saving would write over that. The address is left as it is now.</p>
            : null}
          {o.fields.published !== f.published ? <p className="m-0 mt-2">Published was {o.fields.published ? "ticked" : "not ticked"} then. The tick is left as it is now.</p> : null}
          {o === unmoved.current ? <p className="m-0 mt-2">This browser would not move it out of the place where what is typed on this page is kept, so nothing typed here now is kept. Put it back or throw it away before typing anything.</p> : null}
          {stuck === o ? <p role="alert" className="m-0 mt-2 font-bold">This browser would not keep what is in the boxes now, so nothing was put back over it. Save what is in the boxes, or copy it somewhere, then load the page again and put this back before typing anything.</p> : null}
          {/* a button does not take its capitals from the row it sits in, so each asks for them itself */}
          <p className="m-0 mt-2 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] tracking-[.1em] uppercase">
            <button type="button" disabled={locked} className="uppercase underline underline-offset-[3px] py-1 disabled:opacity-60" onClick={() => putBack(o)}>put it back</button>
            <button type="button" disabled={locked} className="uppercase underline underline-offset-[3px] py-1 disabled:opacity-60" onClick={() => throwAway(o)}>throw it away</button>
          </p>
        </div>
      ))}

      {elsewhere.map(({ id, title }) => (
        <p key={id} role="note" className={`m-0 ${said}`}>
          Something typed for another post{title ? `, "${title}",` : ""} is kept in this browser, which did not see it saved. It can be had back on that post's own page, unless the post already says the same.{" "}
          <a href={`/admin/edit/${id}`} className="font-mono text-[11px] tracking-[.1em] uppercase underline underline-offset-[3px]">open that post</a>
        </p>
      ))}

      <label className="grid gap-1">
        <span className={label}>Title</span>
        <input name="title" required readOnly={locked} value={f.title} onChange={(e) => set("title", e.target.value)}
          className="bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[15px] text-ink" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className={label}>Address on the site</span>
          <input name="slug" readOnly={locked} value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="left blank, it makes one from the title"
            className="bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[13px] text-ink" />
        </label>
        <label className="grid gap-1">
          <span className={label}>Tags, separated by commas. Up to eight.</span>
          <input name="tags" readOnly={locked} value={f.tags} onChange={(e) => set("tags", e.target.value)}
            className="bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[13px] text-ink" />
        </label>
      </div>

      <label className="grid gap-1">
        <span className={label}>One line for the list page</span>
        <input name="excerpt" readOnly={locked} value={f.excerpt} onChange={(e) => set("excerpt", e.target.value)}
          className="bg-chalk border border-[#C9C4B2] px-3 py-2 text-[14px] text-ink" />
      </label>

      <label className="grid gap-1">
        <span className={label}>Cover image address, optional</span>
        {/* the same rule the site keeps, asked here first so a slip is caught with the page still as it was */}
        <input ref={cover} name="cover_url" readOnly={locked} value={f.cover_url} title={COVER_RULE} onChange={(e) => set("cover_url", e.target.value)}
          className="bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[12px] text-ink" />
      </label>

      <div className="grid gap-1">
        <span className={label}>
          The post. Drag an image straight in, or paste one. Up to 4MB each.
        </span>
        <textarea
          ref={ta} name="body_md" readOnly={locked} value={f.body_md} onChange={(e) => set("body_md", e.target.value)}
          onFocus={() => { hadCaret.current = true; }}
          onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); takeIn(Array.from(e.dataTransfer.files)); } }}
          onPaste={(e) => { const files = Array.from(e.clipboardData.files); if (files.length) { e.preventDefault(); takeIn(files); } }}
          rows={22}
          className="bg-chalk border border-[#C9C4B2] px-3 py-3 font-mono text-[13.5px] leading-[21px] text-ink resize-y"
        />
        {uploads > 0 && <span role="status" className="font-mono text-[11px] text-ultra-deep">{uploads === 1 ? "uploading the image" : `uploading ${uploads} images`}</span>}
        {notes.map((line, i) => <span key={i} role="alert" className="font-mono text-[11px] text-ink font-bold">{line}</span>)}
      </div>

      <label className="flex items-center gap-2 font-mono text-[12px]">
        {/* autoComplete off tells the browser not to put this tick back by itself. After the Back
            button it fetched the page again and then set the tick to what the old page had, and
            the take over as the page wakes counted that as the writer's. */}
        <input ref={tick} type="checkbox" name="published" autoComplete="off" disabled={locked} checked={f.published} onChange={(e) => set("published", e.target.checked)} />
        <span>Published. Leave this off to keep it as a draft only you can see.</span>
      </label>

      {answered(true)}

      <div className="flex flex-wrap items-center gap-3">
        {/* the first submit button in the form is the one Enter presses, so it has to be the plain save */}
        <button disabled={locked || uploads > 0} className="bg-inkpanel text-chalk font-mono text-[11px] tracking-[.1em] uppercase px-5 py-3 disabled:opacity-60">
          {uploads > 1 ? "waiting for the images" : uploads > 0 ? "waiting for the image" : saving ? "saving" : "save"}
        </button>
        {/* shown once the site has said the post is gone. a new post is only ever made by this press. */}
        {refusal?.gone ? (
          <button name="as_new" value="1" disabled={locked || uploads > 0} className="border border-ink text-ink font-mono text-[11px] tracking-[.1em] uppercase px-5 py-3 disabled:opacity-60">save it as a new post</button>
        ) : null}
      </div>
    </form>
  );
}
