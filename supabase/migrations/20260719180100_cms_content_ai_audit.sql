-- Phase E6 — Content AI audit provenance (server-only)

create table if not exists cms_content_ai_audit (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references cms_sites (id) on delete set null,
  page_id text,
  actor_username text,
  operation text not null check (operation in ('generate_nl', 'translate_nl_en')),
  provider text not null default 'groq',
  model text,
  prompt_version text,
  source_hash text not null,
  cache_hit boolean not null default false,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cms_content_ai_audit_created_idx
  on cms_content_ai_audit (created_at desc);

create index if not exists cms_content_ai_audit_source_hash_idx
  on cms_content_ai_audit (source_hash);

alter table cms_content_ai_audit enable row level security;
revoke all on cms_content_ai_audit from anon, authenticated;
grant all on cms_content_ai_audit to service_role;
