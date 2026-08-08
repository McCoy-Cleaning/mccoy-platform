# R7 — Storefront composition audit

**Status:** Complete (structural cleanup)  
**Date:** 2026-08-08  
**Phase:** R7 — Storefront composition cleanup  
**Preconditions:** R5 complete · M5 inventory present · R6 committed (`4c47a0d`)

## Phase 0 baseline (before changes)

| File | Lines | Role |
|------|------:|------|
| `sections/SitePageSections.tsx` | 677 | Mixed fixed views: About + Services + Products |
| `BlockView.tsx` | 298 | Form adapters + presentation overrides + RegisteredBlockView |
| `PageLayoutRenderer.tsx` | 391 | Layout walk + fixed/block dispatch + edit chrome |
| `pageSectionRenderers.tsx` | 49 | Builtin fixed-key → component map |
| `homeSectionRenderers.tsx` | 64 | Home fixed-key map + deferred chunks |
| `sections/HomeSections.tsx` | 295 | `home.hero` brand |
| `sections/ProductsBlockViews.tsx` | 302 | Shared Producten brand chrome |
| `sections/AboutBlockViews.tsx` | 220 | Shared About brand chrome |
| `sections/ContactSections.tsx` | 402 | Contact/offerte info + contact form |
| `sections/OfferteSections.tsx` | 465 | Offerte form application |
| `sections/VacaturesApplicationSection.tsx` | 477 | Vacatures application |
| `sections/LegalSections.tsx` | 60 | Privacy/terms |

### Preconditions recorded

| ID | Status | Evidence |
|----|--------|----------|
| **R5** | Complete | `0ba08fd` inventory · `a9d7882` views · `9dfa92a` editor/catalog · `6ff6b3f` closeout |
| **M5** | Present | `packages/cms-schema/src/e2e-inventory.ts` + `e2e/cms-loading-inventory.spec.ts` |
| **R6** | Complete | `4c47a0d` — `refactor(admin-cms): split store into R6 capability modules` |

Unrelated WIP left untouched: cookie-auth acceptance, CMS e2e helpers/snapshots, cms-schema/editor dirty files, Footer/styles.

### Baseline command results (pre-implementation)

| Command | Exit | Notes |
|---------|-----:|-------|
| `npm run typecheck -w @mccoy/storefront` | 0 | |
| `npm run test -w @mccoy/storefront` | 0 | 5 files / 23 tests |
| `npm run test:contract` | 0 | 63 files / 599 tests |
| `npm run test:ci` | 0 | cms-renderer 20 files / 138 tests |

## Inventory (`StorefrontCompositionInventoryRow`)

| path | responsibilities | duplicatedRendererLogic | duplicatedSchemaLogic | disposition |
|------|------------------|------------------------:|----------------------:|-------------|
| `PageLayoutRenderer.tsx` | route-composition, preview, fixed-section-rendering | no | no | keep (orchestrator) |
| `pageSectionRenderers.tsx` | route-composition, fixed-section-rendering | no | no | keep |
| `homeSectionRenderers.tsx` | route-composition, brand-chrome | no | no | keep |
| `BlockView.tsx` | cms-block-rendering, forms, preview | was mixed | no | extract-helper |
| `blockPresentationAdapters.tsx` | brand-chrome, cms-resolution (presentation) | intentional dual-read | no | leave-compatibility |
| `sections/SitePageSections.tsx` | (was mixed fixed views) | no | no | extract-composition → barrel |
| `sections/AboutSections.tsx` | fixed-section-rendering, locale-resolution, brand-chrome | no | no | leave-compatibility |
| `sections/ServicesSections.tsx` | fixed-section-rendering, locale-resolution, brand-chrome | no | no | leave-compatibility |
| `sections/ProductsFixedSections.tsx` | fixed-section-rendering, locale-resolution | no | no | leave-compatibility |
| `sections/ProductsBlockViews.tsx` | brand-chrome | shared with adapters | no | keep |
| `sections/AboutBlockViews.tsx` | brand-chrome | shared with adapters | no | keep |
| `sections/HomeSections.tsx` | fixed-section-rendering, brand-chrome | no | no | keep |
| `FormPageChrome.tsx` | page-shell, brand-chrome | no | no | keep |
| `sections/ContactSections.tsx` | forms, fixed-section-rendering | no | no | keep |
| `sections/OfferteSections.tsx` | forms, application-data | no | no | keep |
| `sections/VacaturesApplicationSection.tsx` | forms, application-data | no | no | keep |
| `sections/LegalSections.tsx` | fixed-section-rendering | no | no | keep |
| `routes/*` SEO heads | seo | no | no | keep |
| `lib/cms/cms-head.ts` | seo | no | no | keep |

## Fixed-key classification (M5)

| Classification | Keys / notes |
|----------------|--------------|
| Still actively rendered | All keys in `FIXED_SECTIONS_BY_PAGE` via `pageSectionRenderers` |
| Migrated-but-retained | Producten / About / home.hero / offerte / legal dual-read via schema suppress helpers |
| Fixed by design (for now) | `services.*`, form chrome keys, home partners/stats/gallery |
| Compatibility-only | Fixed rows suppressed when migrated blocks present — not retired in R7 |

## Duplicated renderer paths found

1. **Producten/About presentation adapters in `BlockView`** — brand chrome for `productsIntro` / `productsAssortment` / `aboutIntro` / `aboutPillar`. Classified **still required application composition** (dual-read until MG5). Extracted to `blockPresentationAdapters.tsx`; not a BlockType mega-switch.
2. **No storefront `switch (block.type)`** over publishable BlockTypes after R7.
3. Admin canvas `apps/admin/.../BlockView.tsx` uses bare `RegisteredBlockView` (generic views). Public/preview iframe uses storefront `BlockView` (adapters). Documented; MG5 may consolidate presentation into cms-renderer later — **out of R7 scope**.

## After R7 (structural)

| File | Lines | Role |
|------|------:|------|
| `SitePageSections.tsx` | 9 | Thin compatibility barrel |
| `ServicesSections.tsx` | 316 | Diensten fixed views |
| `AboutSections.tsx` | 261 | Over McCoy fixed view |
| `ProductsFixedSections.tsx` | 123 | Producten fixed views |
| `BlockView.tsx` | 111 | Form adapters + adapter gate + RegisteredBlockView |
| `blockPresentationAdapters.tsx` | 197 | Producten/About presentation only |
| `block-presentation.ts` | 17 | Pure adapter detection |
| `site-composition.ts` | 56 | Class-level composition helpers |

## Explicit non-goals verified

- No MG5 migration / persisted data rewrite  
- No schema/layout version bump  
- No storefront → cms-editor/admin imports  
- No R8 skills work  
