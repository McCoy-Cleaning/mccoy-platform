-- Phase B1 — McCoy CMS published persistence
-- Conventions: snake_case, UUID PKs, UTC timestamps, site_id ownership.
-- Prefer service-role access from SSR; no direct browser CMS writes.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Sites
-- ---------------------------------------------------------------------------

create table if not exists cms_sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  origin text not null,
  config_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pages (stable identity)
-- ---------------------------------------------------------------------------

create table if not exists cms_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references cms_sites (id) on delete cascade,
  stable_key text,
  kind text not null check (kind in ('builtin', 'custom')),
  page_key text,
  in_nav boolean not null default false,
  is_draft_only boolean not null default false,
  draft_revision_number integer not null default 1,
  active_published_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cms_pages_site_stable_key_uq
  on cms_pages (site_id, stable_key)
  where stable_key is not null;

-- ---------------------------------------------------------------------------
-- Revisions (immutable when published / superseded)
-- ---------------------------------------------------------------------------

create table if not exists cms_page_revisions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references cms_sites (id) on delete cascade,
  page_id uuid not null references cms_pages (id) on delete cascade,
  revision_number integer not null,
  status text not null check (status in ('draft', 'review', 'published', 'superseded', 'archived')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  published_at timestamptz,
  unique (page_id, revision_number)
);

alter table cms_pages
  drop constraint if exists cms_pages_active_published_revision_fk;

alter table cms_pages
  add constraint cms_pages_active_published_revision_fk
  foreign key (active_published_revision_id) references cms_page_revisions (id);

create unique index if not exists cms_page_one_published_revision
  on cms_page_revisions (page_id)
  where status = 'published';

-- ---------------------------------------------------------------------------
-- Locale publication / freshness (denormalized for routing queries)
-- ---------------------------------------------------------------------------

create table if not exists cms_page_locale_states (
  page_id uuid not null references cms_pages (id) on delete cascade,
  site_id uuid not null references cms_sites (id) on delete cascade,
  locale text not null check (locale in ('nl', 'en')),
  publication_state text not null
    check (publication_state in ('missing', 'draft', 'review', 'approved', 'published', 'archived')),
  freshness text not null check (freshness in ('current', 'stale', 'unknown')),
  path text not null,
  public_path text not null,
  primary key (page_id, locale)
);

create unique index if not exists cms_page_locale_published_path_uq
  on cms_page_locale_states (site_id, locale, public_path)
  where publication_state = 'published';

-- ---------------------------------------------------------------------------
-- Redirects (retired paths — 301/308 only)
-- ---------------------------------------------------------------------------

create table if not exists cms_redirects (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references cms_sites (id) on delete cascade,
  page_id uuid references cms_pages (id) on delete set null,
  locale text not null check (locale in ('nl', 'en')),
  from_path text not null,
  to_path text not null,
  status_code integer not null check (status_code in (301, 308)),
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (site_id, locale, from_path),
  check (from_path <> to_path)
);

-- ---------------------------------------------------------------------------
-- Outbox (CmsPagePublishedEvent) — atomic with publish
-- ---------------------------------------------------------------------------

create table if not exists cms_outbox (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references cms_sites (id) on delete cascade,
  event_type text not null default 'cms.page.published',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0
);

create index if not exists cms_outbox_unprocessed_idx
  on cms_outbox (created_at)
  where processed_at is null;

-- ---------------------------------------------------------------------------
-- Ownership: revision / locale / redirect site_id must match page.site_id
-- ---------------------------------------------------------------------------

create or replace function cms_assert_page_site_ownership()
returns trigger
language plpgsql
as $$
declare
  page_site uuid;
begin
  select site_id into page_site from cms_pages where id = new.page_id;
  if page_site is null then
    raise exception 'cms ownership: page % not found', new.page_id;
  end if;
  if new.site_id is distinct from page_site then
    raise exception 'cms ownership: site_id mismatch for page %', new.page_id;
  end if;
  return new;
end;
$$;

drop trigger if exists cms_page_revisions_ownership_trg on cms_page_revisions;
create trigger cms_page_revisions_ownership_trg
  before insert or update of site_id, page_id
  on cms_page_revisions
  for each row execute function cms_assert_page_site_ownership();

drop trigger if exists cms_page_locale_states_ownership_trg on cms_page_locale_states;
create trigger cms_page_locale_states_ownership_trg
  before insert or update of site_id, page_id
  on cms_page_locale_states
  for each row execute function cms_assert_page_site_ownership();

create or replace function cms_assert_redirect_page_site_ownership()
returns trigger
language plpgsql
as $$
declare
  page_site uuid;
begin
  if new.page_id is null then
    return new;
  end if;
  select site_id into page_site from cms_pages where id = new.page_id;
  if page_site is null then
    raise exception 'cms ownership: page % not found', new.page_id;
  end if;
  if new.site_id is distinct from page_site then
    raise exception 'cms ownership: redirect site_id mismatch for page %', new.page_id;
  end if;
  return new;
end;
$$;

drop trigger if exists cms_redirects_ownership_trg on cms_redirects;
create trigger cms_redirects_ownership_trg
  before insert or update of site_id, page_id
  on cms_redirects
  for each row execute function cms_assert_redirect_page_site_ownership();

-- ---------------------------------------------------------------------------
-- Immutability: published / superseded revision payloads cannot change
-- ---------------------------------------------------------------------------

create or replace function cms_forbid_immutable_revision_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('published', 'superseded') then
      raise exception 'cms immutability: cannot delete % revision %', old.status, old.id;
    end if;
    return old;
  end if;

  if old.status in ('published', 'superseded') then
    if new.payload is distinct from old.payload
      or new.revision_number is distinct from old.revision_number
      or new.page_id is distinct from old.page_id
      or new.site_id is distinct from old.site_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'cms immutability: cannot mutate payload of % revision %', old.status, old.id;
    end if;
    -- Allowed: status published → superseded (and archived later via controlled path)
    if new.status not in ('published', 'superseded', 'archived') then
      raise exception 'cms immutability: invalid status transition from % to %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cms_page_revisions_immutable_trg on cms_page_revisions;
create trigger cms_page_revisions_immutable_trg
  before update or delete
  on cms_page_revisions
  for each row execute function cms_forbid_immutable_revision_mutation();

-- ---------------------------------------------------------------------------
-- RLS — deny anon/authenticated direct access; service_role bypasses RLS
-- ---------------------------------------------------------------------------

alter table cms_sites enable row level security;
alter table cms_pages enable row level security;
alter table cms_page_revisions enable row level security;
alter table cms_page_locale_states enable row level security;
alter table cms_redirects enable row level security;
alter table cms_outbox enable row level security;

revoke all on cms_sites from anon, authenticated;
revoke all on cms_pages from anon, authenticated;
revoke all on cms_page_revisions from anon, authenticated;
revoke all on cms_page_locale_states from anon, authenticated;
revoke all on cms_redirects from anon, authenticated;
revoke all on cms_outbox from anon, authenticated;

grant all on cms_sites to service_role;
grant all on cms_pages to service_role;
grant all on cms_page_revisions to service_role;
grant all on cms_page_locale_states to service_role;
grant all on cms_redirects to service_role;
grant all on cms_outbox to service_role;

-- ---------------------------------------------------------------------------
-- Seed default site (idempotent)
-- ---------------------------------------------------------------------------

insert into cms_sites (id, slug, origin, config_version)
values (
  'a0000000-0000-4000-8000-000000000001',
  'mccoy',
  'https://www.mccoy.nl',
  1
)
on conflict (slug) do nothing;
