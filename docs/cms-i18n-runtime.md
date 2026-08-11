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
- **AI never auto-publishes** by itself — only Opslaan / Publiceer actions write live
  revisions
- **Opslaan & publiceren** always publishes NL. It also publishes EN when:
  1. EN is already `published` (local or server) — republish so `enFieldDrafts` refresh
     live `/en` overlays and freshness returns to `current`, or
  2. the page has any `enFieldDrafts` keys — **first EN go-live** happens on Opslaan
     (toast: “NL + EN gepubliceerd”), synthesizing `localeContent.en` the same way as
     **Publiceer EN**
- **Publiceer EN** in `LocalePublishPanel` remains for explicit republish / coverage-gated
  publish; EN can still be moved back to concept separately
- **Opslaan auto-syncs EN drafts** for every translatable NL string (including nested
  `columns.0.title` / card fields) via `classifyEnOverlayValidity`: missing, blank,
  EN===NL (`source_echo`), and empty `override_removed` are queued for NL→EN;
  distinct EN drafts are kept; empty/deleted NL prunes EN
- **Clearing a previous EN override** deletes the overlay key and marks
  `enFieldDraftMeta` as `override_removed` (NL fallback on `/en` until refill).
  Opslaan and “Ontbrekende velden vertalen” both refill empty `override_removed`
  (no second clear required for stuck pages). Clearing an empty/never-translated
  EN slot does **not** set `override_removed` — it stays `missing` and Opslaan
  auto-fills it. `intentional_blank` remains a separate choice (render empty EN,
  not NL; never auto-filled). Limitation: distinct non-empty EN that differs from
  NL is treated as valid English (no ML language detection).
- **Manual EN inputs** in admin inspectors: every editable NL copy field has an EN
  counterpart via `SectionAiToolbar` (“Engelse vertaling”), `InspectTextField`, or
  `ManualEnDraftField` / `NlEnField` (`block:{id}:{dottedField}` or
  `section:{sectionKey}:{dottedField}`). Non-copy fields (IDs, URLs, emails, phones,
  layout enums, spacer size, icon keys, image assets) intentionally have no EN control.

## Verify

### Editor preview

1. `npm run dev:admin` + `npm run dev:storefront`
2. Admin → Website → page → locale panel → Preview (noindex)
3. With `GROQ_API_KEY`, generate NL / translate EN drafts; apply manually; Opslaan with EN
   drafts publishes `/en` (no separate Publiceer EN required)

### Production bilingual gates

1. Seed/publish NL via admin **Publiceer NL** (or auto-seed on first storefront request)
2. `GET /` serves NL snapshot head=body
3. `GET /en` → **302** `/` until EN published (no drafts / EN never published)
4. Fill EN fields + **Opslaan & publiceren** (or **Publiceer EN**) → `GET /en` renders
   English SEO + body (section/block `enFieldDrafts` overlaid onto NL base)
5. `/sitemap.xml` includes EN only when `publicationState=published` **and** indexable (Phase 5: Dutch-bleed `/en/terms`/`/en/privacy` omitted; see `docs/seo/sitemap-indexability.md`)
6. Language toggle switches client locale immediately; navigates to `/en` only when that locale is published (avoids 302 bounce). Static i18n and CMS section overlays share `useI18n().lang` / `useActiveCmsLocale`.

### Locale body resolution

- Active CMS locale = preview `?_cmsLocale=` → else `/en` URL → else client i18n lang
- `localizeCmsPageForLocale(page, "en")` applies `enFieldDrafts` onto `sectionContent` and `blocks`
- Missing EN draft → keep NL base value (partial translation; never invent copy at render)
- **Phase 3:** published EN legal (`terms` / `privacy`) without EN overlays → `noindex,follow` + omitted from hreflang (see `docs/seo/locale-en-gaps.md`)
- Hreflang / sitemap alternates require published **and** indexable (`getPublishedLocaleAlternates` `indexable` flag)

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
