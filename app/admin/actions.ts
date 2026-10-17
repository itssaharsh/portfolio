"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireDesk, passwordMatches, startSession, endSession, authConfigured, tooManyWrongGuesses, noteWrongGuess, callerOf } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { slugify, toPlainText, readingTime } from "@/lib/posts";
import type { Post } from "@/lib/store/types";
import { coverFits, tidyTags, SUMMARY_MAX } from "@/scripts/post-text.mjs";

export async function signIn(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  if (!authConfigured()) return "ADMIN_PASSWORD and SESSION_SECRET are not set yet.";
  const caller = callerOf(await headers());
  if (tooManyWrongGuesses(caller)) return "Too many wrong passwords. Wait a minute and try again.";
  const given = String(formData.get("password") ?? "");
  if (!passwordMatches(given)) {
    noteWrongGuess(caller);
    await new Promise((r) => setTimeout(r, 400));
    return "That is not the password.";
  }
  await startSession();
  redirect("/admin");
}

export async function signOutAction() {
  await endSession();
  redirect("/admin/login");
}

/** what was in the boxes when save was pressed */
export type Fields = { title: string; slug: string; tags: string; excerpt: string; cover_url: string; body_md: string; published: boolean };
/**
 * What a save comes back with: word that it went through, with which post it was, where it is
 * and whether it is out, or a sentence for the writer together with everything that was in the
 * boxes and the stamp the form carried. The boxes and the stamp come back so that the page
 * can be drawn again with them when the browser has JavaScript switched off and holds nothing
 * itself. `stale` marks a save refused because the page is older than the post. `gone` says the
 * post the form is for is no longer on the site, and the editor shows "save it as a new post"
 * for as long as an answer carries it. So it comes back with every refusal of a form sent by
 * that button, whatever the reason, unless the site looked and found the post.
 */
export type SaveState =
  | { error: string; fields: Fields; opened: string; stale?: true; gone?: true }
  | { saved: true; title: string; slug: string; published: boolean }
  | undefined;

const plain = (text: string) => text.replace(/\r\n?/g, "\n");
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Saves what is in the editor.
 *
 * It never throws for anything the writer can put right or try again. A throw replaces the
 * editor with an error page, and everything typed goes with it, which is the worst thing a
 * writing desk can do. So a refused cover, a taken address, a database that is asleep and a
 * sign in that has run out all come back as a sentence, and the editor shows it with the text
 * still in place. The proxy lets every POST through for this reason: turned away there, a save
 * never got here to be answered. It does not redirect either: it says it saved, and the editor
 * moves on.
 *
 * It does not write blind. A page carries the stamp of the post it was opened on, the post's
 * updated_at as the page was drawn, and a save from a page older than the post is refused, so
 * an old picture of a post cannot be written over a newer one. A post that was deleted while
 * its editor was open is not brought back, unless the writer asks for it as a new post. And a
 * new post that is already on the site, word for word, is not put up a second time.
 */
export async function savePost(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const text = (name: string) => String(formData.get(name) ?? "");
  // A browser sends a text box with CR LF line endings. Stored that way, the post would never
  // again compare equal to the file it came from, so they are made plain as the box is read.
  const fields: Fields = {
    title: text("title"), slug: text("slug"), tags: text("tags"), excerpt: text("excerpt"), cover_url: text("cover_url"),
    body_md: plain(text("body_md")), published: formData.get("published") === "on",
  };
  // the stamp goes back with the boxes: they were typed over that version and no other
  const opened = text("opened");
  const id = text("id").trim() || undefined;
  // Sent by "save it as a new post", which the editor shows once the site has said the post is
  // gone. Until the site has looked and found the post after all, every refusal says so again,
  // or that button would go, and plain save can only be told once more that the post is gone.
  let asNew = Boolean(id) && text("as_new") === "1";
  const no = (error: string, why: { stale?: true; gone?: true } = {}): SaveState => ({ error, fields, opened, ...(asNew ? { gone: true as const } : {}), ...why });
  /** the button to press again, by the name it has on the page */
  const save = () => (asNew ? '"save it as a new post"' : "save");
  const asleep = (e: unknown) => no(`The database did not answer, so nothing was saved. Press ${save()} again in a moment. (${e instanceof Error ? e.message : "no reason given"})`);

  // the proxy does not stand in front of a Server Action, so this checks for itself, like every action
  try {
    await requireDesk();
  } catch {
    return no(`You are signed out, so nothing was saved. Sign in again in another tab, then press ${save()} here. What you typed is still on this page.`);
  }
  const store = getStore();

  const title = text("title").trim() || "Untitled";
  const body_md = fields.body_md;
  const published = fields.published;
  const body_text = toPlainText(body_md);
  // the same rule /api/posts keeps, so the desk cannot store a cover the command cannot put back
  const cover_url = text("cover_url").trim() || null;
  if (cover_url && !coverFits(cover_url)) {
    return no("Nothing was saved. The cover has to be an address that starts with http or https, or a path on this site that starts with a slash.");
  }

  let old: Post | null = null;
  try {
    old = id ? await store.getById(id) : null;
  } catch (e) {
    return asleep(e);
  }
  // The form is for a post that is no longer there. Saving it as a new post without being
  // asked would bring back a post that was deleted on purpose, which is a guess. So it is said,
  // and the editor offers a second button that sends as_new. That field means nothing while
  // the post is still there.
  if (old) asNew = false;
  if (id && !old && !asNew) {
    return no('This post is no longer on the site. It was deleted after this page was opened, so nothing was saved. What you typed is still on this page. To keep it, press "save it as a new post". The address is made again, so it may not be exactly the one it had.', { gone: true });
  }
  // The post was saved again after this page was drawn: from another tab, from the command
  // line, or by a save from this very page whose answer never arrived. The two stamps are
  // compared here, as text. In a query the page's stamp would match almost never, because the
  // column keeps finer time than the text a page is given.
  if (old && opened !== old.updated_at) {
    return no(opened
      ? "This post was saved again after this page was opened, so nothing was saved now. Saving from this page would write over that newer version."
      : "The desk could not tell which version of this post the page was opened on, so nothing was saved. Saving from this page could write over a newer version.", { stale: true });
  }

  // An address that is already stored is kept exactly as it is, however it was once typed.
  // Tidying it again on every save moved a live post: an address cut at 80 characters lost
  // its last dash on the second save, and whatever linked to it found nothing.
  const typed = text("slug").trim();
  const slug = old && typed === old.slug ? old.slug : slugify(typed) || slugify(title);
  if (!slug) return no("Nothing was saved. That title has no letters or numbers to make an address from, so type one in the address box.");
  const excerpt = text("excerpt").trim().slice(0, SUMMARY_MAX) || null;
  // tidied the way /api/posts tidies them, so a copy the command keeps can carry them exactly
  const tags = tidyTags(text("tags").split(","));

  if (!old) {
    // A new post. A save can reach the database and lose its answer on the way back, and the
    // writer then sends the same post again. So before anything is written, look for this
    // title over this text among every post, drafts included, which getBySlug does not see.
    let all: Post[];
    try {
      all = await store.listAll();
    } catch (e) {
      return asleep(e);
    }
    const twins = all.filter((p) => p.title.trim() === title && plain(p.body_md) === body_md);
    const same = twins.find((p) => p.slug === slug && sameList(p.tags ?? [], tags) && (p.excerpt || null) === excerpt && (p.cover_url || null) === cover_url && p.published === published);
    // everything sent is what the site already holds, so it is saved, and nothing is written twice
    if (same) return { saved: true, title: same.title, slug: same.slug, published: same.published };
    const twin = twins[0];
    // a draft is not served at its address, so it is not said to be at it
    if (twin) return no(`A post with this title and this text is already on the site, ${twin.published ? "live at" : "as a draft with the address"} /blog/${twin.slug}. Nothing new was saved. Open "${twin.title}" from the desk to change it.`);
  }

  let saved: Post;
  try {
    saved = await store.upsert({
      // a post that is gone is saved as a new one, so it does not carry the id it had
      id: old?.id,
      title,
      body_md,
      body_text,
      slug,
      excerpt,
      cover_url,
      tags,
      published,
      reading_time: readingTime(body_text),
      // The day it first went out is the site's to keep, never the form's: a page opened while
      // the post was a draft would wipe a day set since. It survives being taken down, so
      // putting the post back does not date it today.
      published_at: old?.published_at ?? (published ? new Date().toISOString() : null),
    });
  } catch (e) {
    // a silent failed save is worse than an error, so the store's own words are shown
    const said = (e instanceof Error ? e.message : "").trim();
    if (/duplicate key|posts_slug_key|unique/i.test(said)) return no(`Nothing was saved. Another post already has the address /blog/${slug}, so type a different one in the address box.`);
    // once, though: the store says this very sentence when the row went between the look and the write
    const why = !said ? "The database gave no reason." : /^The post did not save\.?$/.test(said) ? "" : /[.!?]$/.test(said) ? said : `${said}.`;
    return no(["The post did not save.", why, `What you typed is still on this page, so press ${save()} again.`].filter(Boolean).join(" "));
  }

  revalidatePath("/");                       // the homepage lists the newest three
  revalidatePath("/blog");
  revalidatePath(`/blog/${saved.slug}`);
  revalidatePath("/admin");
  revalidatePath("/sitemap.xml");
  return { saved: true, title: saved.title, slug: saved.slug, published: saved.published };
}

/**
 * Deletes a post. The page that asks first, app/admin/delete/[id]/page.tsx, is the only thing
 * that calls it. When it is done it goes back to the desk.
 *
 * Like savePost it answers with a sentence instead of throwing, for anything the writer can
 * try again: with JavaScript off Next answers a thrown action with a bare "Internal Server
 * Error". And like savePost it does not act on an old picture. The page named the post as it
 * was when it was drawn, and a post saved again since is not the post that was asked about,
 * so it is left alone and the writer is told. Deleting cannot be undone.
 *
 * Signed out it sends the writer to the sign in. The proxy lets a POST through, so this is
 * the check, and a throw here would be an error page.
 */
export async function deletePost(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    await requireDesk();
  } catch {
    redirect("/admin/login");
  }
  const id = String(formData.get("id") ?? "").trim();
  const opened = String(formData.get("opened") ?? "");
  if (id) {
    try {
      const store = getStore();
      const post = await store.getById(id);
      if (post && opened !== post.updated_at) {
        // Both are true whichever page they are read on. With JavaScript off the page that
        // comes back is drawn afresh and already shows the post as it is now.
        return opened
          ? "This post was saved again after this page was opened, so it was not deleted. If you still mean to delete it, load the page again with the link below, look at the post as it is now, and delete it from there."
          : "The desk could not tell which version of this post the page showed, so it was not deleted. Load the page again with the link below and delete it from there.";
      }
      // a post that is already gone needs nothing done, and the desk is where to see that
      if (post) await store.remove(id);
    } catch (e) {
      return `The database did not answer, so the post may not have been deleted. Press "delete it" again in a moment. (${e instanceof Error ? e.message : "no reason given"})`;
    }
  }
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin");
  redirect("/admin");
}
