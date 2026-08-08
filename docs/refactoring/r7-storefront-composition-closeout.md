# R7 — Storefront composition cleanup closeout

**Status:** Complete  
**Date:** 2026-08-08  
**Stop line:** R8 / MG5 / MR not started

## Preconditions

| ID | Status | Hash / evidence |
|----|--------|-----------------|
| **R5** | Complete | `0ba08fd` · `a9d7882` · `9dfa92a` · closeout `6ff6b3f` |
| **M5** | Present | `packages/cms-schema/src/e2e-inventory.ts` + `e2e/cms-loading-inventory.spec.ts` |
| **R6** | Complete | `4c47a0d` — admin CMS store capability modules |

Unrelated WIP (cookie-auth, CMS e2e helpers/snapshots, schema/editor dirty files) was **not** staged into R7 commits.

## Scope delivered

1. Documented storefront composition ownership (audit + architecture).
2. Confirmed `PageLayoutRenderer` as class-level orchestrator (fixed vs block).
3. Split monolithic `SitePageSections.tsx` (~677) into `AboutSections` / `ServicesSections` / `ProductsFixedSections` + thin barrel.
4. Thinned `BlockView` to form adapters + presentation gate + `RegisteredBlockView`.
5. Isolated Producten/About dual-read presentation adapters (retained until MG5).
6. Added `site-composition` helpers + composition contract tests (M5 fixed coverage, no BlockType switch, import boundaries).
7. Updated frontend-component audit/architecture with **R1–R8** IDs.

## Composition responsibility map

| Concern | Owner |
|---------|-------|
| Layout order / hidden / suppress | `PageLayoutRenderer` |
| Fixed key → view | `pageSectionRenderers` / `homeSectionRenderers` |
| Reusable BlockType markup | `@mccoy/cms-renderer` via `RegisteredBlockView` |
| Producten/About presentation dual-read | `blockPresentationAdapters` + `ProductsBlockViews` / `AboutBlockViews` |
| Brand chrome | Navbar, Footer, FormPageChrome, home hero |
| Forms submission | storefront `CmsFormAdaptersProvider` → `submitWebsiteForm` |
| SEO | route `head` / `tanstackHeadFromCms` |

## Duplicated renderer paths

| Found | Action |
|-------|--------|
| Inline Producten/About presentation in `BlockView` | Extracted to `blockPresentationAdapters.tsx` — **retained** (application brand dual-read) |
| BlockType mega-switch in storefront | **None** (contract test guards) |
| Generic reusable markup forks | Default path is RegisteredBlockView |

## Fixed compatibility retained

All M5 fixed keys remain registered. Dual-read suppress helpers unchanged. No persisted migration. No schema version bump.

## Producten parity

- Fixed `products.main` / `products.info` and presentation-mode blocks still share `ProductsIntroView` / `ProductsAssortmentView`.
- No template resurrection of intentionally omitted sections.
- Composition contract asserts presentation adapters only fire for dual-read presentations.

## Localisation

Unchanged: `cmsTextOrFallback` + `lib/cms-i18n`. No parallel storefront resolvers invented.

## Forms

Presentation vs submission boundary unchanged. Form source identities untouched. Aanvragen not modified.

## SEO / SSR / a11y / performance

- Route meta ownership untouched.
- Home deferred chunks preserved.
- Services modal still document-gated.
- Storefront + admin builds succeeded after refactor.
- Bundle note: `pageSectionRenderers` SSR chunk ~87KB; `BlockView` ~19KB (server assets after build).

## Dependency boundaries

Composition contract test fails on storefront → cms-editor/admin under `components/site`. No violations.

## Command results

| Command | Exit | Notes |
|---------|-----:|-------|
| `npm run typecheck -w @mccoy/storefront` | 0 | |
| `npm run test -w @mccoy/storefront` | 0 | 6 files / 29 tests (incl. composition) |
| `npm run test:contract` | 0 | 599 tests |
| `npm run test:ci` | 0 | 138 renderer tests |
| `npm run lint` | 0 | cms-renderer typecheck alias |
| `npm run build -w @mccoy/storefront` | 0 | |
| `npm run build -w @mccoy/admin` | 0 | |
| `git diff --check` (R7 paths) | 0 | |

| `npm run test:e2e:inventory` (with `E2E_REUSE_SERVER=1`) | **env fail** | Playwright Chromium binary missing (`chrome-headless-shell` not in local Playwright cache). **Not an R7 product regression.** Auth setup aborted before inventory tests ran. |
| `test:e2e:forms` / `coverage` / `locale` | **not re-run** | Same browser binary blocker; classify as environment until `npx playwright install` succeeds outside this agent sandbox. |

Pre-existing tracked: locale `savePage` / `"Opgeslagen"` fixture flake (`docs/testing/locale-e2e-savepage-follow-up.md`).

## Remaining storefront debt (not R7)

1. Promote Producten/About presentation markup into cms-renderer for admin-canvas parity (post-MG5 candidate).
2. Further split Contact/Offerte/Vacatures application modules if they grow.
3. Storefront CMS store modularisation (deferred; share via schema only).
4. Locale E2E `savePage` / `"Opgeslagen"` fixture flake (pre-existing).

## MG5 / MR dependencies

MG5 must prove fixed→block safety before MR retires fixed renderers and presentation adapters.

## R8 recommendation

**Do not start R8 in this phase.** R8 = report-only review skills under `.cursor/skills/` + final verification — not further composition moves.
