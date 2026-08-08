# R7 — Storefront composition architecture

**Status:** Target = implemented  
**Date:** 2026-08-08  
**Related:** [`r7-storefront-composition-audit.md`](./r7-storefront-composition-audit.md) · [`r7-storefront-composition-closeout.md`](./r7-storefront-composition-closeout.md)

## Canonical path

```text
cms-schema (types, normalize, migrate, form sources, locale helpers)
        │
        ▼
cms-renderer (RegisteredBlockView → blockViewRegistry)
        │
        ├──────── reusable block path ────────┐
        │                                     ▼
        │                          storefront BlockView
        │                          (form adapters + rare
        │                           presentation adapters)
        │                                     │
        └──────── fixed/builtin path ─────────┤
                                              ▼
                         PageLayoutRenderer (orchestrator)
                                              │
                    pageSectionRenderers / homeSectionRenderers
                                              │
                         brand shells · forms · SEO routes
```

## Ownership

| Owner | Owns | Must not own |
|-------|------|--------------|
| `@mccoy/cms-schema` | Types, validation, identities, normalisation, migrations, form sources, locale path contracts | React storefront composition |
| `@mccoy/cms-renderer` | Reusable publishable block markup, shared section chrome, preview/public block parity | Storefront app imports, privileged form submission |
| `apps/storefront` | Route composition, Navbar/Footer, brand shells, fixed compatibility, form application wiring, SEO | Second BlockType renderer, admin/cms-editor imports |
| `apps/admin` | Nothing in R7 | — |

## Forbidden dependency directions

- storefront → cms-editor  
- storefront → admin  
- cms-renderer → storefront  
- cms-schema → storefront / React apps  
- renderer → cms-editor  

Allowed: `storefront → cms-renderer → cms-schema`.

## Composition dispatch (class-level only)

`PageLayoutRenderer` / `LayoutItemView`:

```text
switch (item.kind) {
  case "fixed":  → registry[item.key]   // fixed compatibility view
  case "block":  → BlocksView → BlockView → RegisteredBlockView
}
```

`BlockView`:

```text
if (presentation adapter for dual-read Producten/About)
  → storefront brand views (ProductsBlockViews / AboutBlockViews)
else
  → RegisteredBlockView
```

No `switch (block.type)` over publishable BlockTypes in storefront composition.

## Module map

| Module | Responsibility |
|--------|----------------|
| `PageLayoutRenderer.tsx` | Ordered layout traversal, hidden/suppress rules, edit chrome, SafeSectionBoundary |
| `pageSectionRenderers.tsx` | Builtin pageKey → fixed renderer map |
| `homeSectionRenderers.tsx` | Home fixed map + deferred below-fold chunks |
| `BlockView.tsx` | Thin public/preview entry |
| `block-presentation.ts` | Pure presentation detection |
| `blockPresentationAdapters.tsx` | Producten/About dual-read brand adapters |
| `site-composition.ts` | Internal class model + test helpers |
| `sections/*Sections.tsx` | Fixed/application section views by page |
| `SitePageSections.tsx` | Compatibility re-export barrel only |

## Fixed compatibility until MG5

MG5 / MR are **out of scope**. R7 retains:

- Current fixed keys and renderers  
- Dual-read suppress helpers (`suppressedProductsFixedKeys`, `suppressedAboutFixedKeys`, …)  
- Legacy `sectionContent` paths for unmigrated snapshots  
- Presentation adapters sharing brand views with fixed Producten/About  

## Forms

| Concern | Owner |
|---------|-------|
| Form presentation (contactForm, newsletter, quote blocks) | cms-renderer + form adapters context |
| Application submission | storefront `submitWebsiteForm` via `CmsFormAdaptersProvider` |
| Fixed form pages (Contact/Offerte/Vacatures) | storefront section modules + FormPageChrome |
| Form source identities / aliases | cms-schema only |

## Localisation

Storefront uses canonical `cmsTextOrFallback` and `lib/cms-i18n` helpers. No parallel `storefrontCmsTextFallback` inventories.

## SEO / SSR

- Route `head` / meta remain on storefront routes (`__root`, page routes, `tanstackHeadFromCms`).  
- Composition must not move SEO-critical copy behind client-only wrappers.  
- Home below-fold sections stay lazy; hero remains eager.  
- Browser globals in fixed views (e.g. services modal `document`) stay gated (`typeof document !== "undefined"`).

## Error / fallback

- Unknown/malformed blocks: public → null; adminMode → alert (RegisteredBlockView).  
- Missing fixed renderer: public → null + dev log; preview → alert.  
- SafeSectionBoundary isolates section crashes.  
- No template injection on failed page fetch.
