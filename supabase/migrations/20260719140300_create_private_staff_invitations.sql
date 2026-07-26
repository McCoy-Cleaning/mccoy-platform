-- Phase 1 staff identity: private.staff_invitations

do $$ begin
  create type private.staff_invitation_status as enum (
    'pending',
    'sent',
    'accepted',
    'failed',
    'revoked',
    'expired'
  );
exception when duplicate_object then null;
end $$;

create table if not exists private.staff_invitations (
  id uuid primary key default gen_random_uuid(),

  email text not null,
  email_normalized text not null,
  intended_role public.staff_role not null,

  status private.staff_invitation_status not null default 'pending',

  auth_user_id uuid,
  invited_by uuid not null
    references public.users (id)
    on delete restrict,

  expires_at timestamptz,
  accepted_at timestamptz,

  last_error_code text,
  attempt_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_invitations_role_admin_only_check
    check (intended_role = 'admin')
);

comment on table private.staff_invitations is
  'Tracks Auth Admin invitations vs public.users profile creation; not exposed via Data API.';

comment on constraint staff_invitations_role_admin_only_check on private.staff_invitations is
  'Normal invite flow creates admin only; additional super_admin via bootstrap/runbook.';

create unique index if not exists staff_invitations_one_active_email_uq
  on private.staff_invitations (email_normalized)
  where status in ('pending', 'sent');

create index if not exists staff_invitations_status_idx
  on private.staff_invitations (status);

create index if not exists staff_invitations_invited_by_idx
  on private.staff_invitations (invited_by);
