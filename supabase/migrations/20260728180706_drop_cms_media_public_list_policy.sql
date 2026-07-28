-- Lint 0025_public_bucket_allows_listing:
-- Public bucket `cms-media` is already readable by object URL. A broad SELECT
-- policy on storage.objects lets anon/authenticated clients enumerate every
-- file via the Storage list API. Catalog listing stays on private.cms_media_assets
-- (service_role). Uploads/deletes use the service role and bypass RLS.
--
-- https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0025_public_bucket_allows_listing

drop policy if exists "cms_media_public_read" on storage.objects;
