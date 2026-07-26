-- Expose `private` to PostgREST so service_role clients can use `.schema("private")`.
-- Security model unchanged:
--   - anon / authenticated still have NO schema USAGE and NO table privileges on private
--   - RLS remains enabled on private tables
--   - only service_role retains table grants (see earlier private.* migrations)
--
-- Hosted note: ALTER ROLE authenticator SET pgrst.db_schemas takes ownership of
-- exposed schemas away from the Dashboard UI. Prefer this migration when applying
-- via SQL Editor / db push. Equivalent Dashboard path (if not using this SQL):
--   Project Settings → Data API → Exposed schemas → add `private` → Save
--
-- Local already includes private via supabase/config.toml [api].schemas.

comment on schema private is
  'McCoy internal operational data and authorization helpers. Reachable via PostgREST only for roles with grants (service_role). anon/authenticated must not receive USAGE or table privileges.';

-- Keep public + storage + graphql_public (hosted defaults) and add private.
alter role authenticator set pgrst.db_schemas = 'public, storage, graphql_public, private';

notify pgrst, 'reload config';

-- Defense in depth: reaffirm browser roles cannot use private.
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to postgres;
grant usage on schema private to service_role;
