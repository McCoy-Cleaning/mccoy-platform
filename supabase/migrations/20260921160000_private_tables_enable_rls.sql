-- Enable RLS on the four `private` tables that were created without it.
--
-- Today these are unreachable from the browser because `private` grants no schema
-- USAGE to anon/authenticated (see 20260723170000_expose_private_schema_postgrest.sql,
-- which already documents "RLS remains enabled on private tables" — an assertion
-- these tables did not satisfy). The `private` schema IS exposed to PostgREST, so a
-- single future `grant usage` would expose invitation token hashes, staff invitations,
-- audit history, and queued customer email without any row-level gate.
--
-- Deny by default: no policies are created for anon/authenticated. Trusted access
-- keeps working unchanged because service_role holds BYPASSRLS and the existing
-- SECURITY DEFINER helpers (private.write_audit_log and friends) run as the table
-- owner. `force row level security` is deliberately NOT used here — it would also
-- subject the owner and those definer functions to RLS and break audit/outbox writes.

alter table private.audit_logs enable row level security;
alter table private.staff_invitations enable row level security;
alter table private.customer_invitations enable row level security;
alter table private.commerce_email_outbox enable row level security;

comment on table private.audit_logs is
  'Security-sensitive action history. RLS enabled with no anon/authenticated policies: service_role and SECURITY DEFINER helpers only.';

comment on table private.customer_invitations is
  'Portal invitations incl. token_hash. RLS enabled with no anon/authenticated policies: reachable only via trusted server code.';

-- Defense in depth: reaffirm that browser roles hold no privileges on these tables.
revoke all on table private.audit_logs from public, anon, authenticated;
revoke all on table private.staff_invitations from public, anon, authenticated;
revoke all on table private.customer_invitations from public, anon, authenticated;
revoke all on table private.commerce_email_outbox from public, anon, authenticated;

grant select, insert, update, delete on table private.audit_logs to service_role;
grant select, insert, update, delete on table private.staff_invitations to service_role;
grant select, insert, update, delete on table private.customer_invitations to service_role;
grant select, insert, update, delete on table private.commerce_email_outbox to service_role;
