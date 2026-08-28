import "server-only";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import type { Post, PostInput, PostStore } from "./types";

/**
 * Neon is real Postgres, so the search is the same weighted tsvector the Supabase adapter uses.
 * Free, permanent, and no card. It sleeps after five minutes of no traffic, which costs a
 * cold start on the first request and nothing after that.
 *
 * Images go to Vercel Blob rather than into the database.
 */

const url = process.env.DATABASE_URL ?? "";
const sql = url ? neon(url) : null;
const q = () => {
  if (!sql) throw new Error("DATABASE_URL is not set.");
  return sql;
};

const COLS = `id, slug, title, excerpt, body_md, body_text, cover_url, tags, published,
  reading_time, created_at, updated_at, published_at`;

export const neonStore: PostStore = {
  name: "neon",
  ready: Boolean(url),

  async listPublished(query) {
    const s = q();
    const rows = query?.trim()
      ? await s`select ${s.unsafe(COLS)} from posts
          where published = true and fts @@ websearch_to_tsquery('english', ${query.trim()})
          order by ts_rank(fts, websearch_to_tsquery('english', ${query.trim()})) desc,
                   published_at desc nulls last`
      : await s`select ${s.unsafe(COLS)} from posts
          where published = true order by published_at desc nulls last`;
    return rows as unknown as Post[];
  },

  async getBySlug(slug) {
    const s = q();
    const rows = await s`select ${s.unsafe(COLS)} from posts where slug = ${slug} and published = true limit 1`;
    return (rows[0] as unknown as Post) ?? null;
  },

  async listAll() {
    const s = q();
    const rows = await s`select ${s.unsafe(COLS)} from posts order by updated_at desc`;
    return rows as unknown as Post[];
  },

  async getById(id) {
    const s = q();
    const rows = await s`select ${s.unsafe(COLS)} from posts where id = ${id} limit 1`;
    return (rows[0] as unknown as Post) ?? null;
  },

  async upsert(input: PostInput) {
    const s = q();
    const p = input;
    const rows = p.id
      ? await s`update posts set
            slug = ${p.slug}, title = ${p.title}, excerpt = ${p.excerpt},
            body_md = ${p.body_md}, body_text = ${p.body_text}, cover_url = ${p.cover_url},
            tags = ${p.tags}, published = ${p.published}, reading_time = ${p.reading_time},
            published_at = ${p.published_at}, updated_at = now()
          where id = ${p.id} returning ${s.unsafe(COLS)}`
      : await s`insert into posts
            (slug, title, excerpt, body_md, body_text, cover_url, tags, published, reading_time, published_at)
          values
            (${p.slug}, ${p.title}, ${p.excerpt}, ${p.body_md}, ${p.body_text}, ${p.cover_url},
             ${p.tags}, ${p.published}, ${p.reading_time}, ${p.published_at})
          returning ${s.unsafe(COLS)}`;
    if (!rows[0]) throw new Error("The post did not save.");
    return rows[0] as unknown as Post;
  },

  async remove(id) {
    await q()`delete from posts where id = ${id}`;
  },

  async putImage(name, body, contentType) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is not set.");
    const res = await put(`post-images/${name}`, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,   // put() throws on an existing path without this
      cacheControlMaxAge: 31536000,
    });
    return res.url;
  },
};
