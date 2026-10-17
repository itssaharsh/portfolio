// node desk.mjs '<json>'
// Saves a post the way the writing desk does: it signs in, fills the form the way Editor.tsx
// does, with every field starting as the stored value, and calls the real savePost.
// The fields come as JSON: { slug, title, tags, excerpt, cover_url, body_md, published, newslug }.
// A browser sends a text box with CR LF line endings, and so does this.
//
// Three more reach the states a page left open gets into:
//   opened   the stamp the form carries, which says which version of the post the page was
//            opened on. Left out, it is the post's stamp as it is now, which is what a page
//            drawn this moment would send. A text sends that text. null sends no stamp at all.
//   id       the post the form is for, when it can no longer be found by its address.
//   as_new   true presses "save it as a new post".
const fields = JSON.parse(process.argv[2] ?? "{}");
const { getStore } = await import(new URL("./stand-ins/store.mjs", import.meta.url).href);
const { startSession } = await import(process.env.SIM_AUTH);
const { savePost } = await import(process.env.SIM_ACTIONS);

const old = fields.slug ? (await getStore().listAll()).find((p) => p.slug === fields.slug) : undefined;
const form = new FormData();
const set = (name, value) => { if (value !== undefined && value !== null) form.set(name, String(value)); };
set("id", fields.id ?? old?.id);
set("opened", fields.opened === undefined ? old?.updated_at : fields.opened);
if (fields.as_new) form.set("as_new", "1");
set("title", fields.title ?? old?.title ?? "");
set("slug", fields.newslug ?? old?.slug ?? fields.slug ?? "");
set("tags", fields.tags ?? old?.tags?.join(", ") ?? "");
set("excerpt", fields.excerpt ?? old?.excerpt ?? "");
set("cover_url", fields.cover_url ?? old?.cover_url ?? "");
set("body_md", (fields.body_md ?? old?.body_md ?? "").replace(/\r\n|\r|\n/g, "\r\n"));
if (fields.published ?? old?.published ?? false) form.set("published", "on");

await startSession();
// savePost answers with a sentence when it refuses, and no longer throws. a throw here is a bug in it.
const answer = await savePost(undefined, form);
if (answer && "error" in answer) {
  // it also hands back what was in the boxes, so a page drawn without JavaScript can fill them in again
  const kept = answer.fields?.title === form.get("title") && answer.fields?.body_md === String(form.get("body_md")).replace(/\r\n?/g, "\n");
  console.log(`refused: ${answer.error}${kept ? "" : " (AND IT DID NOT HAND BACK WHAT WAS TYPED)"}`);
  // and the two marks the editor reads, each on a line of its own
  if (answer.stale) console.log("stale: true");
  if (answer.gone) console.log("gone: true");
  process.exit(3);
}
