# CMS media library (Supabase Storage)

Status: implemented (v1). Replaces prototype data-URL uploads with a path-canonical catalog and public Storage bucket.

## Canonical identity

| Field | Role |
|-------|------|
| `id` (uuid) | Durable asset id → `CmsImage.assetId = storage:<uuid>` |
| `bucket_id` + `storage_path` | **Source of truth** for the object |
| `content_hash` (SHA-256) | Idempotent seed / dedupe |
| Derived public URL | Computed in app code from `SUPABASE_URL` + bucket + path — **not** stored as canonical |
| `CmsImage.src` | Rendering snapshot / fallback at pick time |

## Schema

- Table: `private.cms_media_assets` (service_role only; not PostgREST-exposed to browsers)
- Bucket: `cms-media` (public **read**, no public write)
- Migration: `supabase/migrations/20260723160000_cms_media_assets.sql`

## Upload contract

1. Browser compresses (Canvas) for photo/logo profiles
2. `adminUploadCmsMedia` (proxied small payload) validates magic bytes, dims, pixels, size
3. Upload Storage object (`upsert: false`) → insert catalog row
4. On catalog failure → delete Storage object (compensation)
5. Idempotency via `idempotency_key` and active `content_hash`

API is shaped so a future **authorize → direct Storage PUT → finalize** path can replace the proxy without changing editor props (`uploadToMediaLibrary`).

**Project-path picks:** seeded static files under `apps/storefront/public/images` remain on disk for storefront delivery and defaults. When an admin clicks a project thumbnail, the editor prefers the matching catalog row tagged `source:/images/...` (from `scripts/seed-cms-media.ts`) so the page stores a `storage:<uuid>` + public URL — not a durable `local:` path. If the seed was never run, the pick falls back to `/images/...` with a status hint.

**Read-time remaps:** `migrateOriginal*Images` only rewrite incorrect *local* legacy paths. They do **not** pull Supabase URLs back to `/images/cms`.

## Formats (v1)

- Allowed: JPEG, PNG, WebP; GIF only for animation profile
- **SVG rejected** (active content). Trusted brand SVGs stay as static `/images` files.

## Profiles

| Profile | Formats | Notes |
|---------|---------|--------|
| photo | JPEG/PNG/WebP | Edge/pixel caps; prefer WebP after browser compress |
| logo | PNG/WebP | Preserve alpha; no forced lossy photo path |
| gif | GIF | No canvas recompression that kills animation |

## Archive vs delete

- **Archive:** hidden from picker/library lists; pages keep rendering; **public URL remains reachable**
- **Delete:** exceptional; requires empty `findCmsMediaReferences` (draft + published scan); removes Storage object; tombstone `status=deleted`; audited

## Legacy migration

- Phase A: warning banner when page has data-URL / `upload:` images
- Phase B: explicit “Migreer ingesloten afbeeldingen”
- Phase C: **Opslaan/publish blocked** until legacy embeds are gone

## Admin UI

- Website → Mediabibliotheek (`/admin/website/media`)
- Inspectors/Hero/partners/gallery/nav logo: `uploadToMediaLibrary` → Storage
- Audit actions via `private.audit_logs`: `cms.media.*`

## Seed (existing static images → Storage)

Upload every image under `apps/storefront/public/images` (partners, cms, hero placeholder, etc.) into the `cms-media` bucket and `private.cms_media_assets`. Idempotent on `content_hash` (and on `source:/images/...` tags when seed-time compression changes the hash). Each asset is tagged with `source:/images/...` for matching.

**Oversized static assets:** the seed compresses with `sharp` (resize to profile edge caps, WebP/JPEG/PNG) so stored objects stay within the **900 KB** limit. Do not raise that permanent limit for seed convenience — logos prefer WebP/PNG; large photos may become WebP/JPEG.

By default the script also **rewrites CMS content** so `local:…` / `/images/…` become `storage:<uuid>` + derived public URL. Rewrite uses the CmsStore API only:

- **Drafts:** `saveDraft` with rewritten payload
- **Live pages:** `publishPage` creates a **new** published revision

It never `UPDATE`s an existing published revision payload (immutability trigger / domain rule). Previous published revisions stay intact and are superseded.

```bash
# From monorepo root (loads root .env via ensureMonorepoEnvLoaded)
npx tsx scripts/seed-cms-media.ts

# Catalog only — upload/dedupe, do not rewrite CMS JSON
npx tsx scripts/seed-cms-media.ts --no-rewrite
```

Requires:

- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- Publishable key (`SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SECRET_KEY` (service role — server only)
- Migration `supabase/migrations/20260723160000_cms_media_assets.sql` applied (table + `cms-media` bucket)
- Migration `supabase/migrations/20260723170000_expose_private_schema_postgrest.sql` applied **or** Dashboard expose (below). Safe while `anon` / `authenticated` have no grants on `private` tables. Already set in `supabase/config.toml` for local.

If the seed exits with `Invalid schema: private`, expose the schema and re-run — do not disable RLS.

### Expose `private` on hosted Supabase (required for seed + CMS media service client)

**Option A — SQL (preferred; also in the migration above)**

1. Open [SQL Editor](https://supabase.com/dashboard/project/bwrktdwnnlgxdpefecmv/sql/new) for project `bwrktdwnnlgxdpefecmv` (must be signed in as the project owner/org member).
2. Run:

```sql
alter role authenticator set pgrst.db_schemas = 'public, storage, graphql_public, private';
notify pgrst, 'reload config';
```

3. Do **not** grant `anon` / `authenticated` USAGE on `private`. Do **not** disable RLS.
4. Note: after `ALTER ROLE authenticator SET pgrst.db_schemas`, the Dashboard “Exposed schemas” UI no longer owns this list — update via SQL if schemas change again. To return control to the Dashboard: `alter role authenticator reset pgrst.db_schemas;` then set schemas in the UI.

**Option B — Dashboard**

1. Open [Project Settings → Data API](https://supabase.com/dashboard/project/bwrktdwnnlgxdpefecmv/settings/api).
2. Under **Exposed schemas**, add `private` alongside `public`, `storage`, and `graphql_public` (keep those).
3. Save.
4. Retry `npx tsx scripts/seed-cms-media.ts`.

Summary line reports `created` / `skipped` / `failed` / `compressed`, tag updates, and how many draft vs newly published image refs were rewritten.

## Privileged runtime

Admin TanStack server functions + `createSupabaseServiceClient()` (same as CMS publish). Secret never in Vite/`VITE_*` or storefront bundles.

## Alt text

- `alt_default` = library default for new picks
- `CmsImage.alt` = per-use contextual value (never silently rewritten when library default changes)
- `decorative: true` → empty alt in renderer
