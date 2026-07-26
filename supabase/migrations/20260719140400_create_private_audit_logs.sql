-- Phase 1 staff identity: private.audit_logs (append-only)

create table if not exists private.audit_logs (
  id uuid primary key default gen_random_uuid(),

  actor_user_id uuid
    references public.users (id)
    on delete set null,

  action text not null,

  target_type text not null,
  target_id uuid,

  before_data jsonb,
  after_data jsonb,

  request_id uuid,
  metadata jsonb,

  created_at timestamptz not null default now()
);

comment on table private.audit_logs is
  'Append-only security audit trail for staff management. No ordinary update/delete.';

create index if not exists audit_logs_created_at_idx
  on private.audit_logs (created_at desc);

create index if not exists audit_logs_actor_idx
  on private.audit_logs (actor_user_id);

create index if not exists audit_logs_action_idx
  on private.audit_logs (action);

create index if not exists audit_logs_target_idx
  on private.audit_logs (target_type, target_id);

revoke update, delete, truncate on table private.audit_logs from public;
revoke update, delete, truncate on table private.audit_logs from anon;
revoke update, delete, truncate on table private.audit_logs from authenticated;

grant insert, select on table private.audit_logs to service_role;
revoke update, delete, truncate on table private.audit_logs from service_role;
