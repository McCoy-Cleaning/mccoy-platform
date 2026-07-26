-- Platform notifications: durable multi-recipient notices + outbox
-- Requires: public.users, private.set_updated_at() (earlier migrations).
-- Writes: service_role. Clients: SELECT own + UPDATE own recipient/preference state only.

-- ---------------------------------------------------------------------------
-- public.notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  type text not null,
  category text not null,
  severity text not null
    check (severity in ('info', 'success', 'warning', 'error', 'critical')),

  title text not null,
  body text,

  destination_path text,

  entity_type text,
  entity_id text,

  metadata jsonb not null default '{}'::jsonb,

  dedupe_key text,

  actor_user_id uuid
    references public.users (id)
    on delete set null,

  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_title_len_check
    check (char_length(title) between 1 and 200),
  constraint notifications_body_len_check
    check (body is null or char_length(body) <= 500),
  constraint notifications_destination_path_format_check
    check (
      destination_path is null
      or destination_path ~ '^/[A-Za-z0-9/_-]*$'
    ),
  constraint notifications_dedupe_key_len_check
    check (dedupe_key is null or char_length(dedupe_key) between 1 and 200)
);

comment on table public.notifications is
  'Platform notification payloads. Immutable content after insert; per-user state lives on notification_recipients.';

comment on column public.notifications.metadata is
  'Allowlisted safe fields only — no message bodies, tokens, or full addresses.';

comment on column public.notifications.dedupe_key is
  'Idempotency key (e.g. website_request.received:{requestId}). Unique when present.';

-- Partial unique: Postgres without NULLS NOT DISTINCT treats multiple NULLs as distinct.
create unique index if not exists notifications_dedupe_key_uq
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_type_created_idx
  on public.notifications (type, created_at desc);

create index if not exists notifications_category_created_idx
  on public.notifications (category, created_at desc);

create index if not exists notifications_entity_idx
  on public.notifications (entity_type, entity_id)
  where entity_type is not null and entity_id is not null;

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
  before update on public.notifications
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- public.notification_recipients
-- ---------------------------------------------------------------------------

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),

  notification_id uuid not null
    references public.notifications (id)
    on delete cascade,

  user_id uuid not null
    references public.users (id)
    on delete cascade,

  seen_at timestamptz,
  read_at timestamptz,
  opened_at timestamptz,
  dismissed_at timestamptz,

  browser_notified_at timestamptz,
  email_notified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_recipients_notification_user_uq
    unique (notification_id, user_id)
);

comment on table public.notification_recipients is
  'Per-user notification state. No shared is_read — each recipient tracks own seen/read/opened/dismissed.';

-- Unread inbox queries (not dismissed, not read)
create index if not exists notification_recipients_user_unread_idx
  on public.notification_recipients (user_id, created_at desc)
  where read_at is null and dismissed_at is null;

create index if not exists notification_recipients_user_created_idx
  on public.notification_recipients (user_id, created_at desc);

create index if not exists notification_recipients_notification_idx
  on public.notification_recipients (notification_id);

drop trigger if exists notification_recipients_set_updated_at on public.notification_recipients;
create trigger notification_recipients_set_updated_at
  before update on public.notification_recipients
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- public.notification_preferences
-- ---------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.users (id)
    on delete cascade,

  notification_type text not null,

  in_app_enabled boolean not null default true,
  browser_enabled boolean not null default false,
  email_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_preferences_user_type_uq
    unique (user_id, notification_type),
  constraint notification_preferences_type_len_check
    check (char_length(notification_type) between 1 and 120)
);

comment on table public.notification_preferences is
  'Per-user channel toggles by notification type. Delivery still server-gated.';

create index if not exists notification_preferences_user_idx
  on public.notification_preferences (user_id);

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- public.notification_outbox
-- ---------------------------------------------------------------------------

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),

  type text not null,
  payload jsonb not null,

  dedupe_key text,

  actor_user_id uuid
    references public.users (id)
    on delete set null,

  created_at timestamptz not null default now(),
  processed_at timestamptz,
  failed_at timestamptz,
  attempts integer not null default 0,
  last_error text,

  constraint notification_outbox_type_len_check
    check (char_length(type) between 1 and 120),
  constraint notification_outbox_dedupe_key_len_check
    check (dedupe_key is null or char_length(dedupe_key) between 1 and 200),
  constraint notification_outbox_attempts_check
    check (attempts >= 0)
);

comment on table public.notification_outbox is
  'Transactional notification event queue. Service-role only; worker fans out to notifications + recipients.';

create unique index if not exists notification_outbox_dedupe_key_uq
  on public.notification_outbox (dedupe_key)
  where dedupe_key is not null;

create index if not exists notification_outbox_unprocessed_idx
  on public.notification_outbox (created_at)
  where processed_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

alter table public.notification_recipients enable row level security;
alter table public.notification_recipients force row level security;

alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

alter table public.notification_outbox enable row level security;
alter table public.notification_outbox force row level security;

-- notifications: SELECT only when current user is a recipient
drop policy if exists notifications_select_own_recipient on public.notifications;
create policy notifications_select_own_recipient
  on public.notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.notification_recipients r
      where r.notification_id = notifications.id
        and r.user_id = (select auth.uid())
    )
  );

-- recipients: SELECT / UPDATE own rows only
drop policy if exists notification_recipients_select_own on public.notification_recipients;
create policy notification_recipients_select_own
  on public.notification_recipients
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notification_recipients_update_own on public.notification_recipients;
create policy notification_recipients_update_own
  on public.notification_recipients
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- preferences: SELECT / UPDATE own rows only
drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- outbox: no policies for anon/authenticated (deny by default)

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on table public.notifications from public;
revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;

revoke all on table public.notification_recipients from public;
revoke all on table public.notification_recipients from anon;
revoke all on table public.notification_recipients from authenticated;

revoke all on table public.notification_preferences from public;
revoke all on table public.notification_preferences from anon;
revoke all on table public.notification_preferences from authenticated;

revoke all on table public.notification_outbox from public;
revoke all on table public.notification_outbox from anon;
revoke all on table public.notification_outbox from authenticated;

grant select on table public.notifications to authenticated;

grant select on table public.notification_recipients to authenticated;
grant update (
  seen_at,
  read_at,
  opened_at,
  dismissed_at,
  browser_notified_at,
  email_notified_at,
  updated_at
) on table public.notification_recipients to authenticated;

grant select, update on table public.notification_preferences to authenticated;

grant select, insert, update, delete on table public.notifications to service_role;
grant select, insert, update, delete on table public.notification_recipients to service_role;
grant select, insert, update, delete on table public.notification_preferences to service_role;
grant select, insert, update, delete on table public.notification_outbox to service_role;
