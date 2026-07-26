-- Phase 1 staff identity: application schemas
-- private holds invitations, audit, and security-definer helpers (not Data API–exposed).

create schema if not exists private;

comment on schema private is
  'McCoy internal operational data and authorization helpers. Do not expose via PostgREST/Data API.';

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

grant usage on schema private to postgres;
grant usage on schema private to service_role;
