"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { savePost } from "./actions";
import type { Post } from "@/lib/posts";

export default function Editor({ post }: { post?: Post }) {
  const [body, setBody] = useState(post?.body_md ?? "");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);

  /** drop an image anywhere in the text and it uploads, then writes itself in at the cursor */
  async function upload(files: FileList | File[]) {
    const sb = supabaseBrowser();
    if (!sb) return;
    setUploading(true); setErr("");
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const ext = file.name.split(".").pop() || "png";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from("post-images").upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) { setErr(error.message); break; }
      const { data } = sb.storage.from("post-images").getPublicUrl(path);
      const md = `\n\n![${file.name.replace(/\.[^.]+$/, "")}](${data.publicUrl})\n\n`;
      const el = ta.current;
      if (el) {
        const at = el.selectionStart ?? body.length;
        const next = body.slice(0, at) + md + body.slice(at);
        setBody(next);
      } else setBody((b) => b + md);
    }
    setUploading(false);
  }

  return (
    <form action={savePost} className="mt-6 grid gap-4">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      {post?.published_at ? <input type="hidden" name="published_at" value={post.published_at} /> : null}

      <label className="grid gap-1">
        <span className="font-mono text-[10px] tracking-[.1em] uppercase text-ink-2">Title</span>
        <input name="title" required defaultValue={post?.title ?? ""}
          className="bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[15px] text-ink" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="font-mono text-[10px] tracking-[.1em] uppercase text-ink-2">Address on the site</span>
          <input name="slug" defaultValue={post?.slug ?? ""} placeholder="left blank, it makes one from the title"
            className="bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[13px] text-ink" />
        </label>
        <label className="grid gap-1">
          <span className="font-mono text-[10px] tracking-[.1em] uppercase text-ink-2">Tags, separated by commas</span>
          <input name="tags" defaultValue={post?.tags?.join(", ") ?? ""}
            className="bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[13px] text-ink" />
        </label>
      </div>

      <label className="grid gap-1">
        <span className="font-mono text-[10px] tracking-[.1em] uppercase text-ink-2">One line for the list page</span>
        <input name="excerpt" defaultValue={post?.excerpt ?? ""}
          className="bg-chalk border border-[#C9C4B2] px-3 py-2 text-[14px] text-ink" />
      </label>

      <label className="grid gap-1">
        <span className="font-mono text-[10px] tracking-[.1em] uppercase text-ink-2">Cover image address, optional</span>
        <input name="cover_url" defaultValue={post?.cover_url ?? ""}
          className="bg-chalk border border-[#C9C4B2] px-3 py-2 font-mono text-[12px] text-ink" />
      </label>

      <div className="grid gap-1">
        <span className="font-mono text-[10px] tracking-[.1em] uppercase text-ink-2">
          The post. Drag an image straight in, or paste one.
        </span>
        <textarea
          ref={ta} name="body_md" value={body} onChange={(e) => setBody(e.target.value)}
          onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); upload(e.dataTransfer.files); } }}
          onPaste={(e) => { const f = Array.from(e.clipboardData.files); if (f.length) { e.preventDefault(); upload(f); } }}
          rows={22}
          className="bg-chalk border border-[#C9C4B2] px-3 py-3 font-mono text-[13.5px] leading-[21px] text-ink resize-y"
        />
        {uploading && <span className="font-mono text-[11px] text-ultra-deep">uploading the image</span>}
        {err && <span className="font-mono text-[11px] text-rust">{err}</span>}
      </div>

      <label className="flex items-center gap-2 font-mono text-[12px]">
        <input type="checkbox" name="published" defaultChecked={post?.published ?? false} />
        <span>Published. Leave this off to keep it as a draft only you can see.</span>
      </label>

      <div>
        <button className="bg-inkpanel text-chalk font-mono text-[11px] tracking-[.1em] uppercase px-5 py-3">save</button>
      </div>
    </form>
  );
}
