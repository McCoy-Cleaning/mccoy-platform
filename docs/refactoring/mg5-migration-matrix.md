# MG5 — Migration qualification matrix

**Source of truth:** M5 inventory (`FIXED_SECTIONS_BY_PAGE` / `e2e-inventory.ts`) + `FIXED_SECTION_MIGRATION_ROLES`.  
**Code:** `packages/cms-schema/src/migration/mg5-matrix.ts` (`MG5_MIGRATION_MATRIX`).  
**Migration version:** `fixed-block/v1`

## Summary

| Metric | Count |
|--------|------:|
| M5 fixed keys | 20 |
| Matrix rows (key × role) | 23 |
| Migration-eligible rows | 23 |
| Intentionally fixed | 0 |
| Compatibility-only | 0 |
| Dual-read module rows | 10 |
| Fixture-qualified rows | 10 |
| Unqualified rows | 13 |

Every M5 fixed key appears. No unexplained gaps.

## Deterministic ID algorithm

```
blockId = uuidV5(`${pageId}:${fixedKey}:${role}`, CMS_MIGRATION_NAMESPACE)
```

- Namespace (locked): `6b8a4e2c-9f1d-4a7b-8c3e-5d2f1a0b9e7c`
- Never includes title, locale, content, time, or random values
- Nested items: preserve legacy `id` when present; otherwise position-stable uuidV5 documented per row

## Eligibility legend

| Qualification | Meaning |
|---------------|---------|
| `fixture-qualified` | Dual-read module + unit/fixture tests green |
| `dry-run-green` | Mapping + Gate dry-run only |
| `unqualified` | Mapping exists; production apply blocked |
| `staging-qualified` / `production-qualified` | Reserved for operator cohort runs |

## Matrix

| pageKey | legacySectionKey | role | targetBlockType | dual-read | qualification | form identity |
|---------|------------------|------|-----------------|-----------|---------------|---------------|
| home | home.hero | primary | hero | yes | fixture-qualified | — |
| home | home.partners | primary | partnersMarquee | no | unqualified | — |
| home | home.stats | primary | statsCounters | no | unqualified | — |
| home | home.workGallery | primary | gallery | no | unqualified | — |
| about | about.main | intro | centered | yes | fixture-qualified | — |
| about | about.main | mission | textImage | yes | fixture-qualified | — |
| about | about.main | vision | textImage | yes | fixture-qualified | — |
| about | about.main | history | textImage | yes | fixture-qualified | — |
| services | services.main | intro | centered | no | unqualified | — |
| services | services.cards | primary | portfolio | no | unqualified | — |
| products | products.main | primary | textImage | yes | fixture-qualified | — |
| products | products.info | primary | featureGrid | yes | fixture-qualified | — |
| contact | contact.main | primary | hero | no | unqualified | — |
| contact | contact.info | primary | contactInfoCards | no | unqualified | — |
| contact | contact.form | primary | contactForm | no | unqualified | `fixed:contact:form` → `builtin:contact:primary` |
| vacatures | vacatures.main | primary | hero | no | unqualified | — |
| vacatures | vacatures.application | primary | contactForm | no | unqualified | `fixed:vacatures:application` → `builtin:vacatures:application` |
| offerte | offerte.main | primary | hero | yes | fixture-qualified | — |
| offerte | offerte.info | primary | contactInfoCards | no | unqualified | — |
| offerte | offerte.form | primary | quoteRequestForm | yes | fixture-qualified | `fixed:offerte:form` → `builtin:offerte:primary` |
| privacy | privacy.main | primary | legalArticles | yes | fixture-qualified | — |
| terms | terms.main | primary | legalArticles | yes | fixture-qualified | — |

## Order / visibility / absence

- **Order:** layout walk order preserved; multi-role expands in `FIXED_SECTION_MIGRATION_ROLES` order.
- **Visibility:** `hidden` copied onto created block layout items.
- **Absence:** optional section absent ⇒ no replacement block (MG5 `strictAbsence`; Producten verified-empty preserved).

## Conflict policy

| Class | Dry-run | Apply |
|-------|---------|-------|
| none / equivalent / target_already_exists | report | continue (no duplicate) |
| content_conflict / ambiguous | flag | **fail closed** |

## Rollback

Pre-apply backup artifact (`.data/mg5-backups/<runId>.backup.json`) + `runMg5Rollback` with divergence detection.
