/**
 * The blog talks to this interface and never to a vendor directly.
 *
 * Swapping backends is one environment variable. Supabase is committed elsewhere for two
 * weeks, so there is a second adapter, and when Supabase frees up nothing but BLOG_STORE
 * has to change.
 */

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  body_text: string;
  cover_url: string | null;
  tags: string[];
  published: boolean;
  reading_time: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type PostInput = Omit<Post, "id" | "created_at" | "updated_at"> & { id?: string };

export interface PostStore {
  /** the public list, newest first. query searches the words inside the body. */
  listPublished(query?: string): Promise<Post[]>;
  getBySlug(slug: string): Promise<Post | null>;
  /** everything, drafts included. only ever called behind the sign in. */
  listAll(): Promise<Post[]>;
  getById(id: string): Promise<Post | null>;
  upsert(input: PostInput): Promise<Post>;
  remove(id: string): Promise<void>;
  /** returns a public URL. called from a server route so the client never holds a write token. */
  putImage(name: string, body: ArrayBuffer, contentType: string): Promise<string>;
  readonly name: string;
  readonly ready: boolean;
}
