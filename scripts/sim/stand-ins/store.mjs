// Stands in for lib/store: the posts live in a JSON file, so one run of the command can see
// what the last one saved. It keeps the promises lib/store/neon.ts keeps: update by id, insert
// otherwise, one post per address, dates as text, everything listed newest change first.
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// read each time it is asked for, so one test process can stand up a site of its own for each test
const file = () => {
  const f = process.env.SIM_STATE;
  if (!f) throw new Error("SIM_STATE is not set");
  return f;
};

const load = () => { const f = file(); try { return JSON.parse(readFileSync(f, "utf8")); } catch { return { posts: [] }; } };
const save = (s) => writeFileSync(file(), JSON.stringify(s, null, 2));
const taken = "duplicate key value violates unique constraint \"posts_slug_key\"";
// Every change to a row moves its updated_at on, as it does in Postgres, whose clock is far finer
// than this one. Without this, two saves inside one millisecond would leave the same stamp, and
// the desk tells whether a post changed under an open page by that stamp.
const later = (than) => {
  const now = new Date().toISOString();
  return than && now <= than ? new Date(Date.parse(than) + 1).toISOString() : now;
};

const store = {
  name: "sim",
  ready: true,
  async listAll() {
    return [...load().posts].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  },
  async listPublished() {
    return (await this.listAll()).filter((p) => p.published);
  },
  async getBySlug(slug) {
    return load().posts.find((p) => p.slug === slug && p.published) ?? null;
  },
  async getById(id) {
    return load().posts.find((p) => p.id === id) ?? null;
  },
  async upsert(input) {
    const s = load();
    const now = new Date().toISOString();
    const { id, ...row } = input;
    let saved;
    if (id) {
      const i = s.posts.findIndex((p) => p.id === id);
      if (i === -1) throw new Error("The post did not save.");
      if (s.posts.some((p) => p.id !== id && p.slug === row.slug)) throw new Error(taken);
      saved = s.posts[i] = { ...s.posts[i], ...row, updated_at: later(s.posts[i].updated_at) };
    } else {
      if (s.posts.some((p) => p.slug === row.slug)) throw new Error(taken);
      saved = { id: randomUUID(), ...row, created_at: now, updated_at: now };
      s.posts.push(saved);
    }
    save(s);
    return saved;
  },
  async remove(id) {
    const s = load();
    s.posts = s.posts.filter((p) => p.id !== id);
    save(s);
  },
};

export const getStore = () => store;
export const storeReady = () => true;
