# MG5 — Fixed → blocks migration audit

**Status:** Implementation complete (code) · Production apply **NO-GO** until operator gates  
**Date:** 2026-08-08  
**Migration version:** `fixed-block/v1`  
**Stop line:** R8 / MR not started

## Prerequisites verified

| ID | Status | Evidence |
|----|--------|----------|
| **R5** | Complete | Renderer registry closeout (`0ba08fd` · `a9d7882` · `9dfa92a` · `6ff6b3f`) |
| **M5** | Complete | `packages/cms-schema/src/e2e-inventory.ts` + `e2e/cms-loading-inventory.spec.ts` |
| **R6** | Complete | `4c47a0d` admin CMS store modules |
| **R7** | **R7_ACCEPTED** | `eb82322`…`a5acd36` + `3637321` · closeout docs |
| Starting HEAD | `237f3d6` | Clean tree on branch `mg5-fixed-blocks-migration` |

No unfinished R7 WIP mixed into MG5. No R8 / MR work.

## Existing machinery (extended, not reinvented)

| Area | Location | Role |
|------|----------|------|
| Deterministic IDs | `migration/block-id.ts` + `uuidV5.ts` | `uuidV5(pageId:fixedKey:role)` |
| Role catalog | `migration/roles.ts` | Every M5 fixed key → block type(s) |
| Family dual-read | `products/home-hero/about/offerte/legal-blocks.ts` | Admin persist authority + storefront resolve |
| Wholesale Gate apply | `migration/apply.ts` + `dry-run.ts` | Full remaining-fixed conversion |
| Form identity | `form-source.ts` + domain aliases | Never block UUID as sole identity |
| Draft CAS | `CmsStore.saveDraft` + `expectedRevisionNumber` | Optimistic concurrency |

## MG5 additions

| Module | Responsibility |
|--------|----------------|
| `mg5-matrix.ts` | M5-backed qualification matrix |
| `mg5-contract.ts` | Pure input/result/report types |
| `mg5-conflicts.ts` | Dual-representation classifier (fail closed) |
| `mg5-pipeline.ts` | Pure migrate (no I/O) |
| `mg5-backup.ts` | Backup artifact shapes + restore |
| `mg5-operator.ts` | Dry-run / apply / rollback gates |
| `scripts/cms-migrate-fixed-blocks.mts` | Operator CLI |

## Safety invariants

1. **No migrate-on-startup** — CLI only; never imported by app boot.
2. **Dry-run writes nothing** to CMS (qualification JSON under `.data/mg5-backups/` only).
3. **Apply fail-closed** — qualified run, matching hashes/revisions, backup, validation, post-write re-read.
4. **Production confirm** — `--confirm-production "MIGRATE PRODUCTION CMS"`.
5. **Compatibility retained** — fixed renderers / dual-read / aliases untouched (MR later).
6. **Schema version** — `CMS_SCHEMA_VERSION` remains **6**; layoutVersion not arbitrarily bumped.

## Known limitations (honest)

| Topic | Status |
|-------|--------|
| Dual-read family keys (products, home.hero, about, offerte main/form, legal) | Fixture-qualified |
| Remaining fixed keys (home.partners/stats/workGallery, services, contact.*, vacatures.*, offerte.info) | Mapped in matrix; **unqualified** for production until dual-read or full-mode staging proof |
| Producten editor repair (`forceProductsIntroAssortmentPair` / prepare incomplete) | Existing dual-read behaviour; MG5 operator uses `strictAbsence` |
| Production-like / staging cohort dry-run | Requires operator credentials + dataset — **not auto-executed** |
| Production canary / full apply | **NO-GO** — explicit operator initiation required |

## Classification

**MG5_CODE_COMPLETE** — machinery, matrix, tests, CLI, docs present.  
**Not** `MG5_QUALIFIED` until staging/production-like dry-run + backup/rollback on real cohort is green.  
**Not** `MG5_PRODUCTION_*`.
