# CMS / storefront section chrome inventory (Phase 0)

**Status:** Phase 0 inventory (baseline). Implementation landed in phases 1–5.  
**Date:** 2026-07-29  
**Post-implementation sources of truth:**

- `packages/cms-renderer/src/sectionLayout.ts` — semantic rails (`SECTION_PAGE_RAIL` = `max-w-[96rem]`, reading/form/media/full-bleed)
- `packages/cms-renderer/src/sectionChrome.ts` — `BLOCK_CHROME_CONFIG` (`headerMode` / `surfaceMode` / `widthMode`)
- `packages/cms-renderer/src/sectionChromeUi.tsx` — `SectionHeader` / `SectionSurface` / `SectionEyebrow` / `SectionIndex` / `SectionAmbient`
- `packages/cms-renderer/src/SectionShell.tsx` — chrome-aware shell (no auto titles)
- `packages/cms-renderer/src/blocks/RegisteredBlockView.tsx` (+ conversion / jobs / mosaic helpers)
- `apps/storefront/src/components/site/pageSectionRenderers.tsx` + `homeSectionRenderers.tsx`

**Phase 0 baseline sources (historical):**

- `packages/cms-schema/src/sections.ts` — `FixedSectionKey`
- `packages/cms-schema/src/types.ts` — `BlockType`
- `packages/cms-schema/src/blocks/catalog.ts` + `registry.ts` (`ALL_BLOCK_TYPES`)

## Legend

| Column | Values |
| --- | --- |
| **Header owner** | `shell` = shared shell/title primitives (`SectionShell` / `SectionInner` / form chrome) structure the header band; `block` = the specific renderer owns heading markup; `none` = no section header |
| **Width owner** | Who constrains horizontal content: `hardcoded max-w-7xl` (literal classes), `SECTION_PAGE_RAIL` (token via `SectionShell` / rail), `SectionInner` (component wrapping `SECTION_PAGE_RAIL`), `hardcoded max-w-4xl` / `max-w-5xl` (exceptions), `none` |
| **Surface** | Visual treatment of content: `none`, `cards`, `muted-frame`, `cta-frame`, `form-panel`, `marquee`, `mosaic-tiles`, `table`, `banner`, `modal` |
| **Full bleed** | `yes` = section background / media / marquee intentionally spans viewport width outside the content rail; `partial` = section background full-bleed but content still railed; `no` = everything sits in the rail |
| **Class** | `form` \| `media` \| `narrative` \| `hybrid` (form+narrative, media+narrative, etc.) |

**Shared layout model (current):**

```text
section (often full-bleed background / vertical padding)
  → page rail (SECTION_PAGE_RAIL = mx-auto w-full max-w-[96rem] + gutters)
    → align row (contentAlign justify-*)
      → content column (optional max-w-3xl / 2xl via SectionInnerMaxWidth)
```

Defined in `packages/cms-renderer/src/sectionLayout.ts`.

---

## 1. FixedSectionKey → storefront owner matrix

Wiring: `homeSectionRenderers` (home) and `pageSectionRenderers` (all builtins). Dispatch: `PageLayoutRenderer` → `FixedSelectChrome` → registered component.

| FixedSectionKey | Storefront owner (file → export) | Header owner | Width owner | Surface | Full bleed | Class |
| --- | --- | --- | --- | --- | --- | --- |
| `home.hero` | `sections/HomeSections.tsx` → `Hero` | block | hardcoded `max-w-7xl` | none (accent blobs / grid bg) | partial (bg full; content railed) | hybrid (narrative + media) |
| `home.partners` | `PartnersSlider.tsx` → `PartnersSlider` (lazy via `homeSectionRenderers`) | block (via `SectionInner`) | `SectionInner` (header) + **none** (marquee track) | marquee + logo cards | **yes** (marquee escapes rail) | media |
| `home.stats` | `sections/HomeStats.tsx` → `Stats` | block | hardcoded `max-w-7xl` | cards | no | narrative |
| `home.workGallery` | `sections/HomeWorkGallery.tsx` → `WorkGallery` → `WorkMosaicGallery` (`@mccoy/cms-renderer`) | block (mosaic header) | hardcoded `max-w-7xl` (inside `WorkMosaicGallery`) | mosaic-tiles | no | media |
| `about.main` | `sections/SitePageSections.tsx` → `About` | block | hardcoded `max-w-7xl` | cards (pillars) + media rows | partial (bg-grid) | hybrid |
| `services.main` | `sections/SitePageSections.tsx` → `Services` | block | hardcoded `max-w-7xl` | cards | no | hybrid |
| `products.main` | `sections/SitePageSections.tsx` → `ProductsMain` | block | hardcoded `max-w-7xl` | none (+ metric strip) | partial (bg-grid / gradient) | hybrid |
| `products.info` | `sections/SitePageSections.tsx` → `ProductsInfo` | block | hardcoded `max-w-7xl` | cards | no | narrative |
| `contact.main` | `FormPageChrome.tsx` → `ContactMainChrome` | shell (`SectionInner` + chrome) | `SectionInner` | none (+ optional image frame) | no | narrative |
| `contact.info` | `sections/ContactSections.tsx` → `ContactInfoSection` | none (cards only; no section H1) | hardcoded `max-w-7xl` | cards | no | narrative |
| `contact.form` | `sections/ContactSections.tsx` → `ContactFormSection` | block | hardcoded `max-w-7xl` | form-panel | partial (blur glow) | form |
| `vacatures.main` | `FormPageChrome.tsx` → `VacaturesMainChrome` | shell (`SectionInner` + badge chrome) | `SectionInner` | none (+ optional image) | no | narrative |
| `offerte.main` | `FormPageChrome.tsx` → `OfferteMainChrome` | shell (`SectionInner`) | `SectionInner` | none (+ optional image) | no | narrative |
| `offerte.info` | `sections/ContactSections.tsx` → `OfferteInfoSection` | none | hardcoded `max-w-7xl` | cards | no | narrative |
| `offerte.form` | `sections/OfferteSections.tsx` → `OfferteFormSection` | block (optional CMS heading + tab headers) | hardcoded `max-w-7xl` (multiple nested sections) | cards (tabs) + form-panel | no | form |
| `privacy.main` | `sections/LegalSections.tsx` → `PrivacyMainSection` | block | hardcoded `max-w-4xl` (**not** 7xl) | cards (articles) | no | narrative |
| `terms.main` | `sections/LegalSections.tsx` → `TermsMainSection` | block | hardcoded `max-w-4xl` (**not** 7xl) | cards (articles) | no | narrative |

### Fixed-section file list (owners)

| Path | Keys owned |
| --- | --- |
| `apps/storefront/src/components/site/homeSectionRenderers.tsx` | Registry: `home.*` |
| `apps/storefront/src/components/site/pageSectionRenderers.tsx` | Registry: all builtins |
| `apps/storefront/src/components/site/PageLayoutRenderer.tsx` | Layout dispatch / edit chrome |
| `apps/storefront/src/components/site/sections/HomeSections.tsx` | `home.hero` |
| `apps/storefront/src/components/site/PartnersSlider.tsx` | `home.partners` |
| `apps/storefront/src/components/site/sections/HomeStats.tsx` | `home.stats` |
| `apps/storefront/src/components/site/sections/HomeWorkGallery.tsx` | `home.workGallery` |
| `packages/cms-renderer/src/blocks/WorkMosaicGallery.tsx` | Shared mosaic used by `home.workGallery` + `gallery` (featured) |
| `apps/storefront/src/components/site/sections/SitePageSections.tsx` | `about.main`, `services.main`, `products.main`, `products.info` |
| `apps/storefront/src/components/site/FormPageChrome.tsx` | `contact.main`, `vacatures.main`, `offerte.main` |
| `apps/storefront/src/components/site/sections/ContactSections.tsx` | `contact.info`, `contact.form`, `offerte.info` |
| `apps/storefront/src/components/site/sections/OfferteSections.tsx` | `offerte.form` |
| `apps/storefront/src/components/site/sections/LegalSections.tsx` | `privacy.main`, `terms.main` |
| `apps/storefront/src/components/site/Sections.tsx` | Barrel re-exports only |

### Related (not FixedSectionKey)

| Surface | Notes |
| --- | --- |
| `apps/storefront/src/components/site/CityLanding.tsx` | Uses `SECTION_INNER` + `SECTION_SHELL_Y` — city landing, not a fixed CMS key |
| `apps/storefront/src/routes/vacatures.tsx` | Page shell + apply form band (`max-w-7xl`); jobs listing is a **block** (`jobs`) in layout |
| `packages/cms-renderer/src/index.tsx` → `FormPageChromeView` / `HomeHeroView` | Lightweight preview helpers; storefront form chrome uses `FormPageChrome.tsx` + `SectionInner` |

---

## 2. BlockType → renderer matrix

All `BlockType` values from `packages/cms-schema/src/types.ts` (catalog-asserted via `ALL_BLOCK_TYPES` in `blocks/registry.ts`).

Default path: `RegisteredBlockView` switch in `packages/cms-renderer/src/blocks/RegisteredBlockView.tsx`.  
Exceptions: `blockViewRegistry.jobs` → `JobsSectionView`; conversion blocks → `ConversionSectionViews.tsx`; featured gallery → `WorkMosaicGallery`.

| BlockType | Renderer case / view | Header owner | Width owner | Surface | Full bleed | Class |
| --- | --- | --- | --- | --- | --- | --- |
| `hero` | `RegisteredBlockView` `case "hero"` → local `SectionShell` | block | `SECTION_PAGE_RAIL` (inner `7xl`) | none | no | hybrid |
| `richText` | `case "richText"` (shared with centered/cta) | block | `SECTION_PAGE_RAIL` + inner **`3xl`** | none | no | narrative |
| `centered` | `case "centered"` | block | `SECTION_PAGE_RAIL` + inner **`2xl`** | none | no | narrative |
| `cta` | `case "cta"` | block | `SECTION_PAGE_RAIL` (inner `7xl`) | cta-frame | no | narrative |
| `textImage` | `case "textImage"` | block | `SECTION_PAGE_RAIL` | none (+ image frame) | no | hybrid |
| `columns` | `case "columns"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | cards | no | narrative |
| `benefits` | `case "benefits"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | muted-frame | no | narrative |
| `quote` | `case "quote"` | none / block (quote body) | `SECTION_PAGE_RAIL` (`3xl` single, `7xl` multi) | muted-frame or cards | no | narrative |
| `gallery` | `case "gallery"` — grid/masonry via `SectionShell`; **featured** → `WorkMosaicGallery` | block | hardcoded `max-w-7xl` (featured) or `SECTION_PAGE_RAIL` (grid/masonry) | mosaic-tiles / media grid | no | media |
| `video` | `case "video"` | block (optional title) | `SECTION_PAGE_RAIL` | none (video frame) | no | media |
| `beforeAfter` | `case "beforeAfter"` | block (optional title) | `SECTION_PAGE_RAIL` | none | no | media |
| `carousel` | `case "carousel"` | none | `SECTION_PAGE_RAIL` (track uses negative horizontal margin for edge snap) | cards | partial (snap track bleeds gutters) | media |
| `steps` | `case "steps"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | cards | no | narrative |
| `comparisonTable` | `case "comparisonTable"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | table | no | narrative |
| `featureGrid` | `case "featureGrid"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | cards | no | narrative |
| `spacer` | `case "spacer"` | none | none | none | no | narrative (structure) |
| `teamGrid` | `case "teamGrid"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | cards | no | hybrid |
| `teamProfile` | `case "teamProfile"` | block | `SECTION_PAGE_RAIL` + inner card `max-w-5xl` | muted-frame | no | hybrid |
| `values` | `case "values"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | cards | no | narrative |
| `timeline` | `case "timeline"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | none | no | narrative |
| `roadmap` | `case "roadmap"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | none | no | narrative |
| `plans` | `case "plans"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | table | no | narrative |
| `newsletter` | `case "newsletter"` → `NewsletterSectionView` | block | `SECTION_PAGE_RAIL` (Conversion `SectionShell`) | muted-frame | no | form |
| `contactForm` | `case "contactForm"` → `ContactFormSectionView` | block | `SECTION_PAGE_RAIL` (+ inner `max-w-5xl` grid) | form-panel | no | form |
| `announcement` | `case "announcement"` | none | none (full-width bar) | banner | **yes** | narrative |
| `popup` | `case "popup"` → `PopupSectionView` | block (modal title) | none (viewport overlay); preview uses `SECTION_PAGE_RAIL` | modal | **yes** (overlay) | hybrid |
| `portfolio` | `case "portfolio"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | cards | no | media |
| `jobs` | `case "jobs"` → `blockViewRegistry.jobs` → `JobsSectionView` | block (`SECTION_TITLE`) | `SECTION_PAGE_RAIL` | cards / list | no | hybrid |
| `latestPosts` | `case "latestPosts"` | block (`SectionTitle`) | `SECTION_PAGE_RAIL` | cards | no | hybrid |
| `partnersMarquee` | `case "partnersMarquee"` | block | `SECTION_PAGE_RAIL` | cards (static grid; animate note only) | no | media |
| `statsCounters` | `case "statsCounters"` | block | `SECTION_PAGE_RAIL` | cards | no | narrative |
| `contactInfoCards` | `case "contactInfoCards"` | block | `SECTION_PAGE_RAIL` | cards | no | narrative |
| `quoteRequestForm` | `case "quoteRequestForm"` | block | `SECTION_PAGE_RAIL` | cta-frame + dashed placeholder | no | form |
| `legalArticles` | `case "legalArticles"` | block (`h1`) | `SECTION_PAGE_RAIL` + inner **`3xl`** | none (+ nav card) | no | narrative |

### Block renderer file list

| Path | Role |
| --- | --- |
| `packages/cms-renderer/src/blocks/RegisteredBlockView.tsx` | Main switch + local `SectionShell` |
| `packages/cms-renderer/src/blocks/blockViewRegistry.ts` | `jobs` → `JobsSectionView` |
| `packages/cms-renderer/src/blocks/JobsSectionView.tsx` | Jobs listing UI + rail shell |
| `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` | `newsletter`, `contactForm`, `popup` |
| `packages/cms-renderer/src/blocks/WorkMosaicGallery.tsx` | Featured `gallery` + storefront `home.workGallery` |
| `packages/cms-renderer/src/blocks/form-adapters.tsx` | Form adapter context for conversion views |
| `packages/cms-renderer/src/blocks/primitives.tsx` | Shared image/button primitives |
| `packages/cms-renderer/src/SectionInner.tsx` | Storefront fixed chrome width helper |
| `packages/cms-renderer/src/sectionLayout.ts` | Tokens: `SECTION_PAGE_RAIL`, `SECTION_INNER*`, shell Y, titles, grid |
| `packages/cms-schema/src/types.ts` | `BlockType` union |
| `packages/cms-schema/src/blocks/catalog.ts` | Data definitions / defaults |
| `packages/cms-schema/src/blocks/registry.ts` | `ALL_BLOCK_TYPES`, catalog exhaustiveness |
| `packages/cms-schema/src/blocks/new-sections.ts` | `partnersMarquee`, `statsCounters`, `contactInfoCards`, `quoteRequestForm`, `legalArticles` |

---

## 3. Chrome ownership summary (Phase 0 findings)

### Width systems in use today

1. **Canonical rail** — `SECTION_PAGE_RAIL` via `SectionShell` / `SectionInner` (CMS blocks + form page chrome + partners header).
2. **Hardcoded twin** — literal `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` on most fixed marketing sections (hero, stats, about, services, products, contact/offerte forms & info, mosaic gallery). Same visual width as the rail token, but **not** the shared constant.
3. **Narrow exceptions** — legal fixed sections `max-w-4xl`; block inners `2xl` / `3xl` / `max-w-5xl` (team profile, contactForm grid).
4. **True full-bleed content** — partners marquee track; `announcement` banner; `popup` overlay; section decorative backgrounds (hero/about/products grid).

### Header ownership pattern

- CMS blocks almost always own headings **inside** `SectionShell` (`SectionTitle` or raw `h1`/`h2`) — classify as **block**, with shell owning only width/padding/tone framing.
- Form page fixed intros (`contact.main` / `vacatures.main` / `offerte.main`) use **shell**-style chrome (`SectionInner` + shared eyebrow/H1 pattern).
- Info-card sections often have **no** section header.

### Surface pattern

- Heavy **cards** usage on services, products info, stats, columns, feature grids, jobs, etc.
- **Form panels** on contact/offerte fixed forms and `contactForm` block.
- Partners fixed section is the clearest existing **full-bleed media** pattern (header railed, track edge-to-edge).

---

## 4. Grep results summary (layout-related)

Searched `*.{ts,tsx,css}` for `max-w-7xl`, `SECTION_INNER`, `SECTION_PAGE_RAIL`, `w-screen`.

### `SECTION_PAGE_RAIL`

| File | Role |
| --- | --- |
| `packages/cms-renderer/src/sectionLayout.ts` | Definition |
| `packages/cms-renderer/src/SectionInner.tsx` | Applies rail |
| `packages/cms-renderer/src/blocks/RegisteredBlockView.tsx` | `SectionShell` rail |
| `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` | Conversion `SectionShell` rail |
| `packages/cms-renderer/src/blocks/JobsSectionView.tsx` | Jobs `SectionShell` rail |
| `packages/cms-renderer/src/index.tsx` | Re-export |
| `packages/cms-renderer/src/sectionLayout.test.ts` | Asserts exact rail string |

### `SECTION_INNER` / `SECTION_INNER_BASE`

| File | Role |
| --- | --- |
| `packages/cms-renderer/src/sectionLayout.ts` | Definition (`SECTION_INNER` = `mx-auto` + `SECTION_INNER_BASE`) |
| `packages/cms-renderer/src/index.tsx` | Re-export |
| `apps/storefront/src/components/site/CityLanding.tsx` | Legacy single-class sections |

`SectionInner` **component** (preferred) is used by:

- `apps/storefront/src/components/site/FormPageChrome.tsx`
- `apps/storefront/src/components/site/PartnersSlider.tsx`

### Hardcoded `max-w-7xl` (active app / packages — exclude `tmp/`)

| File | Context |
| --- | --- |
| `packages/cms-renderer/src/sectionLayout.ts` | Inside `SECTION_PAGE_RAIL` / `SECTION_INNER_BASE` / Tailwind source string |
| `packages/cms-renderer/src/blocks/WorkMosaicGallery.tsx` | Mosaic content rail |
| `packages/cms-renderer/src/SectionInner.test.tsx` | Expects rail classes |
| `packages/cms-renderer/src/sectionLayout.test.ts` | Legacy `sectionInnerClass` expectations |
| `apps/storefront/src/components/site/sections/HomeSections.tsx` | Hero grid |
| `apps/storefront/src/components/site/sections/HomeStats.tsx` | Stats grid |
| `apps/storefront/src/components/site/sections/SitePageSections.tsx` | About / Services / ProductsMain / ProductsInfo |
| `apps/storefront/src/components/site/sections/ContactSections.tsx` | Info cards + contact form |
| `apps/storefront/src/components/site/sections/OfferteSections.tsx` | Heading + tabs + form shells |
| `apps/storefront/src/components/site/Navbar.tsx` | Site chrome (out of section plan, note only) |
| `apps/storefront/src/components/site/Footer.tsx` | Site chrome |
| `apps/storefront/src/components/site/CityLanding.tsx` | City landing |
| `apps/storefront/src/routes/vacatures.tsx` | Apply section |

Also present under `tmp/` backups / `tmp/original-mccoy/` — **not** production paths for this plan.

### `w-screen`

**No matches** in `*.{ts,tsx,css}` across the repo. Full-bleed today uses `absolute inset-0`, overflow marquee, or viewport overlays — not `w-screen`.

---

## 5. Visual / snapshot tests that would change

Any change to rail width, shell padding, `SectionShell` markup, or featured mosaic classes will touch:

### Unit / HTML snapshots (high confidence)

| Test | Why it changes |
| --- | --- |
| `packages/cms-renderer/src/blocks/visual-regression.test.tsx` + `__snapshots__/visual-regression.test.tsx.snap` | HTML snapshots for `hero`, `textImage`, `roadmap`, `plans` — include `SECTION_PAGE_RAIL` / shell classes |
| `packages/cms-renderer/src/sectionLayout.test.ts` | Exact string equality for `SECTION_PAGE_RAIL` and legacy `sectionInnerClass` |
| `packages/cms-renderer/src/SectionInner.test.tsx` | Asserts rail + align + inner DOM structure / `max-w-7xl` classes |
| `packages/cms-renderer/src/FormPageChromeView.test.tsx` | Markup for preview chrome (less width-sensitive, still touch if chrome shared) |
| `packages/cms-renderer/src/blocks/RegisteredBlockView.smoke.test.tsx` | Smoke render of registered cases (class churn possible) |
| `packages/cms-renderer/src/blocks/plans-a11y.test.tsx` | Plans DOM; may include shell wrappers |

### Playwright pixel screenshots (high confidence)

| Spec | Baselines likely affected |
| --- | --- |
| `e2e/cms-screenshots.spec.ts` | `roadmap-desktop.png`, `roadmap-mobile.png`, `plans-desktop.png`, `plans-mobile.png`, `selected-canvas-section.png` (home.hero), editor dialogs less so |
| Snapshot path template | `playwright.config.ts` → `{testDir}/{testFilePath}-snapshots/...` |

Update via `test:e2e:update-snapshots` after intentional chrome changes.

### Likely indirect / layout-sensitive E2E

| Spec | Notes |
| --- | --- |
| `e2e/cms-fixed-section.spec.ts` | Fixed section selection / visibility |
| `e2e/cms-gallery.spec.ts` | Gallery / mosaic layout |
| `e2e/cms-plans.spec.ts` / `e2e/cms-roadmap.spec.ts` | Block layouts that use `SectionShell` |
| `e2e/cms-add-sections.spec.ts` | Adding blocks into railed shells |
| `e2e/responsive.spec.ts` | Viewport layout regressions |
| `e2e/a11y.critical.spec.ts` | Landmark/heading structure if shells change |
| `e2e/smoke.p0.spec.ts` | Home / marketing page smoke |

### Out of scope for section chrome (usually)

- CMS schema migration checksum tests
- Preview-snapshot protocol tests (`preview-status`, postMessage)
- Admin editor a11y tests that do not render storefront shells

---

## 6. Phase 0 file checklist (complete touch map)

### Schema / contracts

- `packages/cms-schema/src/sections.ts`
- `packages/cms-schema/src/types.ts`
- `packages/cms-schema/src/blocks/catalog.ts`
- `packages/cms-schema/src/blocks/registry.ts`
- `packages/cms-schema/src/blocks/new-sections.ts`
- `packages/cms-schema/src/layout-presentation.ts` (contentAlign — interacts with rail)

### Renderer chrome

- `packages/cms-renderer/src/sectionLayout.ts`
- `packages/cms-renderer/src/SectionInner.tsx`
- `packages/cms-renderer/src/contentAlign.tsx`
- `packages/cms-renderer/src/blocks/RegisteredBlockView.tsx`
- `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx`
- `packages/cms-renderer/src/blocks/JobsSectionView.tsx`
- `packages/cms-renderer/src/blocks/WorkMosaicGallery.tsx`
- `packages/cms-renderer/src/blocks/blockViewRegistry.ts`
- `packages/cms-renderer/src/index.tsx`

### Storefront fixed sections

- `apps/storefront/src/components/site/PageLayoutRenderer.tsx`
- `apps/storefront/src/components/site/homeSectionRenderers.tsx`
- `apps/storefront/src/components/site/pageSectionRenderers.tsx`
- `apps/storefront/src/components/site/FormPageChrome.tsx`
- `apps/storefront/src/components/site/PartnersSlider.tsx`
- `apps/storefront/src/components/site/sections/HomeSections.tsx`
- `apps/storefront/src/components/site/sections/HomeStats.tsx`
- `apps/storefront/src/components/site/sections/HomeWorkGallery.tsx`
- `apps/storefront/src/components/site/sections/SitePageSections.tsx`
- `apps/storefront/src/components/site/sections/ContactSections.tsx`
- `apps/storefront/src/components/site/sections/OfferteSections.tsx`
- `apps/storefront/src/components/site/sections/LegalSections.tsx`
- `apps/storefront/src/components/site/CityLanding.tsx` (related rail consumer)
- `apps/storefront/src/components/site/Navbar.tsx` / `Footer.tsx` (site chrome width parity)

### Tests / baselines

- `packages/cms-renderer/src/sectionLayout.test.ts`
- `packages/cms-renderer/src/SectionInner.test.tsx`
- `packages/cms-renderer/src/blocks/visual-regression.test.tsx`
- `packages/cms-renderer/src/blocks/__snapshots__/visual-regression.test.tsx.snap`
- `e2e/cms-screenshots.spec.ts` (+ generated PNG snapshots)
- Related CMS E2E listed in §5

---

## 7. Phase 0 conclusions for the full-width premium plan

1. **Two parallel width systems** — tokenized `SECTION_PAGE_RAIL` (blocks / `SectionInner`) vs duplicated hardcoded `max-w-7xl` (most fixed storefront sections and `WorkMosaicGallery`). Unifying these is a prerequisite for consistent full-width chrome.
2. **Almost no true edge-to-edge content** except partners marquee, announcement, popup, and decorative backgrounds. Premium full-width sections will need an explicit “bleed layer vs content rail” pattern (partners already sketches this).
3. **Header ownership is decentralized** — blocks render their own titles inside shells; fixed marketing pages own headers locally. A shared “section header slot” does not exist yet.
4. **Legal and some conversion UIs use narrower max-widths** — do not blindly stretch everything to viewport; keep narrative/legal reading measure (`3xl` / `4xl`) as first-class.
5. **Snapshot debt is concentrated** in `visual-regression` HTML snaps, `sectionLayout`/`SectionInner` unit tests, and `e2e/cms-screenshots` pixel baselines — budget for baseline updates in Phase 1+.

---

*End of Phase 0 inventory.*
