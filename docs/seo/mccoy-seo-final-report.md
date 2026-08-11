# McCoy SEO Migration Hardening — Final Report (Phase 12)

**Date:** 2026-08-11  
**Canonical host:** `https://www.mccoy.nl`  
**Scope:** Phases 0–12 closeout (docs + quality gates). No visual redesign; no new service landings.  
**Deploy claim:** **Not deployed / not verified on production in this session.** Local acceptance only.

Safe Mode: [`SEO-SAFE-MODE.md`](./SEO-SAFE-MODE.md). Gate map: [`seo-regression-gate.md`](./seo-regression-gate.md).

---

## 1. Executive verdict

| Criterion | Local result |
|-----------|--------------|
| Phases 2–11 code intact + regression gate | **PASS** — `npm run test:seo` |
| Typecheck (security, cms-schema, database, storefront) | **PASS** (storefront: tiny `BuiltinPageKey` fix in on-page SEO gate test) |
| E2E / full storefront build | **Deferred** (runtime length; not required to claim local program closeout) |
| Production deploy verified | **No** — operator action |
| GSC / Bing / GBP / citations completed | **No** — operator action |

**Program acceptance (local):** Met for documentation + automated SEO regression. Production and search-engine operator steps remain open.

---

## 2. Issues found

Severity key: BLOCKER / HIGH / MEDIUM / LOW / OPPORTUNITY.

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| I1 | HIGH | Legacy marketing URLs soft-404’d as indexable HTML (`/ultrasoon`, `/actie`, `/cleaning`, …) | **Fixed in code** Phase 2 (301/410); **verify live after deploy** |
| I2 | HIGH | Live `/sitemap.xml` historically static / relative; city landings omitted from CMS builder | **Fixed in code** Phase 5 dynamic + consistency; **verify live after deploy** |
| I3 | HIGH | Relative / inconsistent canonicals on some NL pages (pre-hardening) | **Fixed in code** absolute www via `resolveSeoMetadata` |
| I4 | MEDIUM | `/en/terms`, `/en/privacy` Dutch bleed risk | **Mitigated** Phase 3 noindex + hreflang omit; EN overlays still ops |
| I5 | MEDIUM | Service `full` copy only in client modal (crawl gap) | **Fixed** Phase 7 SSR once + hash anchors |
| I6 | MEDIUM | Multi-job / drifted JobPosting risk on list | **Fixed** Phase 9 detail-only |
| I7 | MEDIUM | Possible Bremenstraat citations off-site | **Ops checklist** — repo NAP = Nijverheidsstraat 63 |
| I8 | LOW | Apex → www → 410 two-hop for Gone paths (Vercel cannot emit 410) | **Accepted** Phase 4 |
| I9 | LOW | Generic CMS image alts (`Image` / `Afbeelding`) | **Mitigated** Phase 10 sanitization |
| I10 | LOW | Storefront typecheck: `pageKey: string` in SEO gate fixture | **Fixed** Phase 12 (test typing only) |
| I11 | OPPORTUNITY | Six dedicated service landing URLs | **Deferred** — hashes on `/services` |
| I12 | OPPORTUNITY | More city landings (Almelo, …) | **Deferred** — approval-gated |
| I13 | OPPORTUNITY | Ecommerce `Product`/`Offer` JSON-LD | **Deferred** — [`product-seo-roadmap.md`](./product-seo-roadmap.md) |
| I14 | OPPORTUNITY | Admin SEO diagnostics UI (SEO-26) | **Deferred** |
| I15 | OPPORTUNITY | Authentic backlinks / GBP polish | **Ops** — [`mccoy-backlink-opportunities.md`](./mccoy-backlink-opportunities.md) |

No **BLOCKER** remaining in local automated gates.

---

## 3. Changes implemented (phase summary)

| Phase | Theme | Outcome |
|-------|-------|---------|
| 0 | Baseline / inventory | `mccoy-seo-baseline.md`, URL inventory, visual fingerprint before |
| 1–2 | Legacy URL map + HTTP 301/410 | `legacy-redirects.ts`, storefront `start.ts`, `vercel.json` mirrors |
| 3 | EN gaps | noindex Dutch-bleed legal EN; reciprocal hreflang rules |
| 4 | Host / slash (light) | www + trailing-slash one-hop; apex→410 chain documented |
| 5 | Sitemap ↔ indexability | eligibility + consistency modules; robots Allow `/` |
| 6 | On-page meta (authorized) | `frozen-deployed-seo.ts`; titles/H1/meta **DEPLOYED** |
| 7 | Services SSR | `ServiceDetailPanel` + crawlability tests |
| 8 | Internal links | footer `#` anchors, CmsLink hash, integrity gate |
| 9 | NAP / JobPosting | `business-nap.ts`; detail-only JobPosting; citation doc |
| 10 | Image alts / perf | sanitization + local perf report |
| 11 | Regression gate | `npm run test:seo` assertion map |
| 12 | Docs + closeout | This report + ops/content/product/backlink docs; typecheck fix |

### Notable code areas (not exhaustive)

- `packages/security` — indexing, host canonical, legacy redirects, internal-link integrity
- `packages/cms-schema` — resolve-seo, hreflang, business-nap, service-detail-anchors, image-alt
- `packages/database` — sitemap eligibility/consistency, IndexNow
- `apps/storefront` — robots/sitemap routes, middleware, frozen SEO, services SSR, city/vacancy heads, vercel.json

Protected cms-renderer / MG5 / Producten redesign / Aanvragen / auth: **not** used as SEO levers (diff-guard `protectedHits: 0`).

---

## 4. Redirect matrix

Source of truth: [`legacy-url-migration-map.md`](./legacy-url-migration-map.md).

| From | To / result | Status code |
|------|-------------|-------------|
| `/cleaning`, `/cleaning/` | `/services` | 301 |
| `/over-ons`, `/over-ons/` | `/about` | 301 |
| `/collegas-gezocht`, `/solliciteer-direct` (+ `/`) | `/vacatures` | 301 |
| `/privacybeleid` (+ `/`) | `/privacy` | 301 |
| `/ultrasoon`, `/actie` (+ `/`) | — | **410** |
| `/producten`, `/aanbiedingen`, `/offers` | `/products` (EN peers → `/en/products`) | 301 identity |
| `/jobs`, `/careers` | `/vacatures` (EN peers → `/en/vacatures`) | 301 identity |
| Non-legacy `…/` | slashless peer | host strip (307/301 per layer) |
| Apex `mccoy.nl/*` | `https://www.mccoy.nl/*` | 301 (then app 410 if Gone) |

---

## 5. Indexability matrix

| Surface | Indexable (prod policy) | Sitemap | Notes |
|---------|-------------------------|---------|-------|
| Core NL CMS (`/`, `/services`, `/products`, `/about`, `/contact`, `/offerte`, `/vacatures`, `/privacy`, `/terms`) | yes when published | yes if published + indexable | Phase 5 invariant |
| Core EN peers (except legal bleed / unpublished) | yes when published + indexable | yes | Reciprocal hreflang |
| `/en/offerte` unpublished | n/a (302 → NL) | no | |
| `/en/terms`, `/en/privacy` Dutch bleed | **noindex** | excluded | Until factual EN overlays |
| City landings | yes | **not** in CMS sitemap builder today | Static routes; consider later inclusion |
| `/vacatures/$slug` | yes if vacancy exists | **not** in CMS page sitemap | JobPosting on detail |
| Legacy 301/410 / aliases / preview | no | excluded | |
| Preview / non-prod hosts | noindex | n/a | robots Disallow `/` non-prod |

Details: [`sitemap-indexability.md`](./sitemap-indexability.md), [`locale-en-gaps.md`](./locale-en-gaps.md).

---

## 6. Metadata matrix

Authoritative deployed copy: [`proposed-metadata.md`](./proposed-metadata.md) (**DEPLOYED**).

| Route | Locale | Title / H1 / description | Status |
|-------|--------|---------------------------|--------|
| `/`, `/services`, `/products`, `/about`, `/contact`, `/offerte`, `/vacatures` | nl | Phase 6 frozen | DEPLOYED |
| `/en`, `/en/services`, `/en/products`, `/en/about`, `/en/contact`, `/en/vacatures` | en | Phase 6 frozen | DEPLOYED |
| `/en/offerte` | — | unpublished | NOT DEPLOYED |
| `/en/terms`, `/en/privacy` | en | no thin legal EN | noindex until overlays |
| City landings | nl | Existing city heads | Live route heads (not Phase 6 table) |
| Vacancy detail | nl/en | `{title} — Vacatures \| McCoy Cleaning` pattern | CMS-driven |

No ranking `<meta name="keywords">`.

---

## 7. Structured-data matrix

| Surface | `@type` | Rules |
|---------|---------|-------|
| All pages (root) | `CleaningService` | Single `@id` `https://www.mccoy.nl/#organization`; NAP from `business-nap.ts` |
| CMS pages | `WebPage` (+ optional `BreadcrumbList`) | Absolute www URLs |
| City landings | `WebPage` referencing org `@id` | No second LocalBusiness identity |
| `/products` | `ItemList` / product-like items | **No** Offer / price / AggregateRating |
| `/vacatures` | none JobPosting | List only |
| `/vacatures/$slug` | `JobPosting` | Fact-only; optional `datePosted` only if known |

Future Offer schema: [`product-seo-roadmap.md`](./product-seo-roadmap.md).

---

## 8. Keyword map summary

Full table: [`mccoy-keyword-map.md`](./mccoy-keyword-map.md).

| Bucket | Examples | Status |
|--------|----------|--------|
| Brand / Twente | schoonmaakbedrijf Twente, Oldenzaal | verified + Phase 6 |
| Services hub + hashes | schoonmaakdiensten Twente; six `#` anchors | verified |
| Products | McCoy Cleaning Products / groothandel | verified |
| Cities | Enschede, Hengelo landings | verified |
| Jobs | vacatures schoonmaak Twente | verified |
| Future cities / service URLs | Almelo; dedicated landings | candidate |
| Fake best-of / ultrasoon revival | — | avoid |

**No fabricated monthly volumes.**

---

## 9. Quality gates (Phase 12 run)

| Gate | Result | Notes |
|------|--------|-------|
| `npm run test:seo` | **PASS** | diff-guard `protectedHits: 0`; visible body unchanged vs after fixture; visual fingerprint OK; security 70; cms-schema 87; database 14; storefront SEO 17 |
| `typecheck` `@mccoy/security` | **PASS** | |
| `typecheck` `@mccoy/cms-schema` | **PASS** | |
| `typecheck` `@mccoy/database` | **PASS** | |
| `typecheck` `@mccoy/storefront` | **PASS** | After BuiltinPageKey fixture fix |
| `test:e2e` / full build | **Deferred** | Long runtime; not run in Phase 12 closeout |
| Live `www.mccoy.nl` probe | **Deferred** | Deploy-coupled; do not claim prod |

---

## 10. Remaining manual / operator actions

1. **Deploy** storefront (and any env) with Phases 2–11 to production `www.mccoy.nl`.
2. **Verify live:** 301/410 samples, dynamic sitemap body, robots, absolute canonicals, IndexNow key file.
3. **Google Search Console** — [`search-console-post-deploy.md`](./search-console-post-deploy.md).
4. **Bing Webmaster + IndexNow** — [`bing-post-deploy.md`](./bing-post-deploy.md).
5. **Google Business Profile / Bing Places / citations** — NAP alignment, Bremenstraat retirement — [`mccoy-local-citation-cleanup.md`](./mccoy-local-citation-cleanup.md).
6. **Optional:** factual EN legal overlays; publish EN offerte only with real copy.
7. **Optional:** production mobile Lighthouse attach to [`performance-seo-report.md`](./performance-seo-report.md).

---

## 11. Deferred opportunities

- Six dedicated service landing pages (keep `/services#…` until approved)
- Additional city landings beyond Enschede / Hengelo
- Ecommerce Product/Offer JSON-LD when prices are server-authoritative
- City URLs in CMS sitemap builder
- Admin SEO diagnostics UI (SEO-26)
- Authentic partnership backlinks (no spam) — [`mccoy-backlink-opportunities.md`](./mccoy-backlink-opportunities.md)
- Content body improvements via CCR — [`mccoy-content-improvement-proposals.md`](./mccoy-content-improvement-proposals.md)

---

## 12. Phase 12 deliverables checklist

| Doc | Action |
|-----|--------|
| [`mccoy-keyword-map.md`](./mccoy-keyword-map.md) | Updated (verified/candidate/avoid; service hashes) |
| [`mccoy-content-improvement-proposals.md`](./mccoy-content-improvement-proposals.md) | Created |
| [`product-seo-roadmap.md`](./product-seo-roadmap.md) | Created (Offer later + JobPosting note) |
| [`mccoy-backlink-opportunities.md`](./mccoy-backlink-opportunities.md) | Created |
| [`search-console-post-deploy.md`](./search-console-post-deploy.md) | Created |
| [`bing-post-deploy.md`](./bing-post-deploy.md) | Created |
| [`mccoy-seo-final-report.md`](./mccoy-seo-final-report.md) | Created (this file) |
| [`README.md`](./README.md) | Updated — program complete locally |
| [`seo-1-search-engines.md`](./seo-1-search-engines.md) | Extended with post-deploy links |

**Phase 12: complete (local).**
