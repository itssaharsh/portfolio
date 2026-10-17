"use client";

/**
 * What the desk shows in place of a page that threw, or of a save or a delete whose answer
 * never arrived because the connection dropped. Without it Next shows its own "This page
 * couldn't load".
 *
 * It comes after a request that may or may not have got as far as the database, and it cannot
 * tell whether the editor's script had been running, so it promises nothing it cannot know:
 * not that nothing changed, and not that what was typed is safe. What it does say about the
 * text is what the editor does: it writes the boxes down as they are typed and again at the
 * press of save, and another tab on the same post moves that text to the offers before it
 * writes where the text was. The link that loads the page again is a plain one on purpose. A
 * page loaded afresh reads the post as it is now, so what the editor then offers back is
 * measured against what was really saved.
 *
 * It is not what a browser with JavaScript off sees when an action throws: Next answers that
 * with a bare "Internal Server Error". That is why savePost and deletePost answer with a
 * sentence instead of throwing.
 */
export default function DeskError() {
  return (
    <main id="main" className="mx-auto max-w-[40rem] px-[clamp(1.1rem,4vw,2.5rem)] py-[clamp(2rem,5vw,3.5rem)]">
      <h1 className="text-[1.6rem]">The desk lost its place</h1>
      <p className="mt-5 text-[.92rem]">
        Something went wrong here, and the desk has no better sentence for it. A save or a delete that was on its way may or may not have gone through, so look at the desk before doing it again.
      </p>
      <p className="mt-3 text-[.92rem]">
        Text typed in the editor while its script was running is kept in this browser as it is typed, and again when save is pressed, unless the browser refuses to store it. Open the post again, or Write something for a new one, and whatever the browser did not see saved is offered back, unless the post already says the same.
      </p>
      <p className="mt-6 flex gap-5 flex-wrap font-mono text-[11px] tracking-[.1em] uppercase">
        {/* an empty address is this page's own, so this loads it again, with the script or without */}
        <a href="" className="underline underline-offset-[3px]">load this page again</a>
        <a href="/admin" className="underline underline-offset-[3px]">back to the desk</a>
      </p>
    </main>
  );
}
