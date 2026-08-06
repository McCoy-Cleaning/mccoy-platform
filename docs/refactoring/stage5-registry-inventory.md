# Stage 5 — CMS registry inventory

**Status:** Complete (all publishable types registered)
**Generated:** 2026-08-06T21:31:55.333Z
**Source of truth:** `BlockType` union in `packages/cms-schema/src/block-types.ts`, catalogs, editor/renderer registries, templates, tests.

## Summary

| Metric | Value |
|--------|------:|
| BlockType count | 35 |
| Editor registered | 35 / 35 |
| Renderer registered (blockViewRegistry) | 35 / 35 |
| Missing renderer registry | 0 |
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
| hero | A-basic-content | Y | Y | Y | Y | complete | blocks/catalog.ts | HeroBlockEditor.tsx | blockViewRegistry (family module) | N |
| richText | A-basic-content | Y | Y | Y | Y | complete | blocks/catalog.ts | TitleBodyCtaBlockEditor.tsx | blockViewRegistry (family module) | N |
| centered | A-basic-content | Y | Y | Y | Y | complete | blocks/catalog.ts | TitleBodyCtaBlockEditor.tsx | blockViewRegistry (family module) | N |
| textImage | A-basic-content | Y | Y | Y | Y | complete | blocks/catalog.ts | TextImageBlockEditor.tsx | blockViewRegistry (family module) | N |
| columns | B-structural | Y | Y | Y | Y | complete | blocks/catalog.ts | StructureBlockEditors.tsx | blockViewRegistry (family module) | N |
| benefits | B-structural | Y | Y | Y | Y | complete | blocks/catalog.ts | StructureBlockEditors.tsx | blockViewRegistry (family module) | N |
| quote | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | MiscBlockEditors.tsx | blockViewRegistry (family module) | N |
| gallery | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | GalleryBlockEditor.tsx | blockViewRegistry (family module) | N |
| video | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | MediaBlockEditors.tsx | blockViewRegistry (family module) | N |
| beforeAfter | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | MediaBlockEditors.tsx | blockViewRegistry (family module) | N |
| carousel | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | GalleryBlockEditor.tsx | blockViewRegistry (family module) | N |
| steps | B-structural | Y | Y | Y | Y | complete | blocks/catalog.ts | StructureBlockEditors.tsx | StepsSectionView.tsx | N |
| comparisonTable | B-structural | Y | Y | Y | Y | complete | blocks/catalog.ts | StructureBlockEditors.tsx | blockViewRegistry (family module) | N |
| featureGrid | A-basic-content | Y | Y | Y | Y | complete | blocks/catalog.ts | FeatureGridBlockEditor.tsx | blockViewRegistry (family module) | N |
| spacer | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | MiscBlockEditors.tsx | blockViewRegistry (family module) | N |
| teamGrid | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | TeamJobsBlockEditor.tsx | blockViewRegistry (family module) | N |
| teamProfile | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | MiscBlockEditors.tsx | blockViewRegistry (family module) | N |
| values | B-structural | Y | Y | Y | Y | complete | blocks/catalog.ts | StructureBlockEditors.tsx | blockViewRegistry (family module) | N |
| timeline | B-structural | Y | Y | Y | Y | complete | blocks/timeline.ts | StructureBlockEditors.tsx | blockViewRegistry (family module) | N |
| roadmap | B-structural | Y | Y | Y | Y | complete | blocks/roadmap.ts | RoadmapBlockEditor.tsx | blockViewRegistry (family module) | N |
| plans | F-specialised | Y | Y | Y | Y | complete | blocks/plans.ts | PlansBlockEditor.tsx | PlansSectionView.tsx | N |
| cta | A-basic-content | Y | Y | Y | Y | complete | blocks/catalog.ts | CtaBlockEditor.tsx | blockViewRegistry (family module) | N |
| newsletter | E-conversion-forms | Y | Y | Y | Y | complete | blocks/catalog.ts | ConversionBlockEditors.tsx | ConversionSectionViews.tsx | N |
| contactForm | E-conversion-forms | Y | Y | Y | Y | complete | blocks/catalog.ts | ConversionBlockEditors.tsx | ConversionSectionViews.tsx | N |
| announcement | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | MiscBlockEditors.tsx | blockViewRegistry (family module) | N |
| popup | E-conversion-forms | Y | Y | Y | Y | complete | blocks/catalog.ts | ConversionBlockEditors.tsx | ConversionSectionViews.tsx | N |
| portfolio | B-structural | Y | Y | Y | Y | complete | blocks/catalog.ts | StructureBlockEditors.tsx | blockViewRegistry (family module) | N |
| jobs | F-specialised | Y | Y | Y | Y | complete | blocks/jobs.ts | TeamJobsBlockEditor.tsx | JobsSectionView.tsx | N |
| latestPosts | C-media-social-proof | Y | Y | Y | Y | complete | blocks/catalog.ts | StructureBlockEditors.tsx | blockViewRegistry (family module) | N |
| partnersMarquee | C-media-social-proof | Y | Y | Y | Y | complete | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | blockViewRegistry (family module) | N |
| statsCounters | C-media-social-proof | Y | Y | Y | Y | complete | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | blockViewRegistry (family module) | N |
| contactInfoCards | D-information-legal | Y | Y | Y | Y | complete | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | blockViewRegistry (family module) | N |
| quoteRequestForm | E-conversion-forms | Y | Y | Y | Y | complete | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | blockViewRegistry (family module) | N |
| legalArticles | D-information-legal | Y | Y | Y | Y | complete | blocks/new-sections.ts | NewSectionsBlockEditors.tsx | blockViewRegistry (family module) | N |
| offers | F-specialised | Y | Y | Y | Y | complete | blocks/offers.ts | OffersBlockEditor.tsx | OffersSectionView.tsx | N |

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
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/visual-regression.test.tsx`, `packages/cms-renderer/src/blocks/xss-text-nodes.test.tsx`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `complete`

### `richText`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[richText].createDefault
- **normalizer:** catalogDefinitions[richText].normalize
- **validator:** catalogDefinitions[richText].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TitleBodyCtaBlockEditor.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/CmsButtonView.test.tsx`, `packages/cms-renderer/src/blocks/xss-text-nodes.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/PopupContentTypePicker.test.tsx`
- **status:** `complete`

### `centered`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[centered].createDefault
- **normalizer:** catalogDefinitions[centered].normalize
- **validator:** catalogDefinitions[centered].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TitleBodyCtaBlockEditor.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/gallery-text-image.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `complete`

### `textImage`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[textImage].createDefault
- **normalizer:** catalogDefinitions[textImage].normalize
- **validator:** catalogDefinitions[textImage].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TextImageBlockEditor.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×2, storefront/templates ×2
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/visual-regression.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `complete`

### `columns`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[columns].createDefault
- **normalizer:** catalogDefinitions[columns].normalize
- **validator:** catalogDefinitions[columns].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/gallery-text-image.test.tsx`, `packages/cms-schema/src/blocks/gallery.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`
- **status:** `complete`

### `benefits`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[benefits].createDefault
- **normalizer:** catalogDefinitions[benefits].normalize
- **validator:** catalogDefinitions[benefits].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `quote`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[quote].createDefault
- **normalizer:** catalogDefinitions[quote].normalize
- **validator:** catalogDefinitions[quote].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MiscBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/quote.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`
- **status:** `complete`

### `gallery`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[gallery].createDefault
- **normalizer:** catalogDefinitions[gallery].normalize
- **validator:** catalogDefinitions[gallery].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/GalleryBlockEditor.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/gallery-text-image.test.tsx`, `packages/cms-schema/src/blocks/gallery.test.ts`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`, `packages/cms-editor/src/blocks/PopupContentTypePicker.test.tsx`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `complete`

### `video`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[video].createDefault
- **normalizer:** catalogDefinitions[video].normalize
- **validator:** catalogDefinitions[video].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MediaBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `complete`

### `beforeAfter`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[beforeAfter].createDefault
- **normalizer:** catalogDefinitions[beforeAfter].normalize
- **validator:** catalogDefinitions[beforeAfter].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MediaBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `complete`

### `carousel`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[carousel].createDefault
- **normalizer:** catalogDefinitions[carousel].normalize
- **validator:** catalogDefinitions[carousel].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/GalleryBlockEditor.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

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
- **inlineSwitchLocation:** null
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
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `featureGrid`

- **family:** A-basic-content
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[featureGrid].createDefault
- **normalizer:** catalogDefinitions[featureGrid].normalize
- **validator:** catalogDefinitions[featureGrid].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/FeatureGridBlockEditor.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×2, storefront/templates ×2
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `complete`

### `spacer`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[spacer].createDefault
- **normalizer:** catalogDefinitions[spacer].normalize
- **validator:** catalogDefinitions[spacer].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MiscBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`
- **status:** `complete`

### `teamGrid`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[teamGrid].createDefault
- **normalizer:** catalogDefinitions[teamGrid].normalize
- **validator:** catalogDefinitions[teamGrid].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/TeamJobsBlockEditor.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `complete`

### `teamProfile`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[teamProfile].createDefault
- **normalizer:** catalogDefinitions[teamProfile].normalize
- **validator:** catalogDefinitions[teamProfile].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MiscBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `values`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[values].createDefault
- **normalizer:** catalogDefinitions[values].normalize
- **validator:** catalogDefinitions[values].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/form-fields.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `timeline`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/timeline.ts`
- **defaultFactory:** createDefault / catalogDefinitions[timeline].createDefault
- **normalizer:** catalogDefinitions[timeline].normalize
- **validator:** catalogDefinitions[timeline].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `roadmap`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/roadmap.ts`
- **defaultFactory:** createDefault / catalogDefinitions[roadmap].createDefault
- **normalizer:** catalogDefinitions[roadmap].normalize
- **validator:** catalogDefinitions[roadmap].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/RoadmapBlockEditor.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/visual-regression.test.tsx`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/roadmap.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `complete`

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
- **inlineSwitchLocation:** null
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
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/plans.test.ts`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/RegisteredBlockEditor.custom.test.tsx`
- **status:** `complete`

### `newsletter`

- **family:** E-conversion-forms
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[newsletter].createDefault
- **normalizer:** catalogDefinitions[newsletter].normalize
- **validator:** catalogDefinitions[newsletter].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/ConversionBlockEditors.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/RegisteredBlockView.smoke.test.tsx`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/en-draft-fields.test.tsx`
- **status:** `complete`

### `contactForm`

- **family:** E-conversion-forms
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[contactForm].createDefault
- **normalizer:** catalogDefinitions[contactForm].normalize
- **validator:** catalogDefinitions[contactForm].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/ConversionBlockEditors.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/RegisteredBlockView.smoke.test.tsx`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `complete`

### `announcement`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[announcement].createDefault
- **normalizer:** catalogDefinitions[announcement].normalize
- **validator:** catalogDefinitions[announcement].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/MiscBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`
- **status:** `complete`

### `popup`

- **family:** E-conversion-forms
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[popup].createDefault
- **normalizer:** catalogDefinitions[popup].normalize
- **validator:** catalogDefinitions[popup].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/ConversionBlockEditors.tsx` (registered=true)
- **rendererModule:** `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-renderer/src/blocks/CmsButtonView.test.tsx`, `packages/cms-renderer/src/blocks/RegisteredBlockView.smoke.test.tsx`, `packages/cms-schema/src/blocks/popup-content-options.test.ts`, `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`, `packages/cms-editor/src/blocks/blockEditorRegistry.test.ts`, `packages/cms-editor/src/blocks/PopupContentTypePicker.test.tsx`, `packages/cms-editor/src/blocks/SectionTypeThumbnail.test.tsx`
- **status:** `complete`

### `portfolio`

- **family:** B-structural
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/catalog.ts`
- **defaultFactory:** createDefault / catalogDefinitions[portfolio].createDefault
- **normalizer:** catalogDefinitions[portfolio].normalize
- **validator:** catalogDefinitions[portfolio].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

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
- **inlineSwitchLocation:** null
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
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`, `packages/cms-schema/src/blocks/validate.test.ts`
- **status:** `complete`

### `partnersMarquee`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[partnersMarquee].createDefault
- **normalizer:** catalogDefinitions[partnersMarquee].normalize
- **validator:** catalogDefinitions[partnersMarquee].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `statsCounters`

- **family:** C-media-social-proof
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[statsCounters].createDefault
- **normalizer:** catalogDefinitions[statsCounters].normalize
- **validator:** catalogDefinitions[statsCounters].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `contactInfoCards`

- **family:** D-information-legal
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[contactInfoCards].createDefault
- **normalizer:** catalogDefinitions[contactInfoCards].normalize
- **validator:** catalogDefinitions[contactInfoCards].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `quoteRequestForm`

- **family:** E-conversion-forms
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[quoteRequestForm].createDefault
- **normalizer:** catalogDefinitions[quoteRequestForm].normalize
- **validator:** catalogDefinitions[quoteRequestForm].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

### `legalArticles`

- **family:** D-information-legal
- **publishable / selectable:** true / true
- **persistedInFixtures:** true
- **schemaModule:** `packages/cms-schema/src/blocks/new-sections.ts`
- **defaultFactory:** createDefault / catalogDefinitions[legalArticles].createDefault
- **normalizer:** catalogDefinitions[legalArticles].normalize
- **validator:** catalogDefinitions[legalArticles].validateForPublish (via registry)
- **editorModule:** `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` (registered=true)
- **rendererModule:** `blockViewRegistry (family module)` (registered=true)
- **inlineSwitchLocation:** null
- **templateEntries:** admin/templates ×1, storefront/templates ×1
- **translatableFieldCoverage:** EN drafts via fieldPath conventions (cms-schema translation-*)
- **currentTests:** `packages/cms-schema/src/blocks/registry.test.ts`
- **status:** `complete`

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
- **inlineSwitchLocation:** null
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
