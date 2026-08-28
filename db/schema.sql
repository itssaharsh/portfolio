-- One schema, works on Neon and on Supabase. Both are Postgres.
-- Run it once in the SQL editor of whichever you are using.

create extension if not exists pgcrypto;

create table if not exists posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body_md      text not null default '',
  body_text    text not null default '',
  cover_url    text,
  tags         text[] not null default '{}',
  published    boolean not null default false,
  reading_time int not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

-- Search. Title counts most, then the one line summary, then tags, then the body.
-- STORED rather than VIRTUAL, because generated columns are only virtual in Postgres 18 and later
-- and both of these run 17.
-- array_to_string is STABLE, not IMMUTABLE, and a generated column will not accept it.
-- This wrapper is the standard way round that.
create or replace function tags_to_text(text[]) returns text
  language sql immutable strict parallel safe
  as $$ select array_to_string($1, ' ') $$;

alter table posts drop column if exists fts;
alter table posts add column fts tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, tags_to_text(tags)), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce(body_text, '')), 'D')
  ) stored;

create index if not exists posts_fts_idx  on posts using gin (fts);
create index if not exists posts_tags_idx on posts using gin (tags);
create index if not exists posts_pub_idx  on posts (published, published_at desc);

create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists posts_touch on posts;
create trigger posts_touch before update on posts
  for each row execute function touch_updated_at();

-- ONLY IF YOU ARE ON SUPABASE. Neon has no anonymous public client, so it needs none of this.
-- The site reaches Supabase with the service role key from the server, which bypasses these,
-- but they are worth having so a leaked anon key cannot read your drafts.
--
--   alter table posts enable row level security;
--   create policy "anyone reads published" on posts for select using (published = true);
