-- Phase 2 completion: one pending Account Admin invitation per company
-- Complements customer_invitations_one_pending_per_target_uq (company, email, role)

-- Pre-flight: fail if multiple pending account_admin invites exist for one company
do $$
begin
  if exists (
    select company_id
    from private.customer_invitations
    where status = 'pending'
      and intended_role = 'account_admin'
    group by company_id
    having count(*) > 1
  ) then
    raise exception
      'commerce_phase2_admin_invite: multiple pending account_admin invitations per company — revoke extras before migration';
  end if;
end $$;

create unique index if not exists customer_invitations_one_pending_admin_per_company_uq
  on private.customer_invitations (company_id)
  where status = 'pending' and intended_role = 'account_admin';

comment on index private.customer_invitations_one_pending_admin_per_company_uq is
  'Only one Account Admin onboarding candidate per company at a time.';
