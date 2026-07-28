-- CMS media library: private catalog + public Storage bucket
-- Canonical identity: bucket_id + storage_path (no public_url column).
-- Access: service_role only for catalog; public read on storage objects.
--
-- IMPORTANT: Paste/run ONLY this migration in SQL Editor — clear any previous query first.
-- Do not nest this inside another SELECT / WHERE clause.
-- Requires: public.cms_sites, public.users, private.set_updated_at() (earlier migrations).

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- private.cms_media_assets
-- ---------------------------------------------------------------------------

create table if not exists private.cms_media_assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.cms_sites (id) on delete cascade,
  bucket_id text not null default 'cms-media',
  storage_path text not null,
  content_hash text not null,
  original_filename text,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt_default text not null default '',
  tags text[] not null default '{}',
  profile text not null check (profile in ('photo', 'logo', 'gif')),
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  idempotency_key text,
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archive_reason text,
  deleted_at timestamptz,
  delete_reason text,
  constraint cms_media_assets_storage_path_format
    check (storage_path !~ '^[/\\]' and storage_path !~ '\.\.'),
  constraint cms_media_assets_bucket_path_uq unique (bucket_id, storage_path),
  constraint cms_media_assets_site_path_uq unique (site_id, storage_path)
);

comment on table private.cms_media_assets is
  'CMS media catalog. Canonical identity is bucket_id + storage_path; derive public URLs in app code.';

create unique index if not exists cms_media_assets_site_hash_active_uq
  on private.cms_media_assets (site_id, content_hash)
  where status = 'active';

create unique index if not exists cms_media_assets_site_idempotency_uq
  on private.cms_media_assets (site_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists cms_media_assets_site_status_created_idx
  on private.cms_media_assets (site_id, status, created_at desc, id desc);

create index if not exists cms_media_assets_tags_gin_idx
  on private.cms_media_assets using gin (tags);

create index if not exists cms_media_assets_profile_idx
  on private.cms_media_assets (site_id, profile, status);

drop trigger if exists cms_media_assets_set_updated_at on private.cms_media_assets;
create trigger cms_media_assets_set_updated_at
  before update on private.cms_media_assets
  for each row
  execute function private.set_updated_at();

alter table private.cms_media_assets enable row level security;

revoke all on table private.cms_media_assets from public;
revoke all on table private.cms_media_assets from anon;
revoke all on table private.cms_media_assets from authenticated;
grant select, insert, update, delete on table private.cms_media_assets to service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket cms-media (public read, no public write)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cms-media',
  'cms-media',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Historical: broad SELECT (allows Storage list API). Removed in
-- 20260728180706_drop_cms_media_public_list_policy.sql (lint 0025).
drop policy if exists "cms_media_public_read" on storage.objects;
create policy "cms_media_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'cms-media');
