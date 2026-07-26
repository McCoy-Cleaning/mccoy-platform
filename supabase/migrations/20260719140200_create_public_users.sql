-- Phase 1 staff identity: public.users application profile (1:1 with auth.users)

create table if not exists public.users (
  id uuid primary key
    references auth.users (id)
    on delete cascade,

  account_kind public.account_kind not null,
  staff_role public.staff_role,

  status public.user_status not null default 'invited',

  email text not null,
  full_name text,

  blocked_at timestamptz,

  created_by uuid
    references public.users (id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint users_role_consistency_check check (
    (
      account_kind = 'staff'
      and staff_role is not null
    )
    or
    (
      account_kind = 'customer'
      and staff_role is null
    )
  ),

  constraint users_blocked_status_check check (
    (
      status = 'blocked'
      and blocked_at is not null
    )
    or
    (
      status <> 'blocked'
      and blocked_at is null
    )
  )
);

comment on table public.users is
  'Application profile linked to auth.users. Passwords and MFA live in Auth only.';

comment on column public.users.email is
  'Synchronized copy of auth.users.email for admin lists; Auth remains source of truth.';

create index if not exists users_account_kind_idx
  on public.users (account_kind);

create index if not exists users_staff_role_idx
  on public.users (staff_role)
  where account_kind = 'staff';

create index if not exists users_status_idx
  on public.users (status);

create index if not exists users_email_lower_idx
  on public.users (lower(email));
