# Playwright application audit — McCoy CMS + Aanvragen

**Date:** 2026-07-24  
**Scope:** Admin CMS/page-section builder + Storefront published CMS + website forms → request/email → Admin Aanvragen  
**Out of scope (excluded unless CMS/forms touch them):** commerce (cart, checkout, payments, orders, company registration, invoices, customer portal). Admin `/admin/products` and `/admin/users` are **UI stubs only** — exclude deep testing.

**Status legend**

| Status | Meaning |
|--------|---------|
| **implemented** | Feature works end-to-end in apps |
| **partial** | UI and/or server path exists with known gaps |
| **unavailable** | Route/UI present but non-functional or placeholder |
| **external-provider** | Requires Graph / IMAP / SMTP / Supabase MFA |
| **gap** | Missing for full E2E confidence |

---

## 1. Applications and stack

| App | Package | Dev origin | Stack |
|-----|---------|------------|-------|
| Storefront | `@mccoy/storefront` | `http://localhost:5173` | TanStack Start / Vite / React |
| Admin | `@mccoy/admin` | `http://localhost:5174` | TanStack Start / Vite / React |

Shared packages relevant to this audit: `@mccoy/cms-schema`, `@mccoy/cms-renderer`, `@mccoy/cms-editor`, `@mccoy/database`, `@mccoy/email`, `@mccoy/domain`, `@mccoy/validation`, `@mccoy/security`, `@mccoy/ui`.

CMS durable store (E2E): file store under `MCCOY_DATA_DIR` / `.data/e2e-cms` via `createFileCmsStore`.  
Website requests: JSON file `website-requests.json` under data dir (`packages/database` json-store).  
Admin E2E auth: legacy cookie session (`ADMIN_LEGACY_AUTH=true`, `MCCOY_E2E=1`); Supabase MFA path cleared in Playwright webServer env.

---

## 2. Admin routes

| Route | Status | Notes |
|-------|--------|-------|
| `/` | implemented | Redirects into `/admin` |
| `/admin/` | partial | Overview with **hardcoded** stats/activity; navigates to real modules |
| `/admin/login` | implemented | Legacy username/password when `ADMIN_LEGACY_AUTH`; else Supabase |
| `/admin/mfa` | external-provider | Supabase MFA challenge |
| `/admin/invite` | external-provider | Staff invite via Supabase/email |
| `/admin/settings` | partial | Staff settings surface (identity / password depending on auth mode) |
| `/admin/website/` | implemented | Page list, links to editors, media, navigation |
| `/admin/website/$pageId` | implemented | Full CMS editor: sections, edit iframe, preview, publish/discard, NL/EN |
| `/admin/website/media` | implemented | CMS media library |
| `/admin/website/other/navigation` | implemented | Site navigation editor |
| `/admin/inquiries` | **external-provider / partial** | **Aanvragen** UI reads **mailbox** (Microsoft Graph or IMAP). Form submit also persists structured requests to JSON, but list/detail UI requires inbox config. Filters: kind, scope, q |
| `/admin/products` | unavailable | Static mock catalogue — **exclude** from CMS E2E |
| `/admin/users` | unavailable | Static mock users — **exclude** from CMS E2E |

---

## 3. Storefront routes

| Route | Status | Notes |
|-------|--------|-------|
| `/` | implemented | Home CMS (`page_home`) |
| `/about` | implemented | `page_about` |
| `/services` | implemented | `page_services` |
| `/products` | implemented | **CMS content page** (hygiene products marketing), not ecommerce catalogue |
| `/contact` | implemented | Fixed form + CMS; submits `inquiry` |
| `/offerte` | implemented | Offerte forms (glass / furniture kinds) |
| `/vacatures` | implemented | Jobs + application form |
| `/vacatures/$slug` | implemented | Vacancy detail from published jobs block |
| `/en/`, `/en/$` | implemented | English locale path prefix |
| `/$customSlug` | implemented | Published custom pages (e.g. `/e2e-custom`) |
| `/cms-preview` | implemented | Authenticated/cross-origin preview for admin iframe |
| `/cms-sync` | implemented | Preview/edit bridge sync endpoint |
| `/schoonmaakbedrijf-enschede` | implemented | City landing |
| `/schoonmaakbedrijf-hengelo` | implemented | City landing |
| `/privacy`, `/terms` | implemented | Legal pages |
| `/sitemap.xml` | implemented | Sitemap |

---

## 4. CMS model

### 4.1 Builtin pages (`page_*`)

`page_home`, `page_about`, `page_services`, `page_products`, `page_contact`, `page_vacatures`, `page_offerte`.

### 4.2 Fixed sections (by page)

| Page | Fixed keys | Required |
|------|------------|----------|
| home | hero, partners, stats, workGallery | workGallery required |
| about | about.main | — |
| services | services.main | — |
| products | products.main | — |
| contact | contact.main, contact.info, contact.form | contact.form required |
| vacatures | vacatures.main | — |
| offerte | offerte.main, offerte.info, offerte.form | offerte.form required |

### 4.3 Publishable block types (29 — all publishable)

`hero`, `richText`, `centered`, `textImage`, `columns`, `benefits`, `quote`, `gallery`, `video`, `beforeAfter`, `carousel`, `steps`, `comparisonTable`, `featureGrid`, `spacer`, `teamGrid`, `teamProfile`, `values`, `timeline`, `roadmap`, `plans`, `cta`, `newsletter`, `contactForm`, `announcement`, `popup`, `portfolio`, `jobs`, `latestPosts`.

`UNPUBLISHABLE_BLOCK_TYPES` is empty (registry tests).

### 4.4 CMS workflows (implemented)

| Workflow | Status | Evidence |
|----------|--------|----------|
| Local draft / unsaved changes | implemented | Admin localStorage `mccoy_cms_v1` + draft maps |
| Edit canvas (storefront iframe) | implemented | `iframe[title="edit"]`, edit bridge |
| Full-page preview | implemented | `iframe[title="preview"]`, preview gate |
| Publish (locale-aware) | implemented | Server publish + durable revision |
| Discard | implemented | Discard draft UI + reload |
| NL / EN localization | implemented | `localeStates`, paths, LanguageToggle / admin locale panel |
| Custom pages | partial | Product forbids admin create; E2E seeds `page_e2e_custom` |
| Media picker | implemented | `/admin/website/media` + project images |
| Navigation | implemented | `/admin/website/other/navigation` |
| Content AI assist | partial / external-provider | Optional provider; not required for P0 CMS |

---

## 5. Forms → requests → Aanvragen

### 5.1 Form kinds (`FORM_KINDS`)

| Kind | Subject (NL) | Primary UI |
|------|--------------|------------|
| `inquiry` | Algemene aanvraag | `/contact` |
| `glass_washing` | Offerte glasbewassing | `/offerte` (window tab) |
| `furniture_cleaning` | Offerte meubelreiniging | `/offerte` (furniture tab) |
| `job_application` | Sollicitatie | `/vacatures` |
| `newsletter` | Nieuwsbrief-aanmelding | CMS `newsletter` block |

### 5.2 Fixed source IDs

- `fixed:contact:form`
- `fixed:offerte:form`
- `fixed:vacatures:application`

Plus CMS block ids for `contactForm` / `newsletter` when published.

### 5.3 Submit pipeline (implemented)

1. Client → `submitWebsiteForm` server fn (storefront/admin)  
2. Resolve published form scope from CMS revision (server-authoritative)  
3. `sendWebsiteFormEmail` → `createWebsiteRequest` (JSON store)  
4. SMTP notification if configured; **persistence succeeds without SMTP**  
5. Honeypot + rate limit enforced

### 5.4 Admin Aanvragen

| Capability | Status | Notes |
|------------|--------|-------|
| List/filter inbox | external-provider | Requires Graph **or** IMAP (`isFormInboxConfigured`) |
| Kind / scope / search filters | implemented (UI) | When inbox configured |
| Message detail + thread | external-provider | Graph/IMAP |
| Reply | external-provider | Graph send or SMTP fallback |
| Structured JSON request APIs | partial | Server fns exist; UI prefers mailbox path |
| Deterministic E2E inbox | **implemented** | `MCCOY_E2E=1` maps JSON website-requests → FormInbox (`packages/email/src/e2e-form-inbox.ts`) |

**Implication:** Standard Playwright cannot complete form→Aanvragen UI journey until a deterministic inbox adapter is added (Phase 16). Real Graph/IMAP stays in a separate integration project.

---

## 6. Existing Playwright infrastructure

| Asset | Status |
|-------|--------|
| `playwright.config.ts` | Present — Chromium + optional Brave; webServers; isolated data dir; legacy auth |
| `e2e/global-setup.ts` | Seeds builtins + published `page_e2e_custom` |
| `e2e/auth.setup.ts` | Mints legacy admin cookie + seeds localStorage custom page |
| `e2e/helpers/cms.ts` | Editor helpers (frames, sections, device canvas, templates) |
| Specs | CMS-focused: gallery, roadmap, plans, fixed section, preview gate, save/reload/discard, edit interaction, cross-origin bridge, custom page, screenshots, Brave smoke |
| npm scripts | `test:e2e`, `test:e2e:ui`, `test:e2e:update-snapshots`, `test:e2e:brave` |
| CI | `.github/workflows/cms-e2e.yml` (`E2E_USE_DEV=1`) |

**Coverage gaps vs Phase 0–23:** P0 smoke matrix incomplete; block inventory not exhaustive in E2E; forms/Aanvragen/cross-app journey missing; a11y/responsive/resilience/security-browser/visual only partially via screenshots; no provider-strategy docs/suites yet.

---

## 7. Security / auth notes for E2E

- Never point E2E at production data or live Mollie (N/A for this scope).  
- Legacy credentials only under `MCCOY_E2E` / Playwright env — not production defaults.  
- Do not log form PII in traces (mask emails in fixtures).  
- Admin products/users stubs must not be treated as authorization proof.

---

## 8. Gaps summary (pre-implementation)

1. **Deterministic E2E form inbox adapter** (critical for Phase 13–15).  
2. **Exhaustive section/block E2E inventory** beyond gallery/roadmap/plans/fixed.  
3. **Public NL/EN publish verification** suite incomplete.  
4. **Form coverage** for all five kinds + scoped CMS forms.  
5. **Global pageerror / console fail harness** may need strengthening.  
6. **A11y / responsive / multi-browser / resilience** suites thin or absent.  
7. **Commerce stubs** documented as exclude.

---

## 9. Recommended E2E architecture (post Phase 0–1)

```text
e2e/
  global-setup.ts          # reset file CMS + seed
  auth.setup.ts            # legacy admin storageState
  fixtures/                # page fixtures, failure detection, form helpers
  helpers/                 # cms, forms, requests, a11y
  smoke/                   # P0
  cms/                     # phases 4–12
  forms/                   # phases 13–15
  providers/               # contract vs real-provider (gated)
  quality/                 # a11y, responsive, resilience, security-obs, visual
```

Standard project: Chromium + deterministic adapters.  
Separate project: `graph-imap` (opt-in env credentials).
