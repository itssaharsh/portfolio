-- Run this once in the Supabase SQL editor.
-- Supabase provisions Postgres 17, so the search column must be STORED.
-- VIRTUAL generated columns are Postgres 18 and later.

create table if not exists public.posts (
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

alter table public.posts drop column if exists fts;
alter table public.posts add column fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'D')
  ) stored;

create index if not exists posts_fts_idx  on public.posts using gin (fts);
create index if not exists posts_tags_idx on public.posts using gin (tags);
create index if not exists posts_pub_idx  on public.posts (published, published_at desc);

alter table public.posts enable row level security;

drop policy if exists "public reads published" on public.posts;
create policy "public reads published"
  on public.posts for select
  using (published = true);

drop policy if exists "admin does everything" on public.posts;
create policy "admin does everything"
  on public.posts for all
  to authenticated
  using      (auth.jwt() ->> 'email' = 'saharsh7002@gmail.com')
  with check (auth.jwt() ->> 'email' = 'saharsh7002@gmail.com');

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- Images. Public read, one address writes.
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

drop policy if exists "anyone reads post images" on storage.objects;
create policy "anyone reads post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

drop policy if exists "admin writes post images" on storage.objects;
create policy "admin writes post images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images' and auth.jwt() ->> 'email' = 'saharsh7002@gmail.com');

drop policy if exists "admin deletes post images" on storage.objects;
create policy "admin deletes post images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images' and auth.jwt() ->> 'email' = 'saharsh7002@gmail.com');
