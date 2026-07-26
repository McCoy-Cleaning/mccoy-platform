-- Phase 1 staff identity: public enums (customer reserved for later)

do $$ begin
  create type public.account_kind as enum ('staff', 'customer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.staff_role as enum ('super_admin', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_status as enum ('invited', 'active', 'blocked');
exception when duplicate_object then null;
end $$;

comment on type public.account_kind is 'Platform account kind; only staff is created in Phase 1.';
comment on type public.staff_role is 'Internal McCoy staff roles. Never use product_customer/service_client/guest here.';
comment on type public.user_status is 'Staff lifecycle: invited until MFA onboarding completes; blocked for revocation.';
