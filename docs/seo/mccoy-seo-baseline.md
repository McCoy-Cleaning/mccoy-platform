# McCoy SEO baseline — route matrix (Phase 0)

Captured **2026-08-11** for SEO Migration Hardening. Docs only; no redirects implemented in this phase.

Extends [`url-inventory.md`](./url-inventory.md) and [`seo-baseline.md`](./seo-baseline.md). Does **not** invent GSC ranks or traffic.

**Canonical origin (code):** `https://www.mccoy.nl` (`packages/cms-schema/src/resolve-seo.ts`, `packages/security/src/host.ts`).

**Sources:** storefront routes + `routeTree.gen.ts`, CMS seeds (`packages/database/src/cms/seeds.ts`), `frozen-deployed-seo.ts`, `resolve-seo.ts`, `__root__.tsx`, city/vacancy heads, sitemap builder, live probes to production.

---

## How to read the matrix

| Column | Meaning |
|--------|---------|
| **Status** | Live HTTP from `https://www.mccoy.nl` when probed; else `TBD_LIVE` |
| **Canonical** | Code-expected absolute URL, or live `<link rel="canonical">` when noted |
| **Language** | Primary HTML/content locale |
| **Title** | Code head / frozen SEO / live `<title>` |
| **H1** | Expected from source components (live SSR count noted where measured) |
| **Sitemap** | Whether dynamic CMS sitemap builder *should* include; live `/sitemap.xml` note below |
| **Indexable** | Production robots meta expected (`index,follow` when host allows) |
| **notes** | SSR gaps, aliases, structured data, caveats |

Live probes used `curl` HEAD + Python GET (some timeouts → `TBD_LIVE`).

---

## Live production caveats (2026-08-11)

1. **Trailing slash:** `…/path/` → **307** → `/path` (host middleware). Prefer documenting slashless canonicals; slash variants are normalize-only today.
2. **Soft 404s:** Unknown paths (`/ultrasoon`, `/actie`, `/over-ons`, `/cleaning`, …) return **HTTP 404** HTML titled `{slug} — McCoy Cleaning` with **`robots: index, follow`** and **no canonical** — soft-indexable 404s. Phase 2 must replace with real 301/410 semantics.
3. **Live `/sitemap.xml`:** Still a **legacy static** XML (relative `<loc>`, comment about preferring dynamic API). Code route `sitemap[.]xml.ts` builds **dynamic** published CMS entries — production artifact may lag. City landings are **not** emitted by `buildPublishedSitemapEntries` (CMS pages only).
4. **Identity aliases live today:** `/producten`→`/products`, `/jobs`→`/vacatures`, `/aanbiedingen`→`/products`, `/offers`→`/products`, `/careers`→`/vacatures` (**301** via `$customSlug` + `PUBLIC_IDENTITY_PATH_ALIASES`).
5. **`/en/offerte`:** Live **302** → `/offerte` (EN unpublished / pending policy).
6. **Canonical inconsistency live:** Home/EN often absolute `https://www.mccoy.nl…`; several NL marketing pages emit **relative** canonicals (`/services`) — Phase 6 follow-up (code path now absolute via `resolveSeoMetadata`).
7. **Phase 3 locale:** See [`locale-en-gaps.md`](./locale-en-gaps.md). `/en/terms` + `/en/privacy` Dutch bleed → **noindex** + no EN hreflang until factual EN overlays exist. `og:locale` matches URL locale (`nl_NL` / `en_GB`).
8. **Phase 4 light (host/slash + legacy):** Non-legacy trailing slash remains host-layer only; legacy paths compose slash+301/410 in one app response. Remaining chain risk: **apex `mccoy.nl/ultrasoon` → www then 410** (Vercel cannot emit 410) — acceptable vs soft-404.
9. **Phase 5 sitemap:** Every sitemap URL must be published 200 + indexable + self-canonical www; legacy/410/noindex/aliases excluded — see [`sitemap-indexability.md`](./sitemap-indexability.md).

---

## Services modal — SSR vs client

`ServicesCards` (`apps/storefront/src/components/site/sections/ServicesSections.tsx`):

- Card teaser/`desc` renders in the grid (SSR).
- **`full` detail paragraphs render only inside a client portal modal** (`createPortal` + `typeof document !== "undefined"`), gated on `open !== null`.
- Phase 7 ships one-instance SSR of `full` copy (see [phase7-services-ssr.md](./phase7-services-ssr.md)); no `sr-only` duplicate.

Live `/services` probe: **h1=0** in initial HTML (likely CMS layout/hidden `services.main` or hydration timing); code still defines `<h1>` in `ServicesMain`.

---

## Structured data (from code)

| Surface | JSON-LD `@type` (code) |
|---------|------------------------|
| All pages via `__root__.tsx` | `CleaningService` (org/NAP) |
| CMS marketing pages via `resolveSeoMetadata` | `WebPage` (+ optional `BreadcrumbList` in `@graph` when path has segments) |
| `/products` route head | `ItemList` → `Product` / `Service` items |
| `/vacatures` route head | no JobPosting (Phase 9 — list eligibility) |
| `/vacatures/$slug` | one fact-only `JobPosting` referencing org `@id` |
| `/vacatures/:slug` | none dedicated in route head (inherits root) |
| City landings | `LocalBusiness` via `cityJsonLd` **plus** root `CleaningService` |

No invented reviews/ratings/prices in these nodes.

---

## Core NL routes

| URL | Status | Canonical | Language | Title | H1 | Sitemap | Indexable | notes |
|-----|--------|-----------|----------|-------|----|---------|-----------|-------|
| `/` | 200 | `https://www.mccoy.nl` (code+live) | nl | Phase 6: `McCoy Cleaning — Schoonmaakbedrijf Twente \| Oldenzaal` | H1: McCoy Cleaning, schoonmaakbedrijf in Twente. | CMS yes (if published) | yes | ld scripts live=2 (`CleaningService` + `WebPage`) |
| `/services` | 200 | code: `…/services`; live relative `/services` | nl | Phase 6: `Schoonmaakdiensten Twente — McCoy Cleaning` | H1: Schoonmaakdiensten in Twente | CMS yes | yes | Phase 7: `full` SSR once + hash anchors; cards SSR |
| `/products` | 200 | code: `…/products`; live `/products` | nl | Phase 6: `Producten — McCoy Cleaning Products \| Groothandel` | H1 Producten (eyebrow); H2 scent | CMS yes | yes | Protected Producten surface; ItemList JSON-LD |
| `/about` | 200 (HEAD); GET `TBD_LIVE` once | code: `…/about`; live `/about` | nl | Phase 6: `Over McCoy Cleaning — Schoonmaakbedrijf Twente sinds 1998` | H1: Over McCoy Cleaning | CMS yes | yes | Legacy slug `/over-ons` still in migration fixtures — not public route |
| `/contact` | 200 | code: `…/contact`; live `/contact` | nl | Phase 6: `Contact — McCoy Cleaning Twente \| Oldenzaal` | Form chrome `<h1>` | CMS yes | yes | Form SSR |
| `/offerte` | 200 | code: `…/offerte`; live `/offerte` | nl | Phase 6: `Offerte aanvragen — Schoonmaak Twente \| McCoy Cleaning` | Form chrome `<h1>` | CMS yes | yes | |
| `/vacatures` | 200 | code: `…/vacatures`; live `/vacatures` | nl | Phase 6 frozen (keywords meta removed) | Form chrome `<h1>` Werken bij McCoy Cleaning | CMS yes | yes | Phase 9: no JobPosting on list |
| `/vacatures/:slug` | TBD_LIVE (content-dependent) | `…/vacatures/{slug}` | nl | `{slug} — Vacatures \| McCoy Cleaning` | Vacancy title `<h1>` | **No** (not in CMS sitemap builder) | yes if vacancy exists | 404 if slug missing |
| `/privacy` | 200 | `…/privacy` | nl | Frozen: `Privacyverklaring — McCoy Cleaning` | Legal `<h1>` | CMS yes | yes | |
| `/terms` | 200 | `…/terms` | nl | Frozen: `Algemene Voorwaarden — McCoy Cleaning` | Legal `<h1>` | CMS yes | yes | |
| `/schoonmaakbedrijf-enschede` | 200 | `…/schoonmaakbedrijf-enschede` (often relative live) | nl | `Schoonmaakbedrijf Enschede — McCoy Cleaning` | `CityLanding` `<h1>` | **Not** in CMS sitemap builder | yes | Static route; LocalBusiness JSON-LD |
| `/schoonmaakbedrijf-hengelo` | 200 | `…/schoonmaakbedrijf-hengelo` | nl | `Schoonmaakbedrijf Hengelo — McCoy Cleaning` | `CityLanding` `<h1>` | **Not** in CMS sitemap builder | yes | Same pattern |

### Trailing-slash variants (NL)

| URL | Status | Canonical | Language | Title | H1 | Sitemap | Indexable | notes |
|-----|--------|-----------|----------|-------|----|---------|-----------|-------|
| `/services/` etc. | 307 → slashless | slashless target | nl | (same after hop) | — | no | n/a | Existing slash strip; Phase 2 must not chain with legacy 301s |
| `/products/` | 307 → `/products` | `/products` | nl | — | — | no | n/a | Confirmed live |

---

## Core EN routes

| URL | Status | Canonical | Language | Title | H1 | Sitemap | Indexable | notes |
|-----|--------|-----------|----------|-------|----|---------|-----------|-------|
| `/en` | 200 | `https://www.mccoy.nl/en` | en | Phase 6: Cleaning Company Twente \| Oldenzaal | Home hero H1 | CMS yes if EN published | yes | |
| `/en/services` | 200 | `https://www.mccoy.nl/en/services` | en | Phase 6: Cleaning Services Twente | Cleaning services in Twente | CMS yes | yes | Absolute canonical live |
| `/en/about` | 200 | `…/en/about` | en | Phase 6: About McCoy Cleaning … since 1998 | About McCoy Cleaning | CMS yes | yes | |
| `/en/products` | 200 | `…/en/products` | en | Phase 6: Products \| Wholesale | Products H1 / scent H2 | CMS yes | yes | |
| `/en/contact` | 200 | `…/en/contact` | en | Phase 6: Contact … Twente \| Oldenzaal | form H1 | CMS yes | yes | |
| `/en/offerte` | 302 → `/offerte` | — | — | — | — | no while unpublished | n/a | Pending-EN → NL policy |
| `/en/vacatures` | 200 | `…/en/vacatures` | en | Live: `Vacancies` | form H1 (live 0) | CMS yes | yes | |
| `/en/privacy` | 200 | `…/en/privacy` | en | Live: `Privacyverklaring` | legal H1 | CMS yes | **noindex until EN overlays** (Phase 3) | Dutch bleed → see locale-en-gaps |
| `/en/terms` | 200 | `…/en/terms` | en | Live: `Algemene voorwaarden` | legal H1 | CMS yes | **noindex until EN overlays** (Phase 3) | Same EN bleed; no hreflang to EN |
| `/en/*` custom | TBD_LIVE | per published custom slug | en | CMS seo | CMS | only if published | yes | `en.$.tsx` |

---

## Identity aliases (already 301 in code/live)

| URL | Status | Canonical | Language | Title | H1 | Sitemap | Indexable | notes |
|-----|--------|-----------|----------|-------|----|---------|-----------|-------|
| `/producten` | 301 → `/products` | `/products` | nl | (target) | — | **exclude** | no | `PUBLIC_IDENTITY_PATH_ALIASES` |
| `/jobs` | 301 → `/vacatures` | `/vacatures` | nl | (target) | — | **exclude** | no | |
| `/aanbiedingen` | 301 → `/products` | `/products` | nl | (target) | — | **exclude** | no | Promo alias → products; **≠** legacy `/actie` |
| `/offers` | 301 → `/products` | `/products` | en/nl | (target) | — | **exclude** | no | |
| `/careers` | 301 → `/vacatures` | `/vacatures` | en/nl | (target) | — | **exclude** | no | |
| `/en/producten`, `/en/jobs` | expected 301 | EN canonical | en | — | — | **exclude** | no | Conformance tests cover |

---

## Legacy paths (current live = soft 404; Phase 1 map → Phase 2)

| URL | Status | Canonical | Language | Title | H1 | Sitemap | Indexable | notes |
|-----|--------|-----------|----------|-------|----|---------|-----------|-------|
| `/ultrasoon` | 404 soft | none | n/a | `ultrasoon — McCoy Cleaning` | 0 | must exclude | live wrongly indexable | Target Phase 2: **410**; see migration map |
| `/ultrasoon/` | 307 → `/ultrasoon` | — | — | — | — | no | n/a | Then soft 404 |
| `/actie` | 404 soft (GET timeout once) | none | n/a | `actie — McCoy Cleaning` | 0 | must exclude | live wrongly indexable | Historical glass promo — **not** products |
| `/over-ons` | 404 soft | none | n/a | `over-ons — McCoy Cleaning` | 0 | must exclude | wrongly indexable | Map → `/about` |
| `/cleaning` | 404 soft | none | n/a | `cleaning — McCoy Cleaning` | 0 | must exclude | wrongly indexable | Map → `/services` |
| `/collegas-gezocht` | 404 soft | none | n/a | slug title | 0 | must exclude | wrongly indexable | Map → `/vacatures` |
| `/solliciteer-direct` | 404 soft | none | n/a | slug title | 0 | must exclude | wrongly indexable | Map → `/vacatures` |
| `/privacybeleid` | 404 soft | none | n/a | slug title | 0 | must exclude | wrongly indexable | Map → `/privacy` |

---

## Non-index / technical

| URL | Status | Canonical | Language | Title | H1 | Sitemap | Indexable | notes |
|-----|--------|-----------|----------|-------|----|---------|-----------|-------|
| `/cms-preview` | TBD_LIVE | n/a | — | — | — | no | no | robots Disallow |
| `/cms-sync` | TBD_LIVE | n/a | — | — | — | no | no | robots Disallow |
| `/sitemap.xml` | 200 | n/a | — | XML | — | self | — | Live static legacy body; code dynamic elsewhere |
| `/robots.txt` | 200 | n/a | — | text | — | — | — | Allow `/`; Disallow preview/sync; Sitemap www |

Live robots body:

```text
User-agent: *
Allow: /
Disallow: /cms-preview
Disallow: /cms-sync
Sitemap: https://www.mccoy.nl/sitemap.xml
```

---

## Visual fingerprint baseline

Structural (source) fingerprints for redesign detection:  
[`docs/seo/baselines/public-visual-fingerprint.before.json`](./baselines/public-visual-fingerprint.before.json) (Phase 0). Current expected: [`public-visual-fingerprint.after.json`](./baselines/public-visual-fingerprint.after.json) (Phase 6–10 intentional SEO edits; checked by `seo:visual-fingerprint:check`).

No screenshots changed; no CSS/layout edits in Phase 0–1.

---

## Operator / GSC cells (unchanged stubs)

Do not invent ranks. Fill later in [`indexation-baseline.md`](./indexation-baseline.md) / Phase 12 reports.
