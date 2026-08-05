# Field-level English translation — verified audit

**Date:** 2026-08-05  
**Scope:** Platform-wide CMS EN localisation (not Producten-only)  
**Session:** `788fc2` (runtime evidence via vitest + overlay instrumentation)

## Pipeline (verified)

```text
NL CMS content
  → collectPageNlFieldDraftMap / collectTranslatableStringPaths  (cms-schema/en-field-sync.ts)
  → planEnFieldDraftSync + translateNlToEn (Opslaan / AI toolbar / translate-missing)
  → enFieldDrafts + enFieldDraftSources + enFieldDraftMeta persistence (CmsPage)
  → localizeCmsPageForLocale → applyEnFieldDraftsToPage           (cms-schema/en-field-drafts.ts)
  → preview (cms-preview.tsx) + storefront (useCmsPageForView / resolvePublishedCmsPage)
```

| Stage | Primary files |
|-------|----------------|
| Discovery | `packages/cms-schema/src/en-field-sync.ts` (stable item ids; index/colon aliases) |
| Paths | `enFieldDraftPath` → `section:…` / `block:…` / `page:meta:…`; nested field uses dotted stable ids (`features.prod_hygiene.title`) |
| Classifier / resolver | `packages/cms-schema/src/translation-field.ts` |
| Coverage / translate-missing | `packages/cms-schema/src/translation-coverage.ts` |
| Repair dry-run | `packages/cms-schema/src/translation-repair.ts` |
| Translate | `apps/admin/src/lib/cms/store.ts` `savePage`, `translateMissingEnFields`, `packages/content-ai` |
| Overlay | `packages/cms-schema/src/en-field-drafts.ts` |
| Public resolve | `packages/cms-schema/src/resolve.ts`, `packages/database/src/cms/resolve.ts` |
| Preview | `apps/storefront/src/routes/cms-preview.tsx` |
| Storefront | `use-cms-page-for-view.ts`, section/block views via `cmsTextOrFallback` |

Preview and public storefront both call `localizeCmsPageForLocale` — same overlay function.

## How “English exists” is decided

| Level | Rule | Notes |
|-------|------|-------|
| **Page** | `localeStates.en.publicationState === "published"` and/or `localeContent.en` present | Document-level gate; does **not** mean every field is translated |
| **Field (classifier)** | `classifyTranslationField` → missing / blank / machine / manual / intentional_blank / stale / … | Shared by coverage, translate-missing, publish gate |
| **Field (overlay)** | Apply non-blank drafts; blank without `intentional_blank` keeps NL | Verified by regression tests |
| **Field (UI)** | `lookupEnFieldDraft` resolves index/colon aliases onto stable-id keys | Manual EN + AI drafts stay aligned after remap |

**English page exists ≠ every individual English field is translated.**

## Verified root causes (and fixes)

### 1. Overlay contract (canonical) — FIXED / guarded

`applyEnFieldDraftsToPage` skips whitespace-only drafts unless `enFieldDraftMeta[path].status === "intentional_blank"`.  
Regression: blank / whitespace EN without intentional_blank never replaces NL.

### 2. Storefront empty-string guards — FIXED

Removed `content.x === "" ? "" : cmsTextOrFallback(...)` short-circuits in products section/block views. Empty CMS now falls through `cmsTextOrFallback` to locale/static EN (or NL factory) fallbacks.

### 3. Coverage / path identity — FIXED

- Discovery prefers **stable item ids** (`features.prod_hygiene.title`) over indexes.
- `remapEnFieldDraftsToCanonicalPaths` maps colon (`features:prod_hygiene:title`) and index (`features.0.title`) aliases onto canonical keys on Opslaan / translate-missing.
- Coverage scanner + “Ontbrekende velden vertalen” + EN publish preflight live in admin `LocalePublishPanel`.

## Field-state model

States: `not_translatable` | `source_empty` | `missing` | `blank` | `machine_translated` | `manually_translated` | `intentional_blank` | `stale` | `invalid`.

`resolveLocalizedField`: blank without intentional_blank → Dutch fallback when `fallbackToSource`.

## Non-goals for render path

- Do **not** call AI from storefront, preview, or the locale resolver.
- Translation runs in editor/backend (Opslaan, translate-missing, repair dry-run, EN publish preflight).

## Tests (session evidence)

```text
npx vitest run src/translation-field.test.ts src/translation-coverage.test.ts \
  src/en-field-drafts.test.ts src/en-field-sync.test.ts src/cms-text-fallback.test.ts
→ 5 files, 48 passed
```

## Remaining limitations

- Not every list editor path was switched to stable ids yet; alias lookup covers remaining index paths.
- Rich-text structured translate / HTML validation not expanded beyond existing paragraph-structure sync.
- Repair helper is dry-run only (no unreviewed bulk write).
- Browser E2E of LocalePublishPanel + storefront EN page still needs user/manual verification.
