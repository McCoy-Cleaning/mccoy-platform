-- Distinguish new-user onboarding invites from super-admin MFA account recovery.

do $$ begin
  create type private.staff_invitation_purpose as enum ('onboard', 'mfa_recovery');
exception when duplicate_object then null;
end $$;

alter table private.staff_invitations
  add column if not exists purpose private.staff_invitation_purpose not null default 'onboard';

comment on column private.staff_invitations.purpose is
  'onboard = new staff invite (password + MFA); mfa_recovery = super-admin authenticator reset only.';
