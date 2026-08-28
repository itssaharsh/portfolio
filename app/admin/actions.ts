"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer, currentUser } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/supabase/config";
import { slugify, toPlainText, readingTime } from "@/lib/posts";

async function guard() {
  const user = await currentUser();
  if (!user || user.email !== ADMIN_EMAIL) throw new Error("not allowed");
  const sb = await supabaseServer();
  if (!sb) throw new Error("not configured");
  return sb;
}

export async function savePost(formData: FormData) {
  const sb = await guard();
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || "Untitled";
  const body_md = String(formData.get("body_md") ?? "");
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const cover_url = String(formData.get("cover_url") ?? "").trim() || null;
  const tags = String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const published = formData.get("published") === "on";

  const body_text = toPlainText(body_md);
  const row = {
    title, body_md, body_text, excerpt, cover_url, tags, published,
    slug: String(formData.get("slug") ?? "").trim() || slugify(title),
    reading_time: readingTime(body_text),
    published_at: published ? (String(formData.get("published_at") ?? "") || new Date().toISOString()) : null,
  };

  if (id) {
    const { error } = await sb.from("posts").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("posts").insert(row);
    if (error) throw new Error(error.message);
  }

  // a newly published post has to appear straight away
  revalidatePath("/blog");
  revalidatePath(`/blog/${row.slug}`);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deletePost(formData: FormData) {
  const sb = await guard();
  const id = String(formData.get("id") ?? "");
  const { error } = await sb.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/blog");
  revalidatePath("/admin");
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb?.auth.signOut();
  redirect("/admin/login");
}
