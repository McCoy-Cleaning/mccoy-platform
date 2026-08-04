# CMS Phase B–F implementation notes

## Persistence

- SQL: `supabase/migrations/20260718180000_cms_published_persistence.sql`
- Publish RPC + outbox: `supabase/migrations/20260719180000_cms_publish_rpc.sql`
- Content AI audit table: `supabase/migrations/20260719180100_cms_content_ai_audit.sql`
- App store: `@mccoy/database` → `getCmsStore()` (Supabase when `SUPABASE_SECRET_KEY` set, else `.data/cms-published.json`)

## Public runtime (B5 + C)

- Storefront hydrates from `getPublishedCmsBundle` — **not** `localStorage`
- `localStorage` only in `_cmsMode=edit` / preview bridge
- Resolver: `resolvePublicCmsRequest` — head/body same snapshot
- EN pending → **302** to NL; retired → **301/308**; unknown → **404**
- Sitemap: `/sitemap.xml` (published locales only)

## Editorial (D)

- Admin `LocalePublishPanel` — locale tabs, status chips, publish/rollback, noindex preview link (`_cmsLocale`)

## Content AI (E)

- Groq server-only (`GROQ_API_KEY`)
- Zod structural validation, semantic warnings, source-hash cache, audit log
- **Never auto-publishes** public locales
- **Opslaan auto-syncs EN drafts** for every translatable NL string (including nested
  `columns.0.title` / card fields): translates missing/changed NL, prunes deleted fields
- **Manual EN inputs** in admin inspectors: every editable NL copy field has an EN
  counterpart via `SectionAiToolbar` (“Engelse vertaling”), `InspectTextField`, or
  `ManualEnDraftField` / `NlEnField` (`block:{id}:{dottedField}` or
  `section:{sectionKey}:{dottedField}`). Non-copy fields (IDs, URLs, emails, phones,
  layout enums, spacer size, icon keys, image assets) intentionally have no EN control.

## Verify

### Editor preview

1. `npm run dev:admin` + `npm run dev:storefront`
2. Admin → Website → page → locale panel → Preview (noindex)
3. With `GROQ_API_KEY`, generate NL / translate EN drafts; apply manually; do not expect public EN until publish

### Production bilingual gates

1. Seed/publish NL via admin **Publiceer NL** (or auto-seed on first storefront request)
2. `GET /` serves NL snapshot head=body
3. `GET /en` → **302** `/` until EN published
4. Publish EN for home → `GET /en` renders English SEO + body (section/block `enFieldDrafts` overlaid onto NL base — not Dutch-only body)
5. `/sitemap.xml` includes EN only when `publicationState=published`
6. Language toggle switches client locale immediately; navigates to `/en` only when that locale is published (avoids 302 bounce). Static i18n and CMS section overlays share `useI18n().lang` / `useActiveCmsLocale`.

### Locale body resolution

- Active CMS locale = preview `?_cmsLocale=` → else `/en` URL → else client i18n lang
- `localizeCmsPageForLocale(page, "en")` applies `enFieldDrafts` onto `sectionContent` and `blocks`
- Missing EN draft → keep NL base value (partial translation; never invent copy at render)

## Monitoring (F5)

- Outbox processor logs `cms.page.published.processed`
- Content AI logs `content_ai.audit`
- Register hooks via `registerCmsPublishHook` for cache/recrawl

## Known gaps

- NL marketing routes (`/services`, etc.) still use static head fallbacks until each route wires `loadPublishedPageSnapshot` like `/`
- Dual-write file fallback when Supabase publish succeeds may lag; prefer one backend per environment
- Static `public/sitemap.xml` is legacy; prefer dynamic `/sitemap.xml` in robots.txt when cutting over
- Dynamic `/robots.txt` is env-gated (`MCCOY_ALLOW_INDEXING` / `VERCEL_ENV`) — see `packages/security/src/indexing.ts`
- Image **alt** EN drafts are editable in dedicated block image fields; some fixed-section
  `PrototypeImageField` alt controls may still rely on Opslaan auto-sync rather than an inline EN box
