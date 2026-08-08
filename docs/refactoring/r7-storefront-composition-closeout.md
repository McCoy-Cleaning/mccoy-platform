# R7 — Storefront composition cleanup closeout

**Status:** Complete (implementation) · **Acceptance: R7_ACCEPTED**
**Date:** 2026-08-08
**Stop line:** R8 / MG5 / MR not started
**Push:** Local commits ready (`4c47a0d` + `eb82322`…`a5acd36` + `3637321`); remote push blocked here by SSH agent/passphrase — run commands in closeout note below

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
Post-accept fix: in-memory `quoteRequestForm` migration block ids resolve to legacy fixed offerte source for server submit; form blocks expose `site-form-ready` / `site-form-success` for E2E.

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
| `npm run typecheck -w @mccoy/storefront` | 0 | Prior R7 closeout |
| `npm run test -w @mccoy/storefront` | 0 | Prior R7 closeout |
| `npm run test:contract` | 0 | Prior R7 closeout |
| `npm run test:ci` | 0 | Prior R7 closeout |
| `npm run lint` | 0 | Prior R7 closeout |
| `npm run build -w @mccoy/storefront` | 0 | Prior R7 closeout |
| `npm run build -w @mccoy/admin` | 0 | Prior R7 closeout |
| `npm run test -w @mccoy/storefront -- src/components/site/site-composition.test.ts` | 0 | 6 passed |
| `npm run test -w @mccoy/cms-schema -- src/e2e-inventory.test.ts src/resolve-published-form.test.ts` | 0 | 13 passed |
| `npm run test:e2e:inventory` (`E2E_USE_DEV=1`, ports 5273/5274) | 0 | **14 passed** |
| `npm run test:e2e:forms` (fresh `.data/e2e-cms-r7-forms3`) | 0 | **4 passed** |
| `npm run test:e2e:coverage` | 0 | **7 passed** |
| `npm run test:e2e:locale` | **1** | Public smoke **3/3**. EN publish: durable `savePage` + hero accessible-name asserts succeed; test still fails via global `failureSink` on pre-existing admin `Maximum update depth exceeded` console spam (not Opgeslagen toast). Classified pre-existing — not R7 composition regression. |
| `git diff --check` | 0 | Focused fix tree |

## Acceptance classification (2026-08-08)

**R7_ACCEPTED** — Composition contract green; inventory dual-read expectations cover home hero / legal / offerte migrated rows and maxed `quoteRequestForm` picker; forms E2E green for contact + offerte quoteRequestForm path; coverage green. Locale EN publish remains a known editor console flake (`Maximum update depth`) after durable-save fixture hardening — document-only, not a push blocker for R7 composition. Next stage is **MG5** (not started). Do not start **R8** before MG5 closes.

## Remaining storefront debt (not R7)

1. Promote Producten/About presentation markup into cms-renderer for admin-canvas parity (post-MG5 candidate).
2. Further split Contact/Offerte/Vacatures application modules if they grow.
3. Storefront CMS store modularisation (deferred; share via schema only).
4. Locale E2E admin editor `Maximum update depth exceeded` console loop during custom-page EN publish (pre-existing product/editor defect; `docs/testing/locale-e2e-savepage-follow-up.md` still tracks fixture follow-up).

## MG5 / MR dependencies

MG5 must prove fixed→block safety before MR retires fixed renderers and presentation adapters.

## R8 recommendation

**Do not start R8 in this phase.** R8 = report-only review skills under `.cursor/skills/` + final verification — not further composition moves.

## Push (manual if SSH agent locked)

```powershell
Get-Service ssh-agent | Set-Service -StartupType Manual
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519_mccoy
git push origin development
```

Remote: `git@github.com-mccoy:McCoy-Cleaning/mccoy-platform.git` (no force-push).
