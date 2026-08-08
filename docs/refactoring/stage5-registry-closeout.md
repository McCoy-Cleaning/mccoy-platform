# Stage 5 — CMS registry closeout

**Status:** Complete  
**Date:** 2026-08-06  
**Stop line (at Stage 5 closeout):** Stage 6 / R6 not started. *(R6 admin store modularization later completed — see [`r6-admin-cms-store-closeout.md`](./r6-admin-cms-store-closeout.md).)*

## Baseline commits (confirmed)

| Commit | Role |
|--------|------|
| `9c7bb04` | Stage 4 structural (cms-editor inspector modules) |
| `2a639ed` | Stage 4 closeout docs |
| `d1b3c12` | Stage 5 plans checkpoint (`PlansSectionView`) — preserved |
| `7c40fe3` | Guardian: services.cards ensure + image-fill cover |

## Stage 5 commits (this completion)

| Commit | Summary |
|--------|---------|
| `9986704` | fix(cms-editor): wire ServicesCardsInspector after services.cards split |
| `0ba08fd` | docs(cms): Stage 5 registry inventory baseline |
| `c9362ce` | fix(storefront): read service cards from services.cards section |
| `a9d7882` | refactor(cms-renderer): register all publishable block views (Stage 5A–G) |
| `9dfa92a` | refactor(cms): split editor registry and catalog slices (Stage 5) |
| `ca06f86` | fix(storefront): register services.cards fixed section renderer |
| *(closeout)* | docs: Stage 5 inventory refresh + audit/architecture + this closeout |

## Definition of done (gates 1–20)

| # | Gate | Result |
|--:|------|--------|
| 1 | Every publishable BlockType via `blockViewRegistry` | **Pass** — 35/35 |
| 2 | Every editable type via `blockEditorRegistry` | **Pass** — 35/35 (was already complete) |
| 3 | Inventory per type | **Pass** — `stage5-registry-inventory.md` |
| 4 | RegisteredBlockView = orchestration + lookup + fallback + diagnostics | **Pass** |
| 5 | No publishable JSX switch arms | **Pass** — orchestration test |
| 6 | Preview / storefront / admin canvas same registered views | **Pass** — single `RegisteredBlockView` entry |
| 7 | No silent unregistered fallback for known publishable | **Pass** — parity + orchestration tests |
| 8 | No CMS data/IDs/locale paths/form identities/markup intent change | **Pass** — structural extract |
| 9 | Families A–E + specialised complete | **Pass** |
| 10 | Stage 6 not started | **Pass** |
| 11–15 | Schema/editor modules, exemptions, API compat, parity | **Pass** (see modules) |
| 16 | Deterministic tests + builds green | **Pass** (see commands) |
| 17 | Locale E2E identical tracked flake or green | **Pass** — identical `savePage` flake; public-locale green |
| 18 | Rollback-friendly commits | **Pass** |
| 19 | Closeout documentation | **Pass** (this file) |
| 20 | Stage 6 not started | **Pass** |

## Coverage before → after

| Surface | Before | After |
|---------|-------:|------:|
| Renderer `blockViewRegistry` | 4 (`jobs`, `offers`, `plans`, `steps`) | **35 / 35** |
| Editor `blockEditorRegistry` | 35 / 35 | **35 / 35** (family modules) |
| Publishable hitting generic fallback | possible via switch default | **none** (parity gates) |
| `RegisteredBlockView` lines | ~1214 (switch mega-module) | **~74** (orchestration) |

## Families

| Family | Types (representative) | Modules |
|--------|------------------------|---------|
| A basic content | hero, richText, centered, textImage, featureGrid, cta | `BasicContentSectionViews.tsx` |
| B structural | columns, benefits, roadmap, timeline, comparisonTable, values, portfolio (+ steps registered) | `StructuralSectionViews.tsx` + `StepsSectionView.tsx` |
| C media/social | gallery, video, beforeAfter, carousel, quote, team*, spacer, announcement, latestPosts, partnersMarquee, statsCounters | `MediaSocialSectionViews.tsx` |
| D information/legal | contactInfoCards, legalArticles | `InformationLegalSectionViews.tsx` |
| E conversion/forms | newsletter, contactForm, popup, quoteRequestForm | `ConversionSectionViews.tsx` + `QuoteRequestFormSectionView.tsx` |
| F specialised | plans, jobs, offers | preserved `Plans/Jobs/OffersSectionView` |

## Preserved registrations

- `plans` → `PlansSectionView` (`d1b3c12`)
- `steps` → `StepsSectionView`
- `jobs` → `JobsSectionView`
- `offers` → `OffersSectionView`
- Image-fill `object-cover` behaviour from `7c40fe3` preserved via `CoverFillImage` in `blockViewShared.tsx`

## RegisteredBlockView responsibilities (final)

1. Parse block data (`parseBlockData`)
2. Invalid-data diagnostics (admin alert / public null)
3. `blockViewRegistry` lookup
4. Pass common props (`data`, `pages`, `blockId`, `adminMode`, `mode`, `showHidden`)
5. Explicit fallback (`unknown_type` / admin message)
6. Popup bridge registration (`registerPopupBlockView`)

## Explicit exemptions

| Item | Reason |
|------|--------|
| Fixed builtin sections (`home.*`, `services.*`, `products.*`, form chrome, legal mains) | Not `BlockType`s; out of blockViewRegistry by design |
| BlockType exemptions | **None** |

## Schema / editor / renderer modules

| Package | Modules |
|---------|---------|
| cms-renderer | `blockViewRegistry.ts`, `blockViewShared.tsx`, family `*SectionViews.tsx`, orchestration `RegisteredBlockView.tsx` |
| cms-editor | `editor-registry/{basic-content,structural,media-social,information-legal,conversion,specialised}.ts` composed by `blockEditorRegistry.ts` |
| cms-schema | Existing `plans/jobs/roadmap/timeline/offers/new-sections` + `catalog-slices.ts`; remaining A/B/C helpers still in `catalog.ts` with slice spreads for specialised/new-sections |

## API compatibility

- Public export remains `RegisteredBlockView` / `CmsBlockView`
- Editor registry helpers unchanged (`getBlockEditorDefinition`, etc.)
- Form source keys / conversion submission adapters unchanged
- NL/EN fieldPath conventions unchanged

## Localisation

- Deterministic `locale.test.ts`: **13 passed**
- Locale E2E: **4 passed / 1 failed** — failure is `savePage` / `"Opgeslagen"` poll timeout with durable UI showing Live + disabled Opslaan (identical to [`docs/testing/locale-e2e-savepage-follow-up.md`](../testing/locale-e2e-savepage-follow-up.md))
- Public locale smoke (about/services/products): **green** after `services.cards` renderer registration

## Forms

- `test:e2e:forms`: **4 passed** (contact → Aanvragen, offerte glass, vacatures form)
- No Aanvragen product changes

## Accessibility / SSR

- Existing plans a11y + visual-regression + smoke suite green
- Orchestration uses `renderToStaticMarkup` parity gates
- `object-cover` / reduced-motion patterns preserved in extracted gallery/media views

## Command results

| Command | Exit | Notes |
|---------|-----:|-------|
| `npm run typecheck` | **0** | Full monorepo |
| `npm run lint` | **0** | cms-renderer typecheck alias |
| `npm run test:contract` | **0** | cms-schema 55 files / 531 tests |
| `npm run test:ci` | **0** | cms-renderer 15 files / 125 tests |
| `npm run test -w @mccoy/cms-editor` | **0** | 12 files / 61 tests |
| `npm run test -w @mccoy/admin` | **0** | 11 files / 60 tests |
| `npm run build -w @mccoy/admin` | **0** | |
| `npm run build -w @mccoy/storefront` | **0** | |
| `npm run test:e2e:forms` | **0** | 4 passed |
| `npm run test:e2e:coverage` | **0** | 8 passed |
| `npm run test:e2e:locale` | **1** | Identical tracked `savePage` flake; public-locale green |

## Limitations

1. `catalog.ts` still hosts many inline A/B/C definitions/helpers; specialised + new-sections are sliced. Further extract is optional hygiene, not a Stage 5 blocker.
2. Locale publish E2E fixture still asserts ephemeral `"Opgeslagen"` toast — tracked follow-up, not Stage 5 regression.
3. Unrelated security/XSS WIP was stashed during this work and must not be mixed into Stage 5.

## Precise Stage 6 / R6 proposal

**Status:** Admin store modularization **complete** (2026-08-08) as **R6**. See [`r6-admin-cms-store-closeout.md`](./r6-admin-cms-store-closeout.md).

R6 (Stage 6) modularised the **admin CMS store / draft-publish session** without touching registries:

1. Extract admin CMS store concerns into capability modules (persistence, layout/draft, publish sync, EN planning) behind existing public APIs. *(Storefront store split deferred; R7 / Stage 7 owns storefront composition.)*
2. Keep `RegisteredBlockView` / registries frozen as the single markup path.
3. No content migration, no new blocks, no Aanvragen changes, no visual redesign.
4. Entry criteria: Stage 5 closeout accepted; locale `savePage` fixture fix optionally landed first to reduce E2E noise.
