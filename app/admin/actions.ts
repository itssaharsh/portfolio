"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDesk, passwordMatches, startSession, endSession, authConfigured } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { slugify, toPlainText, readingTime } from "@/lib/posts";

export async function signIn(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  if (!authConfigured()) return "ADMIN_PASSWORD and SESSION_SECRET are not set yet.";
  const given = String(formData.get("password") ?? "");
  if (!passwordMatches(given)) {
    // no rate limiting here, so make a scripted guess cost something
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

export async function savePost(formData: FormData) {
  await requireDesk();                       // the proxy does not cover Server Actions
  const store = getStore();

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const title = String(formData.get("title") ?? "").trim() || "Untitled";
  const body_md = String(formData.get("body_md") ?? "");
  const published = formData.get("published") === "on";
  const body_text = toPlainText(body_md);

  const saved = await store.upsert({
    id,
    title,
    body_md,
    body_text,
    slug: String(formData.get("slug") ?? "").trim() || slugify(title),
    excerpt: String(formData.get("excerpt") ?? "").trim() || null,
    cover_url: String(formData.get("cover_url") ?? "").trim() || null,
    tags: String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    published,
    reading_time: readingTime(body_text),
    published_at: published ? String(formData.get("published_at") ?? "") || new Date().toISOString() : null,
  });

  revalidatePath("/blog");
  revalidatePath(`/blog/${saved.slug}`);
  revalidatePath("/admin");
  revalidatePath("/sitemap.xml");
  redirect("/admin");
}

export async function deletePost(formData: FormData) {
  await requireDesk();
  await getStore().remove(String(formData.get("id") ?? ""));
  revalidatePath("/blog");
  revalidatePath("/admin");
}
