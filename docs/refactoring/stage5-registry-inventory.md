# Stage 5 — CMS registry inventory

**Status:** Authoritative baseline (pre-family completion)
**Generated:** 2026-08-06T19:59:38.349Z
**Source of truth:** `BlockType` union in `packages/cms-schema/src/block-types.ts`, catalogs, editor/renderer registries, templates, tests.

## Summary

| Metric | Value |
|--------|------:|
| BlockType count | 35 |
| Editor registered | 35 / 35 |
| Renderer registered (blockViewRegistry) | 4 / 35 |
| Missing renderer registry | 31 |
| Missing editor | 0 |

### Already registered (preserve)

- `steps` → StepsSectionView
- `jobs` → JobsSectionView
- `offers` → OffersSectionView
- `plans` → PlansSectionView (checkpoint d1b3c12)

### Conversion views exist but not registry-keyed yet

- `newsletter`, `contactForm`, `popup` → ConversionSectionViews.tsx (inline switch dispatch)

## Inventory rows

| type | family | publishable | selectable | editorReg | rendererReg | status | schema | editor | renderer | switch |
|------|--------|:-----------:|:----------:|:---------:|:-----------:|--------|--------|--------|----------|--------|
| hero | A-basic-content | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | HeroBlockEditor.tsx | inline | Y |
| richText | A-basic-content | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | TitleBodyCtaBlockEditor.tsx | inline | Y |
| centered | A-basic-content | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | TitleBodyCtaBlockEditor.tsx | inline | Y |
| textImage | A-basic-content | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | TextImageBlockEditor.tsx | inline | Y |
| columns | B-structural | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | StructureBlockEditors.tsx | inline | Y |
| benefits | B-structural | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | StructureBlockEditors.tsx | inline | Y |
| quote | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | MiscBlockEditors.tsx | inline | Y |
| gallery | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | GalleryBlockEditor.tsx | inline | Y |
| video | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | MediaBlockEditors.tsx | inline | Y |
| beforeAfter | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | MediaBlockEditors.tsx | inline | Y |
| carousel | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | GalleryBlockEditor.tsx | inline | Y |
| steps | B-structural | Y | Y | Y | Y | complete | blocks/catalog.ts | StructureBlockEditors.tsx | StepsSectionView.tsx | Y |
| comparisonTable | B-structural | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | StructureBlockEditors.tsx | inline | Y |
| featureGrid | A-basic-content | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | FeatureGridBlockEditor.tsx | inline | Y |
| spacer | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | MiscBlockEditors.tsx | inline | Y |
| teamGrid | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | TeamJobsBlockEditor.tsx | inline | Y |
| teamProfile | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | MiscBlockEditors.tsx | inline | Y |
| values | B-structural | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | StructureBlockEditors.tsx | inline | Y |
| timeline | B-structural | Y | Y | Y | N | switch-fallback | blocks/timeline.ts | StructureBlockEditors.tsx | inline | Y |
| roadmap | B-structural | Y | Y | Y | N | switch-fallback | blocks/roadmap.ts | RoadmapBlockEditor.tsx | inline | Y |
| plans | F-specialised | Y | Y | Y | Y | complete | blocks/plans.ts | PlansBlockEditor.tsx | PlansSectionView.tsx | Y |
| cta | A-basic-content | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | CtaBlockEditor.tsx | inline | Y |
| newsletter | E-conversion-forms | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | ConversionBlockEditors.tsx | ConversionSectionViews.tsx | Y |
| contactForm | E-conversion-forms | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | ConversionBlockEditors.tsx | ConversionSectionViews.tsx | Y |
| announcement | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | MiscBlockEditors.tsx | inline | Y |
| popup | E-conversion-forms | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | ConversionBlockEditors.tsx | ConversionSectionViews.tsx | Y |
| portfolio | B-structural | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | StructureBlockEditors.tsx | inline | Y |
| jobs | F-specialised | Y | Y | Y | Y | complete | blocks/jobs.ts | TeamJobsBlockEditor.tsx | JobsSectionView.tsx | Y |
| latestPosts | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/catalog.ts | StructureBlockEditors.tsx | inline | Y |
| partnersMarquee | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | inline | Y |
| statsCounters | C-media-social-proof | Y | Y | Y | N | switch-fallback | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | inline | Y |
| contactInfoCards | D-information-legal | Y | Y | Y | N | switch-fallback | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | inline | Y |
| quoteRequestForm | E-conversion-forms | Y | Y | Y | N | switch-fallback | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | inline | Y |
| legalArticles | D-information-legal | Y | Y | Y | N | switch-fallback | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | inline | Y |
| offers | F-specialised | Y | Y | Y | Y | complete | blocks/offers.ts | OffersBlockEditor.tsx | OffersSectionView.tsx | Y |

## Per-type detail

### `hero`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[hero].createDefault
- **normalizer:** catalogDefinitions[hero].normalize
- **validator:** catalogDefinitions[hero].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/HeroBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "hero"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/visual-regression.test.tsx`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `switch-fallback`

### `richText`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[richText].createDefault
- **normalizer:** catalogDefinitions[richText].normalize
- **validator:** catalogDefinitions[richText].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TitleBodyCtaBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "richText"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/CmsButtonView.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/PopupContentTypePicker.test.tsx`
- **status:** `switch-fallback`

### `centered`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[centered].createDefault
- **normalizer:** catalogDefinitions[centered].normalize
- **validator:** catalogDefinitions[centered].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TitleBodyCtaBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "centered"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/gallery-text-image.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `switch-fallback`

### `textImage`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[textImage].createDefault
- **normalizer:** catalogDefinitions[textImage].normalize
- **validator:** catalogDefinitions[textImage].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TextImageBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "textImage"
- **templateEntries:** admin/templates ×2, storefront/templates ×2
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/visual-regression.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `switch-fallback`

### `columns`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[columns].createDefault
- **normalizer:** catalogDefinitions[columns].normalize
- **validator:** catalogDefinitions[columns].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "columns"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/gallery-text-image.test.tsx`, `packages/cms-schema/src/blocks/gallery.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`
- **status:** `switch-fallback`

### `benefits`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[benefits].createDefault
- **normalizer:** catalogDefinitions[benefits].normalize
- **validator:** catalogDefinitions[benefits].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "benefits"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `quote`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[quote].createDefault
- **normalizer:** catalogDefinitions[quote].normalize
- **validator:** catalogDefinitions[quote].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MiscBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "quote"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/quote.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`
- **status:** `switch-fallback`

### `gallery`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[gallery].createDefault
- **normalizer:** catalogDefinitions[gallery].normalize
- **validator:** catalogDefinitions[gallery].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/GalleryBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "gallery"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/gallery-text-image.test.tsx`, `packages/cms-schema/src/blocks/gallery.test.ts`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`, `packages/cms-editor/src/blocks/PopupContentTypePicker.test.tsx`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `switch-fallback`

### `video`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[video].createDefault
- **normalizer:** catalogDefinitions[video].normalize
- **validator:** catalogDefinitions[video].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MediaBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "video"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `switch-fallback`

### `beforeAfter`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[beforeAfter].createDefault
- **normalizer:** catalogDefinitions[beforeAfter].normalize
- **validator:** catalogDefinitions[beforeAfter].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MediaBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "beforeAfter"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `switch-fallback`

### `carousel`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[carousel].createDefault
- **normalizer:** catalogDefinitions[carousel].normalize
- **validator:** catalogDefinitions[carousel].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/GalleryBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "carousel"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `steps`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[steps].createDefault
- **normalizer:** catalogDefinitions[steps].normalize
- **validator:** catalogDefinitions[steps].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/StepsSectionView.tsx` (registered=true)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "steps"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/StepsSectionView.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/steps.test.ts`
- **status:** `complete`

### `comparisonTable`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[comparisonTable].createDefault
- **normalizer:** catalogDefinitions[comparisonTable].normalize
- **validator:** catalogDefinitions[comparisonTable].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "comparisonTable"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `featureGrid`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[featureGrid].createDefault
- **normalizer:** catalogDefinitions[featureGrid].normalize
- **validator:** catalogDefinitions[featureGrid].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/FeatureGridBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "featureGrid"
- **templateEntries:** admin/templates ×2, storefront/templates ×2
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `switch-fallback`

### `spacer`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[spacer].createDefault
- **normalizer:** catalogDefinitions[spacer].normalize
- **validator:** catalogDefinitions[spacer].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MiscBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "spacer"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`
- **status:** `switch-fallback`

### `teamGrid`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[teamGrid].createDefault
- **normalizer:** catalogDefinitions[teamGrid].normalize
- **validator:** catalogDefinitions[teamGrid].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TeamJobsBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "teamGrid"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `switch-fallback`

### `teamProfile`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[teamProfile].createDefault
- **normalizer:** catalogDefinitions[teamProfile].normalize
- **validator:** catalogDefinitions[teamProfile].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MiscBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "teamProfile"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `values`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[values].createDefault
- **normalizer:** catalogDefinitions[values].normalize
- **validator:** catalogDefinitions[values].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "values"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/form-fields.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `timeline`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/timeline.ts`
- **defaultFactory:** createDefault / catalogDefinitions[timeline].createDefault
- **normalizer:** catalogDefinitions[timeline].normalize
- **validator:** catalogDefinitions[timeline].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "timeline"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `roadmap`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/roadmap.ts`
- **defaultFactory:** createDefault / catalogDefinitions[roadmap].createDefault
- **normalizer:** catalogDefinitions[roadmap].normalize
- **validator:** catalogDefinitions[roadmap].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/RoadmapBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "roadmap"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/visual-regression.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/roadmap.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `switch-fallback`

### `plans`

- **family:** F-specialised
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/plans.ts`
- **defaultFactory:** createDefault / catalogDefinitions[plans].createDefault
- **normalizer:** catalogDefinitions[plans].normalize
- **validator:** catalogDefinitions[plans].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/PlansBlockEditor.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/PlansSectionView.tsx` (registered=true)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "plans"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/plans-a11y.test.tsx`, `packages/cms-renderer/src/blocks/PlansSectionView.test.tsx`, `packages/cms-renderer/src/blocks/visual-regression.test.tsx`, `packages/cms-schema/src/blocks/plans.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`, `packages/cms-editor/src/blocks/PlansBlockEditor.a11y.test.tsx`
- **status:** `complete`

### `cta`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[cta].createDefault
- **normalizer:** catalogDefinitions[cta].normalize
- **validator:** catalogDefinitions[cta].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/CtaBlockEditor.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "cta"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/plans.test.ts`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `switch-fallback`

### `newsletter`

- **family:** E-conversion-forms
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[newsletter].createDefault
- **normalizer:** catalogDefinitions[newsletter].normalize
- **validator:** catalogDefinitions[newsletter].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/ConversionBlockEditors.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "newsletter"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/RegisteredBlockView.smoke.test.tsx`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`
- **status:** `switch-fallback`

### `contactForm`

- **family:** E-conversion-forms
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[contactForm].createDefault
- **normalizer:** catalogDefinitions[contactForm].normalize
- **validator:** catalogDefinitions[contactForm].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/ConversionBlockEditors.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "contactForm"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/RegisteredBlockView.smoke.test.tsx`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `switch-fallback`

### `announcement`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[announcement].createDefault
- **normalizer:** catalogDefinitions[announcement].normalize
- **validator:** catalogDefinitions[announcement].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MiscBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "announcement"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `switch-fallback`

### `popup`

- **family:** E-conversion-forms
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[popup].createDefault
- **normalizer:** catalogDefinitions[popup].normalize
- **validator:** catalogDefinitions[popup].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/ConversionBlockEditors.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "popup"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/CmsButtonView.test.tsx`, `packages/cms-renderer/src/blocks/RegisteredBlockView.smoke.test.tsx`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/PopupContentTypePicker.test.tsx`, `packages/cms-editor/src/blocks/SectionTypeThumbnail.test.tsx`
- **status:** `switch-fallback`

### `portfolio`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[portfolio].createDefault
- **normalizer:** catalogDefinitions[portfolio].normalize
- **validator:** catalogDefinitions[portfolio].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "portfolio"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `jobs`

- **family:** F-specialised
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/jobs.ts`
- **defaultFactory:** createDefault / catalogDefinitions[jobs].createDefault
- **normalizer:** catalogDefinitions[jobs].normalize
- **validator:** catalogDefinitions[jobs].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TeamJobsBlockEditor.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/JobsSectionView.tsx` (registered=true)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "jobs"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/jobs.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/vacancy-application.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `complete`

### `latestPosts`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[latestPosts].createDefault
- **normalizer:** catalogDefinitions[latestPosts].normalize
- **validator:** catalogDefinitions[latestPosts].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "latestPosts"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`
- **status:** `switch-fallback`

### `partnersMarquee`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[partnersMarquee].createDefault
- **normalizer:** catalogDefinitions[partnersMarquee].normalize
- **validator:** catalogDefinitions[partnersMarquee].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "partnersMarquee"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `statsCounters`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[statsCounters].createDefault
- **normalizer:** catalogDefinitions[statsCounters].normalize
- **validator:** catalogDefinitions[statsCounters].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "statsCounters"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `contactInfoCards`

- **family:** D-information-legal
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[contactInfoCards].createDefault
- **normalizer:** catalogDefinitions[contactInfoCards].normalize
- **validator:** catalogDefinitions[contactInfoCards].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "contactInfoCards"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `quoteRequestForm`

- **family:** E-conversion-forms
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[quoteRequestForm].createDefault
- **normalizer:** catalogDefinitions[quoteRequestForm].normalize
- **validator:** catalogDefinitions[quoteRequestForm].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "quoteRequestForm"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `legalArticles`

- **family:** D-information-legal
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[legalArticles].createDefault
- **normalizer:** catalogDefinitions[legalArticles].normalize
- **validator:** catalogDefinitions[legalArticles].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `RegisteredBlockView.tsx (inline switch)` (registered=false)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "legalArticles"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `switch-fallback`

### `offers`

- **family:** F-specialised
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/offers.ts`
- **defaultFactory:** createDefault / catalogDefinitions[offers].createDefault
- **normalizer:** catalogDefinitions[offers].normalize
- **validator:** catalogDefinitions[offers].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/OffersBlockEditor.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/OffersSectionView.tsx` (registered=true)
- **inlineSwitchLocation:** RegisteredBlockView.tsx case "offers"
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/OffersSectionView.test.tsx`, `packages/cms-schema/src/blocks/offers.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`
- **status:** `complete`

## Explicit exemptions

No BlockType exemptions at baseline. Fixed builtin sections (`services.main`, `services.cards`, `home.hero`, Producten fixed keys, etc.) are **not** BlockTypes and are out of Stage 5 registry scope (explicit non-block paths).

## Baseline line counts (Phase 0)

| File | Lines (approx) | Responsibility |
|------|---------------:|----------------|
| RegisteredBlockView.tsx | 1214 | parse + large JSX switch + registry dispatch for 4 types |
| blockViewRegistry.ts | 24 | Partial map: jobs, offers, plans, steps |
| blockEditorRegistry.ts | 497 | Full editor map (35/35) |
| catalog.ts | 1413 | Inline + imported block definitions |

## Stage5BlockInventoryRow shape

```ts
type Stage5BlockInventoryRow = {
  type: BlockType;
  family: "A-basic-content" | "B-structural" | "C-media-social-proof"
    | "D-information-legal" | "E-conversion-forms" | "F-specialised" | "explicit-exemption";
  publishable: boolean;
  selectable: boolean;
  persistedInFixtures: boolean;
  schemaModule: string;
  defaultFactory: string;
  normalizer: string;
  validator: string;
  editorModule: string | null;
  editorRegistered: boolean;
  rendererModule: string | null;
  rendererRegistered: boolean;
  inlineSwitchLocation: string | null;
  templateEntries: string[];
  translatableFieldCoverage: string | null;
  currentTests: string[];
  status: "complete" | "missing-schema" | "missing-editor" | "missing-renderer"
    | "switch-fallback" | "exempt";
  exemptionReason?: string;
};
```
