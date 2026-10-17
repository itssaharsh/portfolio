"use client";

import { useActionState } from "react";
import { deletePost } from "../../actions";

/**
 * The real button. It is a form of its own so that what deletePost answers can be shown: a
 * database that did not answer, or a post that was saved again after the page above was drawn.
 * It posts and shows the answer with JavaScript switched off too.
 */
export default function DeleteForm({ id, opened }: { id: string; opened: string }) {
  const [answer, action, deleting] = useActionState(deletePost, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {/* which version of the post the page above named */}
      <input type="hidden" name="opened" value={opened} />
      {answer ? (
        <div role="alert" className="mb-4 normal-case tracking-normal font-sans border border-ink bg-chalk p-3 text-[.9rem] font-bold text-ink">
          <p className="m-0">{answer}</p>
          {/* A plain link. After a form posted without JavaScript the page that comes back already
              shows the post as it is now, and the browser's own reload would post the old form
              again, with the old stamp, and be refused again. */}
          <p className="m-0 mt-2 font-mono text-[11px] tracking-[.1em] uppercase font-normal"><a href={`/admin/delete/${id}`} className="underline underline-offset-[3px]">load this page again</a></p>
        </div>
      ) : null}
      {/* a button does not take its capitals from the row it sits in, so it asks for them itself */}
      <button disabled={deleting} className="bg-inkpanel text-chalk uppercase px-5 py-3 disabled:opacity-60">{deleting ? "deleting" : "delete it"}</button>
    </form>
  );
}
