-- Security hardening for staff MFA and anonymous website-form uploads.
-- Staff-facing RLS requires AAL2; upload staging is quota-bound and one-use.

create or replace function private.current_user_is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.account_kind = 'staff'
        and u.status = 'active'
        and u.blocked_at is null
        and u.staff_role is not null
    );
$$;

revoke all on function private.current_user_is_active_staff() from public, anon;
grant execute on function private.current_user_is_active_staff() to authenticated, service_role;

drop policy if exists notifications_require_staff_aal2 on public.notifications;
create policy notifications_require_staff_aal2
  on public.notifications
  as restrictive
  for select
  to authenticated
  using (
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and private.current_user_is_active_staff()
  );

drop policy if exists notification_recipients_require_staff_aal2
  on public.notification_recipients;
create policy notification_recipients_require_staff_aal2
  on public.notification_recipients
  as restrictive
  for all
  to authenticated
  using (
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and private.current_user_is_active_staff()
  )
  with check (
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and private.current_user_is_active_staff()
  );

drop policy if exists notification_preferences_require_staff_aal2
  on public.notification_preferences;
create policy notification_preferences_require_staff_aal2
  on public.notification_preferences
  as restrictive
  for all
  to authenticated
  using (
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and private.current_user_is_active_staff()
  )
  with check (
    coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and private.current_user_is_active_staff()
  );

create table if not exists private.website_form_rate_limits (
  scope text not null,
  client_key_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  byte_count bigint not null,
  updated_at timestamptz not null default now(),
  primary key (scope, client_key_hash),
  constraint website_form_rate_limits_scope_check
    check (scope in ('prepare_upload', 'submit')),
  constraint website_form_rate_limits_key_hash_check
    check (client_key_hash ~ '^[0-9a-f]{64}$'),
  constraint website_form_rate_limits_request_count_check check (request_count >= 0),
  constraint website_form_rate_limits_byte_count_check check (byte_count >= 0)
);

comment on table private.website_form_rate_limits is
  'Atomic website-form abuse quotas. Keys are server-HMACed; raw IP addresses are never stored.';

create table if not exists private.website_form_upload_batches (
  id uuid primary key,
  capability_hash text not null,
  client_key_hash text not null,
  storage_paths text[] not null,
  total_bytes bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  request_id uuid references public.website_requests (id) on delete set null,
  constraint website_form_upload_batches_capability_hash_check
    check (capability_hash ~ '^[0-9a-f]{64}$'),
  constraint website_form_upload_batches_client_key_hash_check
    check (client_key_hash ~ '^[0-9a-f]{64}$'),
  constraint website_form_upload_batches_paths_check
    check (cardinality(storage_paths) between 1 and 8),
  constraint website_form_upload_batches_total_bytes_check
    check (total_bytes between 1 and 209715200),
  constraint website_form_upload_batches_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '2 hours 5 minutes')
);

comment on table private.website_form_upload_batches is
  'Short-lived upload capabilities bound to one request; expired paths are removed by the secured cron.';

create index if not exists website_form_upload_batches_expires_idx
  on private.website_form_upload_batches (expires_at, id);

alter table private.website_form_rate_limits enable row level security;
alter table private.website_form_rate_limits force row level security;
alter table private.website_form_upload_batches enable row level security;
alter table private.website_form_upload_batches force row level security;

revoke all on table private.website_form_rate_limits from public, anon, authenticated;
revoke all on table private.website_form_upload_batches from public, anon, authenticated;
grant select, insert, update, delete on table private.website_form_rate_limits to service_role;
grant select, insert, update, delete on table private.website_form_upload_batches to service_role;

create or replace function private.consume_website_form_quota(
  p_scope text,
  p_client_key_hash text,
  p_request_limit integer,
  p_byte_limit bigint,
  p_cost_bytes bigint,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_allowed boolean;
  v_now timestamptz := clock_timestamp();
begin
  if p_scope not in ('prepare_upload', 'submit')
    or p_client_key_hash !~ '^[0-9a-f]{64}$'
    or p_request_limit not between 1 and 100
    or p_byte_limit not between 0 and 1073741824
    or p_cost_bytes not between 0 and 209715200
    or p_window_seconds not between 60 and 86400
  then
    raise exception 'consume_website_form_quota: invalid arguments';
  end if;

  insert into private.website_form_rate_limits (
    scope,
    client_key_hash,
    window_started_at,
    request_count,
    byte_count,
    updated_at
  ) values (p_scope, p_client_key_hash, v_now, 1, p_cost_bytes, v_now)
  on conflict (scope, client_key_hash) do update
  set
    window_started_at = case
      when private.website_form_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then v_now
      else private.website_form_rate_limits.window_started_at
    end,
    request_count = case
      when private.website_form_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then 1
      else private.website_form_rate_limits.request_count + 1
    end,
    byte_count = case
      when private.website_form_rate_limits.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then p_cost_bytes
      else private.website_form_rate_limits.byte_count + p_cost_bytes
    end,
    updated_at = v_now
  where
    private.website_form_rate_limits.window_started_at
      <= v_now - make_interval(secs => p_window_seconds)
    or (
      private.website_form_rate_limits.request_count + 1 <= p_request_limit
      and private.website_form_rate_limits.byte_count + p_cost_bytes <= p_byte_limit
    )
  returning true into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

create or replace function private.create_website_form_upload_batch(
  p_batch_id uuid,
  p_capability_hash text,
  p_client_key_hash text,
  p_storage_paths text[],
  p_total_bytes bigint,
  p_expires_at timestamptz,
  p_request_limit integer,
  p_byte_limit bigint,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_allowed boolean;
  v_path text;
begin
  if p_batch_id is null
    or p_capability_hash !~ '^[0-9a-f]{64}$'
    or p_client_key_hash !~ '^[0-9a-f]{64}$'
    or cardinality(p_storage_paths) not between 1 and 8
    or p_total_bytes not between 1 and 209715200
    or p_expires_at <= now()
    or p_expires_at > now() + interval '2 hours 5 minutes'
  then
    raise exception 'create_website_form_upload_batch: invalid arguments';
  end if;

  foreach v_path in array p_storage_paths loop
    if v_path !~ ('^uploads/' || p_batch_id::text || '/[0-9]{2}-[^/]+$')
      or char_length(v_path) > 500
    then
      raise exception 'create_website_form_upload_batch: invalid storage path';
    end if;
  end loop;

  v_allowed := private.consume_website_form_quota(
    'prepare_upload',
    p_client_key_hash,
    p_request_limit,
    p_byte_limit,
    p_total_bytes,
    p_window_seconds
  );
  if not v_allowed then return false; end if;

  insert into private.website_form_upload_batches (
    id,
    capability_hash,
    client_key_hash,
    storage_paths,
    total_bytes,
    expires_at
  ) values (
    p_batch_id,
    p_capability_hash,
    p_client_key_hash,
    p_storage_paths,
    p_total_bytes,
    p_expires_at
  );

  return true;
end;
$$;

create or replace function private.claim_website_form_upload_batch(
  p_batch_id uuid,
  p_capability_hash text,
  p_storage_paths text[],
  p_request_id uuid
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  if p_batch_id is null
    or p_request_id is null
    or p_capability_hash !~ '^[0-9a-f]{64}$'
    or cardinality(p_storage_paths) not between 1 and 8
  then
    return false;
  end if;

  update private.website_form_upload_batches
  set
    request_id = coalesce(request_id, p_request_id),
    consumed_at = coalesce(consumed_at, now())
  where id = p_batch_id
    and capability_hash = p_capability_hash
    and storage_paths = p_storage_paths
    and expires_at > now()
    and request_id is null
    and consumed_at is null
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function private.consume_website_form_quota(text, text, integer, bigint, bigint, integer)
  from public, anon, authenticated;
revoke all on function private.create_website_form_upload_batch(uuid, text, text, text[], bigint, timestamptz, integer, bigint, integer)
  from public, anon, authenticated;
revoke all on function private.claim_website_form_upload_batch(uuid, text, text[], uuid)
  from public, anon, authenticated;

grant execute on function private.consume_website_form_quota(text, text, integer, bigint, bigint, integer)
  to service_role;
grant execute on function private.create_website_form_upload_batch(uuid, text, text, text[], bigint, timestamptz, integer, bigint, integer)
  to service_role;
grant execute on function private.claim_website_form_upload_batch(uuid, text, text[], uuid)
  to service_role;
