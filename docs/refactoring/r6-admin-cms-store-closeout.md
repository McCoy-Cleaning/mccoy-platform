# R6 — Admin CMS store modularization closeout

**Alias:** Stage 6 (roadmap row in architecture docs)  
**Status:** Complete (admin store slices committed)  
**Date:** 2026-08-08  
**Stop line:** R7 / Stage 7 not started (storefront composition cleanup out of scope)

## Scope delivered

Split `apps/admin/src/lib/cms/store.ts` (~1.8k lines) into capability modules behind a stable façade. No registry, storefront store, content, Aanvragen, or visual redesign.

Preserved uncommitted hydrate / `useEditablePage` fixes that were already on the mono-store when the split was applied (updatedAt reconcile, chrome equality guards, memoized editable page).

## Module map

| Slice | Module | Approx. lines | Owns |
|------:|--------|--------------:|------|
| 1 | `store-persistence.ts` | ~377 | `KEY` / `EVENT`, seed builtins, `load` / `read` / `write` / `persistable`, nav hydrate sanitize, session preview maps |
| 2 helpers | `store-draft.ts` | ~71 | `editablePage`, `commitDraftPage`, `applyLayoutResult`, `uid`, nav-cap page list |
| 2 mutations | `store-layout.ts` | ~572 | Layout ops, builtin migrations, section/override drafts, `reset`, `discardDraft` |
| 3 | `store-publish.ts` | ~544 | Nav/footer draft+save, `savePage` / `saveConcept`, `deletePage`, server reconcile |
| 4 | `store-en.ts` | ~270 | `setEnFieldDrafts`, `translateMissingEnFields`, coverage, `preparePageEnForOpslaan` |
| façade | `store.ts` | ~123 | `export const cms`, hooks (`useCms`, `useEditablePage`, …), preview snapshot API |

Existing collaborators unchanged: `server-publish.ts`, `publish-sync.ts`, `@mccoy/cms-schema` helpers (`decideOpslaanPublishedLocales`, `planEnFieldDraftSync`, …).

## API compatibility

Public imports from `@/lib/cms/store` unchanged:

- `cms` (same method names / signatures)
- `useCms`, `useEditablePage`, `usePreviewStatus`, `useSiteNavigation`, `useSiteFooter`
- `PagePreviewStatus`

Call sites were not rewritten. `RegisteredBlockView` / block registries untouched. Admin and storefront stores remain separate; shared contracts stay in `@mccoy/cms-schema`.

## Behaviour freeze (verified by structure + checks)

- Draft / dirty / Opslaan / EN locale decision path still: validate → `preparePageEnForOpslaan` → `decideOpslaanPublishedLocales` → `publishSavedPageToServer` → local draft clear + chrome push
- Nav/footer durable-first publish + `pushPublishedChromeToStorefront` preserved
- Seed builtins + localStorage self-heal on hydrate preserved
- Session preview snapshots still non-persisted
- Server hydrate compares pages by `updatedAt` (not object identity after `JSON.parse`)
- Durable nav/footer hydrate skips no-op writes when JSON-equal
- `useEditablePage` memoizes on version/draft/pages to avoid update-depth loops

## Command results

| Command | Exit | Notes |
|---------|-----:|-------|
| `npm run typecheck -w @mccoy/admin` | **0** | |
| `npm run test -w @mccoy/admin` | **0** | 16 files / 84 tests |
| `npm run build -w @mccoy/admin` | **0** | client + SSR |

## Explicit out of scope / remaining gaps

1. **R7 / Stage 7** — storefront composition cleanup (`SitePageSections`, home sections) not started.
2. **Storefront CMS store** — not modularised; share only via schema if that store is later split.
3. No new admin unit tests specifically for store modules (behaviour covered indirectly). Optional follow-up: thin façade smoke test.
4. Locale E2E `savePage` / `"Opgeslagen"` fixture flake remains tracked separately; not introduced by this structural extract.

## Ready for R7?

**Yes**, from an admin-store perspective: R6 admin modularization is complete, APIs stable, checks green. R7 (storefront composition) may proceed when prioritised; do not mix storefront composition cleanup into this store split.
