# Frontend component audit — Stage 1

**Date:** 2026-08-06  
**Scope:** Documentation only. No production code moved or refactored.  
**Companion:** [frontend-component-architecture.md](./frontend-component-architecture.md)

This audit inventories frontend hotspots, protected invariants, duplication, and a precise Stage 2 slice. Outcome gates are responsibility-, parity-, and regression-based — not line-count reduction.

---

## Baseline (2026-08-06)

Commands run from repo root (`C:\Users\Ra\Desktop\mccoy_code`). Exact exit codes recorded.

| Command | Exit | Result |
|---------|-----:|--------|
| `npm run typecheck` | **0** | Pass. All workspaces: domain, validation, cms-schema, cms-renderer, cms-editor, content-ai, security, notifications, database, email, ui, storefront, admin. |
| `npm run lint` | **0** | Pass. Note: root `lint` currently aliases `typecheck -w @mccoy/cms-renderer` (not ESLint across apps). |
| `npm run test:contract` | **0** | Pass. `@mccoy/cms-schema` vitest: **52** files, **510** tests. |
| `npm run test:ci` | **0** | Pass. `@mccoy/cms-renderer` vitest: **11** files, **113** tests. |
| `npm run build -w @mccoy/admin` | **0** | Pass. Client + SSR Vite builds succeeded (large-chunk warnings only). |
| `npm run build -w @mccoy/storefront` | **0** | Pass. Client + SSR Vite builds succeeded (large-chunk warnings; dynamic/static import note on `cms-published.functions.ts`). |

### Targeted typechecks

Full `npm run typecheck` already covered these; no separate failures:

- `@mccoy/cms-schema`, `@mccoy/cms-renderer`, `@mccoy/cms-editor`, `@mccoy/admin`, `@mccoy/storefront` — all green as part of the root chain.

### E2E

**Not run** in this Stage 1 pass (long-running / env-dependent). Known scripts from root `package.json`:

| Script | Target |
|--------|--------|
| `test:e2e` | Playwright chromium (full project) |
| `test:e2e:smoke` | `e2e/smoke.p0.spec.ts` |
| `test:e2e:forms` | `e2e/forms-aanvragen.spec.ts` |
| `test:e2e:locale` | locale publish + public locale |
| `test:e2e:coverage` | CMS field / add-sections coverage |
| `test:e2e:quality` | a11y / responsive / resilience / security |
| `test:e2e:ci` / `test:e2e:fuller` | CI-oriented reporters / filters |
| `test:e2e:brave` | Brave smoke project |

Existing E2E inventory and known gaps: [docs/testing/application-e2e-matrix.md](../testing/application-e2e-matrix.md) (2026-07-24). Notably: inquiries full E2E gated on deterministic inbox adapter; MFA/invite marked manual/external; admin products/users excluded as stubs.

### Baseline notes

- Root `lint` is a thin typecheck alias — do not treat exit 0 as app-wide ESLint coverage.
- Builds emit Rollup “chunk > 500 kB” warnings for main bundles; not treated as failures.
- `.cursor/skills/` is **absent** today. Guardian CLI scripts exist in `package.json` (`guardian:doctor|verify|inventory|smoke`). Stage 7 skills belong under `.cursor/skills/` when created (not in Stage 1–2).

---

## Hotspots — responsibility / import / dependency maps

Line counts are **non-blank/comment-inclusive physical lines** measured 2026-08-06 (`Measure-Object -Line`). Prior estimates are noted where they differ.

Disposition values: `split-required | extract-helpers | extract-feature | registry-decomposition | large-but-cohesive | leave-unchanged`.

### 1. `packages/cms-editor/src/index.tsx` (**97** lines after Stage 4; was ~3102)

| | |
|--|--|
| **Primary responsibility** | Thin public barrel: re-exports only (block editors, AI assist, inspectors, image helpers, selection APIs). |
| **Bodies live in** | `EditInteractionGuard.tsx`, `SectionSelectFrame.tsx`, `selection.ts`, `PrototypeImageField.tsx`, `CardListEditor.tsx`, `inspector-chrome.tsx`, `list-helpers.tsx`, `inspectors/*`. |
| **Who imports it** | Admin CMS: `AdminCmsContentAiProvider`, `PageEditor`, `BuiltinLayoutEditor` (selected exports), and any admin path that pulls `@mccoy/cms-editor`. Storefront must **not** import this package (enforced by cms-schema contract tests). |
| **Disposition** | `split-required` — **done in Stage 4** |
| **Why** | Mixes public package API, fixed-section editors, and low-level field chrome in one file. Block editors already live under `./blocks/`; remaining inspectors and helpers should follow that pattern so the barrel only re-exports. |

### 2. `apps/admin/src/lib/cms/store.ts` (~1534; prior est. ~1600)

| | |
|--|--|
| **Primary responsibility** | Admin CMS client store: localStorage persistence, draft dirty tracking, layout mutations, EN draft sync / Opslaan locale decisions, publish/save/delete server calls, preview snapshot session maps. |
| **Imports** | Heavy `@mccoy/cms-schema` pipeline/layout/i18n APIs; `./server-publish`, `./publish-sync`, `./templates`, `@/lib/api/cms-publish.functions`, `@/lib/api/content-ai.functions`. |
| **Who imports it** | Admin website routes and CMS components (`admin.website.$pageId`, layout editors, locale panels, etc.). |
| **Disposition** | `extract-helpers` (later: `split-required` for persistence vs mutation vs publish) |
| **Why** | Cohesive domain store, but persistence, layout ops, translation planning, and server publish are separable modules with clear seams. Not Stage 2. |

### 3. `apps/admin/src/routes/admin.inquiries.tsx` (**6** lines after Stage 3; was ~1457)

| | |
|--|--|
| **Primary responsibility** | Thin TanStack route: `validateSearch` + `InquiriesPage` composition. |
| **Feature ownership** | `apps/admin/src/features/inquiries/` (components, hooks, lib, types, tests). |
| **Disposition** | `extract-feature` — **done in Stage 3** |

### 4. `apps/admin/src/routes/admin.settings.tsx` (~1199; prior est. ~1257)

| | |
|--|--|
| **Primary responsibility** | Staff settings surface (auth modes, mailbox/SMTP/Graph config, related preferences). |
| **Imports** | Admin bits, staff settings functions, forms with mixed input class patterns. |
| **Who imports it** | Router only. |
| **Disposition** | `extract-feature` |
| **Why** | Multi-panel settings route; good FormField token consumer after Stage 2 primitives land. Keep mailbox semantics admin-local. |

### 5. `packages/cms-renderer/src/blocks/RegisteredBlockView.tsx` (~1300)

| | |
|--|--|
| **Primary responsibility** | Default block renderer switch + shared section chrome; registers popup view; prefers `blockViewRegistry` dedicated views. |
| **Imports** | `@mccoy/cms-schema`, sibling views (`ConversionSectionViews`, galleries, `CmsButtonView`), `SectionShell` / section layout tokens. Local `cn` duplicate (not `@mccoy/ui`). |
| **Who imports it** | Package export; storefront `BlockView.tsx`; admin preview path via same renderer; tests. |
| **Disposition** | `registry-decomposition` |
| **Why** | Pattern already started (`jobs` / `offers` / `steps` in `blockViewRegistry`). Remaining switch arms should migrate to dedicated views incrementally to preserve preview/storefront parity. |

### 6. `packages/cms-schema/src/blocks/catalog.ts` (~1395)

| | |
|--|--|
| **Primary responsibility** | Block data definitions, defaults, normalizers, publish validators wiring for many block types; form field defaults. |
| **Imports** | Zod, content/link helpers, specialized defs (`plans`, `roadmap`, `jobs`, `offers`, `new-sections`, `form-fields`). |
| **Who imports it** | Schema barrel → editor, renderer, admin/storefront stores, database CMS layer, tests. |
| **Disposition** | `registry-decomposition` |
| **Why** | Already partially split (`plans.ts`, `jobs.ts`, …). Remaining catalog entries should continue per-block files; do not “share UI” from here. |

### 7. `apps/admin/src/routes/admin.website.$pageId.tsx` (~954; prior est. ~1012)

| | |
|--|--|
| **Primary responsibility** | Per-page CMS editor shell: load page, toolbar, preview iframe, publish/save, meta fields. |
| **Imports** | `@mccoy/cms-schema`, admin CMS store/components, editor package pieces. |
| **Who imports it** | Router only. |
| **Disposition** | `extract-helpers` |
| **Why** | Route orchestration is appropriate; extract toolbar/status panels when touching publish UX — not Stage 2 default. |

### 8. `apps/admin/src/components/admin/cms/BuiltinLayoutEditor.tsx` (~672; prior est. ~704)

| | |
|--|--|
| **Primary responsibility** | Builtin page layout list + section selection; bridges to cms-editor inspectors. |
| **Imports** | `@mccoy/cms-schema`, `@mccoy/cms-editor` (`ContentAlignControl`, `SelectedSectionInspector`), `@mccoy/ui` (`LayoutList`). |
| **Who imports it** | Website page editor path. |
| **Disposition** | `large-but-cohesive` |
| **Why** | Focused layout UX; already uses shared `LayoutList`. Leave unless layout API changes. |

### 9. `apps/storefront/src/components/site/sections/SitePageSections.tsx` (~622)

| | |
|--|--|
| **Primary responsibility** | Storefront page section composition for non-home pages; resolves CMS text fallbacks and renderer sections. |
| **Imports** | `@mccoy/cms-schema` (`cmsTextOrFallback`, …), `@mccoy/cms-renderer`, local section components. |
| **Who imports it** | Storefront page layout / route render path. |
| **Disposition** | `large-but-cohesive` |
| **Why** | Storefront-branded composition; must not merge with admin chrome. Parity depends on shared renderer, not shared page shell. |

### 10. `packages/cms-editor/src/ai-assist.tsx` (~855)

| | |
|--|--|
| **Primary responsibility** | CMS AI assist context, `InspectTextField`, NL→EN translate/apply UI, batch overwrite confirms. |
| **Imports** | `@mccoy/cms-schema` (paragraph sync), `@mccoy/ui` (`cn`). |
| **Who imports it** | Re-exported from cms-editor barrel; admin `AdminCmsContentAiProvider` / `PageEditor`; `en-draft-fields`. |
| **Disposition** | `extract-helpers` + Stage 2 confirm injection |
| **Why** | Three `window.confirm` sites (lines ~252, ~493, ~531) break accessible confirm pattern used in admin. Package cannot import admin dialogs — confirm must be injected (API callback) or use a package-safe confirm bridge. |

### 11. `apps/storefront/src/lib/cms/store.ts` (~985)

| | |
|--|--|
| **Primary responsibility** | Storefront CMS client/edit-mode store (preview sync, local draft helpers for iframe edit stack). |
| **Imports** | `@mccoy/cms-schema` (+ templates sibling). Parallel to admin store but public-surface constrained. |
| **Who imports it** | Storefront CMS edit/preview providers. |
| **Disposition** | `leave-unchanged` (near term) / later `extract-helpers` |
| **Why** | Do not merge with admin store. Shared logic already lives in `@mccoy/cms-schema`. Duplicating UI primitives across stores is out of scope. |

### 12. Aggregate editors / views

| Path | ~Lines | Responsibility | Imports / importers | Disposition |
|------|-------:|----------------|---------------------|-------------|
| `packages/cms-editor/src/blocks/StructureBlockEditors.tsx` | 552 | Columns, steps, timeline, values, portfolio, etc. editors | schema; registered via `blockEditorRegistry` | `registry-decomposition` |
| `packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx` | 408 | Newer section editors (stats, partners, legal, quote form, …) | schema; `blockEditorRegistry` | `registry-decomposition` |
| `packages/cms-renderer/src/blocks/ConversionSectionViews.tsx` | 484 | Contact form / newsletter / popup section views | schema form-fields; used by `RegisteredBlockView` | `extract-feature` (per view file) when touching forms |

### Adjacent large files (context, not Stage 2)

| Path | ~Lines | Note |
|------|-------:|------|
| `apps/storefront/src/lib/i18n.tsx` | ~614 | Storefront locale UI (not `i18n.ts`). Leave branded. |
| Staff identity | split across `staff-identity.functions.ts`, MFA/invite routes, `StaffAuthenticatorReplacePanel.tsx` | Prior “staff-identity ~1219” route file not present as single route; do not invent a mega-file split. MFA stays admin-only. |
| `packages/ui` | Button, `cn`, LayoutList only | 46 shadcn files duplicated under each app’s `components/ui`. |

---

## Protected-invariants register

| Invariant | Description | Enforced today | How to verify | Must not break |
|-----------|-------------|----------------|---------------|----------------|
| **pageKey** | Builtin pages keyed (`home`, `products`, …); layout defaults and locks depend on `pageKey`. | `@mccoy/cms-schema` types, `layout.ts`, migrate/normalize; admin/storefront templates | Contract tests (`layout`, `content`, migrate); open each builtin page in admin + storefront | Changing keys or default fixed sections without migration |
| **CMS layout versions** | `CMS_SCHEMA_VERSION` (currently 6); migrate-on-load before edit/publish | `migrate.ts` / `pipeline.ts`; admin store `migrateAndValidate` | `migration/*.test.ts`, publish path with older fixtures | Skipping migrate; rewriting published JSON in place without version bump |
| **Deterministic block IDs** | Item/block ids via `createItemId`; jobs clone regenerates ids intentionally | `ids.ts`, catalog normalizers, `cloneJobsDataWithNewIds` | registry/jobs tests; reorder/duplicate in editor | Random ids on every normalize; using migration UUIDs as form identity |
| **NL/EN field paths + fallback** | Canonical EN draft paths; NL source of truth; `cmsTextOrFallback` for display. A missing, null, empty, or whitespace-only English value **without** explicit `intentional_blank` metadata is **unresolved/missing**: it may temporarily resolve through the existing Dutch fallback, remains eligible for field-level translation, and must **not** count as a completed English translation. Only explicit `intentional_blank` metadata may suppress the fallback and render the visible English field blank. | `en-field-drafts`, `en-field-sync`, `cms-text-fallback`; AI assist path keys | `en-field-*.test.ts`, `cms-text-fallback.test.ts`, locale E2E scripts | Overlaying structural/enum leaves with EN; treating empty/whitespace EN as a completed translation; suppressing Dutch fallback without `intentional_blank` |
| **Form source aliases** | Canonical keys (`builtin:contact:primary`, …) + legacy alias map | `form-source.ts` + domain `FIXED_FORM_SOURCE_IDS` | `resolve-published-form` / collect form scopes tests; submit contact/offerte/vacatures | Binding inbox identity to layout block UUID alone |
| **Publish validation** | `validatePublishableCmsPage` before server publish | schema pipeline; admin store + `cms-publish.functions` | `blocks/validate.test.ts`, `draft-gate`, `atomic-publish`; attempt invalid publish in UI | Client-only validation; publishing without server re-check |
| **Preview / storefront parity** | Same `@mccoy/cms-renderer` block views for preview iframe and public site | `RegisteredBlockView` + registry; preview snapshots in admin store | Visual/smoke renderer tests; compare admin preview vs published page | Forking markup in admin-only views for publishable blocks |
| **Auth / RLS boundaries** | Admin privileged; storefront public; service role server-only; staff MFA | App hosts (`docs/apps-and-hosts.md`), server functions, Supabase RLS | Security browser E2E; attempt cross-host admin routes; RLS tests where present | Sharing admin session helpers with storefront; disabling RLS |
| **Aanvragen behaviour** | Website forms → structured requests + email; inbox list/reply/delete; guest not company-linked by email alone | storefront `forms.functions`; admin `admin.inquiries` + request APIs | `test:e2e:forms`; manual Graph/IMAP config paths | Soft-deleting required audit; associating guest by email guess |
| **Public routes** | Storefront host serves public pages; `/admin*` redirected to admin host | Host middleware / app split | Hit public routes on www; confirm admin redirect | Merging admin chrome into storefront shell |

---

## Duplication matrix + recommended shared components

### Current duplication snapshot

| Area | Today | Problem |
|------|-------|---------|
| Async UX (admin) | Inline Loader2 + prose in inquiries (and similar elsewhere) | Inconsistent empty/error/loading a11y |
| Confirmations | `ConfirmationDialog` + `appConfirm` bridge **and** `window.confirm` in cms-editor AI | Inaccessible / inconsistent overwrite confirms |
| Form inputs (admin) | `.a-input` / `.a-label` in `styles.css`; duplicated raw `className` strings in dialogs & cms-editor `inputClass` | Drift; hard to theme consistently |
| Page chrome | `PageHeader` in `AdminBits.tsx` | Exists; no matching Empty/Error |
| `@mccoy/ui` vs apps | Only `Button`, `cn`, `LayoutList` shared; **46** shadcn files each in admin & storefront | Expected for branded apps; do not blindly unify |
| CMS stores | Admin + storefront parallel stores | Shared rules in schema — correct; do not merge stores |

### Recommended shared components (Stage 2 focus = admin-local unless noted)

#### 1. `EmptyState`

```ts
type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
};
```

| | |
|--|--|
| **Ownership** | `apps/admin` (`components/admin/EmptyState.tsx`) — **not** `@mccoy/ui` yet |
| **Call sites** | `admin.inquiries.tsx` empty list (~“Geen berichten gevonden”); later settings / website empty lists |
| **Constraints** | Admin dark glass chrome; Dutch copy owned by callers; no storefront import |
| **Tests** | RTL: renders title/description; optional action focusable; `role` appropriate (region/status) |

#### 2. `ErrorState`

```ts
type ErrorStateProps = {
  title?: string;
  message: string;
  code?: string; // e.g. inquiries "config"
  onRetry?: () => void;
  retryLabel?: string;
  children?: React.ReactNode; // config help blocks
  className?: string;
};
```

| | |
|--|--|
| **Ownership** | `apps/admin` |
| **Call sites** | `admin.inquiries.tsx` list/detail error branches (config vs generic) |
| **Constraints** | Must support rich config guidance (code snippets) via `children`; `role="alert"` |
| **Tests** | alert role; retry invokes callback; config child content preserved |

#### 3. `InlineLoader`

```ts
type InlineLoaderProps = {
  label: string; // visible + accessible name
  className?: string;
};
```

| | |
|--|--|
| **Ownership** | `apps/admin` |
| **Call sites** | inquiries list/detail loading; other admin pending panels |
| **Constraints** | Prefer visible text (not spinner-only); respect reduced motion via existing CSS |
| **Tests** | accessible name includes label |

#### 4. Unified confirmation path

```ts
type CmsConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "default" | "warning" | "destructive";
};
```

| | |
|--|--|
| **API** | Prefer `appConfirm` / `ConfirmationDialog` (already in `AppDialogProvider`). Extend `CmsAiAssistApi` with `confirmOverwrite: (request: CmsConfirmationRequest) => Promise<boolean>` so cms-editor never calls `window.confirm` or imports admin. Prefer making `confirmOverwrite` **required** on the API type when the assist API is provided; if it is missing at runtime, overwrite flows that need confirmation must **fail closed** (return `false` / abort). |
| **Ownership** | Dialogs stay admin; **confirm port** on cms-editor API; admin provider wires `appConfirm` |
| **Call sites** | `ai-assist.tsx` ×3; inquiries already on `ConfirmationDialog` |
| **Constraints** | cms-editor must not depend on `apps/admin`. **Fail closed:** missing provider support → `false`; provider errors → `false`; Escape → `false`; cancellation → `false`; preserve existing CMS content; **never** fall back to `window.confirm`. |
| **Tests** | Unit: AI apply aborted when confirm false / missing / throws; apply proceeds when confirm true; admin provider maps request → `appConfirm` |

#### 5. `FormField` / input class token (admin)

```ts
type AdminFormFieldProps = {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode; // control slotted
};
// Token: reuse `.a-input` / `.a-label` / `.a-hint` from styles.css; export `adminInputClassName` constant for TS call sites that cannot use the CSS class alone.
```

| | |
|--|--|
| **Ownership** | `apps/admin` (wrap existing tokens; do not invent a second visual language) |
| **Call sites** | settings forms; `ConfirmationDialog`/`FormDialog` raw inputs; CMS meta inputs gradually |
| **Constraints** | Keep `.a-input` as source of truth; cms-editor keeps its own `inputClass` unless a **neutral** token later moves to `@mccoy/ui` |
| **Tests** | label association (`htmlFor`/`id`); error announced |

`PageHeader` — **already exists**; leave API stable; do not relocate in Stage 2.

---

## Formal “do not share” matrix

| Surface A | Surface B | Why not share |
|-----------|-----------|---------------|
| Storefront chrome (Navbar, Footer, section rails) | Admin shell / `PageHeader` / `a-btn` | Differently branded; different hosts |
| Admin MFA / invite / recover-mfa | Storefront auth (if any) | Staff-only; MFA required for admin |
| Aanvragen mailbox semantics | Generic “inbox” UI kits / storefront contact success | Graph/IMAP/config errors; delete/reply policies |
| Admin products/users mock pages | Real commerce admin (future) | Explicitly excluded stubs — do not “polish into shared catalog” |
| Offer / plan section brand chrome (`OffersSectionView`, plan cards) | Admin buttons / dialogs | Customer-facing marketing layout |
| Storefront `SitePageSections` / home sections | Admin `BuiltinLayoutEditor` | Authoring vs rendering |
| Admin CMS store | Storefront CMS store | Different persistence and privilege; share schema only |
| App-local shadcn `components/ui` | Blind move to `@mccoy/ui` | Themes diverge; share only proven primitives (`cn`, Button, LayoutList pattern) |
| `window.confirm` | Accessible admin dialogs | Temporary debt — replace via injection, not by copying AlertDialog into schema |

---

## Measurable outcome gates

Gates are **pass/fail behaviors**, not LOC deltas.

| Gate | Metric |
|------|--------|
| **Responsibility** | Stage 2 components have a single owner package/app; cms-editor gains no admin import. |
| **Parity** | Renderer smoke tests (`RegisteredBlockView.smoke`) and schema contract suite still pass; no fork of publishable block markup in admin. |
| **Reuse** | Inquiries list loading/empty/error use shared admin primitives; AI overwrite confirms no longer call `window.confirm`. |
| **Dependency direction** | `storefront ↛ cms-editor`; `cms-editor → cms-schema/cms-renderer/ui` only; admin may compose cms-editor. |
| **Regression safety** | Baseline commands (typecheck, test:contract, test:ci, admin+storefront build) remain exit 0; inquiries confirm/delete still use `ConfirmationDialog`. |
| **Accessibility** | Empty/error/loading expose accessible names; confirms are keyboard-operable dialogs (or injected equivalent). |
| **Invariant safety** | No changes to form-source aliases, publish validators, or EN path canonicalization in Stage 2. |

---

## Precise Stage 2 slice recommendation

**Default Stage 2 (confirmed by inspection):** Admin async UX + dialogs consolidation.

### Exact files to touch

| Action | File |
|--------|------|
| Add | `apps/admin/src/components/admin/EmptyState.tsx` |
| Add | `apps/admin/src/components/admin/ErrorState.tsx` |
| Add | `apps/admin/src/components/admin/InlineLoader.tsx` |
| Add | `apps/admin/src/components/admin/AdminFormField.tsx` (thin label/hint/error wrapper over `.a-input` tokens) |
| Edit | `apps/admin/src/routes/admin.inquiries.tsx` — replace inline loading/empty/error blocks |
| Edit | `packages/cms-editor/src/ai-assist.tsx` — remove 3× `window.confirm`; call injected confirm |
| Edit | `packages/cms-editor` AI API types (`CmsAiAssistApi`) — `confirmOverwrite: (request: CmsConfirmationRequest) => Promise<boolean>` (required when API is provided; fail closed if missing at runtime) |
| Edit | `apps/admin/src/components/admin/cms/AdminCmsContentAiProvider.tsx` — wire `appConfirm` / `ConfirmationDialog` |
| Optionally edit | `apps/admin/src/components/admin/ConfirmationDialog.tsx` / `AppDialog.tsx` — use `.a-input` / `AdminFormField` for typed-confirm + form dialog inputs |
| Leave unchanged | `AdminBits.PageHeader`, stores, registries, renderer catalog |

### Proposed components

1. `EmptyState`, `ErrorState`, `InlineLoader` (admin)
2. Confirm injection on `CmsAiAssistApi` + provider wiring
3. `AdminFormField` + document `.a-input` as the admin input token

### Migration sequence

1. Add admin primitives + unit/RTL tests.
2. Migrate `admin.inquiries.tsx` list/detail async UX (highest visibility duplication).
3. Extend `CmsAiAssistApi` with structured `confirmOverwrite(CmsConfirmationRequest)`; implement in `AdminCmsContentAiProvider` via `appConfirm` (fail closed on error/missing; never `window.confirm`).
4. Replace `window.confirm` in `ai-assist.tsx` with Dutch structured confirmation requests; add unit tests for cancel/confirm/missing.
5. Align dialog inputs with `.a-input` / `AdminFormField`.
6. Re-run baseline: typecheck, test:contract, test:ci, admin build; smoke CMS EN overwrite + inquiries delete confirms manually or via existing E2E when env allows.

### Tests

- New admin component tests (Empty/Error/Loader/FormField).
- cms-editor AI assist confirm cancel/apply tests (mock API).
- Existing inquiries behaviour: delete confirm still destructive tone.
- No schema/renderer contract regressions.

### Affected invariants

| Invariant | Stage 2 impact |
|-----------|----------------|
| NL/EN paths | None if confirm only gates overwrite |
| Aanvragen | UX-only; mailbox APIs untouched |
| Preview parity | None |
| Auth/RLS | None |
| Publish validation | None |

### Regression risks

- Missing `confirmOverwrite` / provider error / Escape / cancel → AI overwrite **fail closed** (abort, preserve content); never fall back to `window.confirm`. Test confirm true, false, missing, and thrown error.
- Empty/error visual regression on inquiries config help (preserve `children` slot).
- Accidental `@mccoy/ui` or storefront coupling.

### Rollback plan

1. Revert the Stage 2 PR / commits as a unit (primitives + inquiries + AI confirm wiring).
2. No migrations or persisted schema changes → no DB rollback.
3. If partially merged: restore `window.confirm` only as emergency hotfix (document debt) while keeping admin Empty/Error if stable.

### Out of scope for Stage 2

- Splitting `cms-editor/src/index.tsx`, stores, `RegisteredBlockView`, `catalog.ts`
- Moving shadcn into `@mccoy/ui`
- Storefront visual refactors
- Creating `.cursor/skills` or review agents (Stage 7)

---

## Stage 2 summary (quick reference)

Admin-local `EmptyState` / `ErrorState` / `InlineLoader` + `AdminFormField` (`.a-input` token); migrate `admin.inquiries.tsx` async UX; remove `window.confirm` from `packages/cms-editor/src/ai-assist.tsx` via structured `CmsAiAssistApi.confirmOverwrite(CmsConfirmationRequest)` wired through `AdminCmsContentAiProvider` → `appConfirm` / `ConfirmationDialog` (fail closed; never `window.confirm`).

---

## Stage 2 closeout (complete — approved 2026-08-06)

**Status:** Complete and approved. Do not reopen Stage 2 scope.

### Exact files changed (Stage 2 + related EN whitespace fix)

| Action | Path |
|--------|------|
| Add | `apps/admin/src/components/admin/EmptyState.tsx` |
| Add | `apps/admin/src/components/admin/ErrorState.tsx` |
| Add | `apps/admin/src/components/admin/InlineLoader.tsx` |
| Add | `apps/admin/src/components/admin/AdminFormField.tsx` |
| Add | `apps/admin/src/components/admin/admin-async-ux.test.tsx` |
| Add | `apps/admin/vitest.config.ts` |
| Edit | `apps/admin/package.json` (+ vitest/jsdom; `test` script) |
| Edit | `package-lock.json` |
| Edit | `apps/admin/src/routes/admin.inquiries.tsx` — Empty/Error/InlineLoader async UX |
| Edit | `apps/admin/src/components/admin/ConfirmationDialog.tsx` / `AppDialog.tsx` — `.a-input` / AdminFormField alignment |
| Edit | `apps/admin/src/components/admin/cms/AdminCmsContentAiProvider.tsx` — `confirmOverwrite` → `appConfirm` |
| Edit | `packages/cms-editor/src/ai-assist.tsx` — remove all AI `window.confirm`; structured `CmsConfirmationRequest` |
| Edit | `packages/cms-editor/src/index.tsx` — export confirmation types/API |
| Add | `packages/cms-editor/src/ai-assist.confirm.test.tsx` |
| Edit | `packages/cms-editor/src/blocks/en-draft-fields.test.tsx` |
| Edit | `packages/cms-schema/src/translation-field.ts` — EN draft editor patch stores **raw** value; trim only for blank classification |
| Edit | `packages/cms-schema/src/translation-field.test.ts` — trailing-space regression test |
| Edit | `docs/refactoring/frontend-component-audit.md` / `frontend-component-architecture.md` |

### Command results (Stage 2 verification)

| Command | Exit | Result |
|---------|-----:|--------|
| `npm run typecheck` | **0** | Pass |
| `npm run lint` | **0** | Pass (root lint alias) |
| `npm run test:contract` | **0** | 52 files / **510** tests |
| `npm run test:ci` | **0** | 11 files / **113** tests |
| `npm run test -w @mccoy/cms-editor` | **0** | 11 files / **55** tests (incl. confirm suite) |
| `npm run test -w @mccoy/admin` | **0** | async UX component tests |
| `npm run build -w @mccoy/admin` | **0** | Pass |
| `npm run build -w @mccoy/storefront` | **0** | Pass |
| `npm run test:e2e:forms` | **1*** | Playwright Chromium missing in that environment (*env-limited; not a product regression) |

### Confirmations — cms-editor AI

- **Removed:** all three `window.confirm` call sites in `packages/cms-editor/src/ai-assist.tsx` (field EN apply, section generate apply, batch translate apply).
- **API:** `CmsConfirmationRequest` + required `confirmOverwrite` on `CmsAiAssistApi`; fail-closed helper when missing/throws/`false`.
- **Wiring:** `AdminCmsContentAiProvider` maps to `appConfirm` (never native dialog).
- **Tests:** `packages/cms-editor/src/ai-assist.confirm.test.tsx` — cancel preserves content; confirm applies; missing confirmOverwrite fails closed; no `window.confirm`.

### EN draft whitespace regression

- **Bug:** `applyEnFieldDraftEditorPatch` stored `value.trim()`, so trailing Space while typing was dropped (`team` + space + `of` → `teamof`).
- **Fix:** preserve **raw** editor value when non-blank; use `trim()` **only** to classify blank/unresolved (and for NL source pinning).
- **Test:** `translation-field.test.ts` — “preserves trailing spaces while typing…”.

### Manual checks still outstanding after Stage 2

1. CMS AI overwrite confirm UX (field / section / batch) with existing EN draft — Annuleren preserves; Overschrijven applies (no deterministic E2E route).
2. `npm run test:e2e:forms` when Playwright Chromium is installed.
3. Aanvragen delete/bulk-delete destructive confirms still feel correct after Stage 3 extraction (behaviour unchanged; smoke after move).

### Roadmap after Stage 2

| Stage | Theme |
|------:|-------|
| **3** | **Complete** — Aanvragen feature extraction (`apps/admin/src/features/inquiries/`) — thin route |
| **4** | **Complete** — cms-editor barrel / inspector split — thin re-export barrel |
| **5+** | Registry / store / storefront / skills / optional `@mccoy/ui` promotion (see architecture doc) |

---

## Stage 4 closeout (complete — 2026-08-06)

**Status:** Complete. `packages/cms-editor/src/index.tsx` collapsed to a thin re-export barrel; fixed-section inspectors, image/link fields, selection APIs, and inspector chrome live in sibling modules.

**Checkpoint commit (structural):** `9c7bb0470bc7d4e73bd9b5e817ead77e6b729c48` — *Extract cms-editor fixed inspectors into sibling modules (Stage 4 structural).*

**Closeout docs commit:** `32e0a6355645d8c26b1e93ddf63d98a1f6cce9d2` — *Document Stage 4 closeout and locale E2E savePage follow-up.*

### Locale E2E (`test:e2e:locale`) classification

| Item | Value |
|------|-------|
| **Primary classification** | **Fixture defect** — `savePage` asserts ephemeral `"Opgeslagen"` toast |
| **Secondary** | Race / eventual consistency (toast can dismiss before poll matches) |
| **Not** | Stage 4 product regression (no toast/save logic in structural commit) |
| Run1 | `.data/locale-e2e-run1.log` — 4 passed / 1 failed (`cms-locale-en-publish` → `savePage` @ `e2e/helpers/cms.ts` ~332) |
| Run2 | `.data/locale-e2e-run2.log` — **4 passed / 1 failed** (identical `savePage` timeout; Live + disabled publish buttons in snapshot) |
| Snapshot evidence | Badge **Live**; **"Opslaan & publiceren" disabled**; **"Verwerpen" disabled** (published toolbar) while toast poll timed out |
| Tracked follow-up | [`docs/testing/locale-e2e-savepage-follow-up.md`](../testing/locale-e2e-savepage-follow-up.md) — **open**, not blocking Stage 5 |

### Localisation unit coverage matrix (deterministic)

| Requirement | Covered? | Primary evidence (file → describe / it) |
|-------------|:--------:|----------------------------------------|
| Stable NL/EN field paths | Yes | `packages/cms-schema/src/en-field-drafts.test.ts` → `enFieldDraftPath` / `builds and parses stable paths`; `en-field-sync.test.ts` → `collectTranslatableStringPaths`, `gallery / offers / steps path coverage`; `packages/cms-editor/src/blocks/en-draft-fields.test.tsx` → `blockEnPath` / `builds block field draft paths` |
| Raw EN value preservation | Yes | `translation-field.test.ts` → `preserves trailing spaces while typing…`; `typing EN after clear marks manually_translated and retains the draft`; `en-field-sync.test.ts` → `retains valid distinct EN and never auto-fills intentional_blank / manual` |
| Whitespace-only blank detection | Yes | `translation-field.test.ts` → `falls back to NL when EN is whitespace only`; `classifyTranslationField` / `treats EN identical to NL as blank/untranslated`; `translation-coverage.test.ts` → `treats blank draft as blank (not translated)` |
| Fallback eligibility | Yes | `translation-field.test.ts` → `resolveLocalizedField — blank EN must not suppress NL` (missing/null/empty/whitespace/intentional_blank/stale); `cms-text-fallback.test.ts` → `cmsTextOrFallback` suite; `localizeCmsPageForLocale — blank draft regression` |
| Manual EN preservation | Yes | `en-field-sync.test.ts` → `planEnFieldDraftSync` / `queues new NL, retains any existing EN (manual wins), prunes deleted`; `retains valid distinct EN…`; `translation-coverage.test.ts` → `selects missing/blank/override_removed and skips intentional_blank + manual` |
| Inspector callback / path parity | Yes | `packages/cms-editor/src/blocks/en-draft-fields.test.tsx` → `manual EN draft controls in editors` / `partners / stats / workGallery fixed inspectors expose EN`; Stage 4 edit kept inspector imports on sibling paths |

Honest gap: no single matrix test named “inspector callback/path parity” end-to-end across every fixed inspector; coverage is via `en-draft-fields` + Stage 4 barrel import paths, not a dedicated parity harness for all inspectors.

### Line counts

| Surface | Before | After |
|---------|-------:|------:|
| `packages/cms-editor/src/index.tsx` | **3102** | **97** |

### Files created

| Path | Responsibility |
|------|----------------|
| `EditInteractionGuard.tsx` | Edit/preview interaction capture guards |
| `SectionSelectFrame.tsx` | Fixed-section selection chrome |
| `selection.ts` | `CmsSelection` + `buildSectionMutation` |
| `PrototypeImageField.tsx` | Image picker + `TypedLinkField` |
| `CardListEditor.tsx` | Shared service/product card list editor |
| `inspector-chrome.tsx` | Fixed-inspector Field/input/select/button classes (kept local — styles differ from `blocks/field-chrome`) |
| `list-helpers.tsx` | `updateCardAt` / `removeById` / `RemoveIconButton` |
| `placeholder-image.ts` / `inspector-types.ts` | Shared placeholder + `ImagePickerProps` alias |
| `inspectors/*.tsx` | HomeHero, FormChrome, ContactInfo, ContactForm, AboutMain, ServicesMain, ProductsMain, ProductsInfo, Partners, Stats, WorkGallery, LegalMain, BlockDataInspector, SelectedSectionInspector |

### Tests

| Add / edit | Purpose |
|------------|---------|
| Add `src/stage4-barrel-split.test.ts` | Export compatibility, admin-boundary, barrel body-free, cycle heuristic, ai-assist ↛ inspectors |
| Edit `EditInteractionGuard.test.tsx` | Import from `./EditInteractionGuard` (not barrel) |
| Edit `blocks/en-draft-fields.test.tsx` | Import inspectors from sibling paths |

### Command results (Stage 4 verification)

| Command | Exit | Result |
|---------|-----:|--------|
| `npm run typecheck` | **0** | Pass (all workspaces incl. cms-editor, admin, storefront) |
| `npm run lint` | **0** | Pass (root lint alias → cms-renderer typecheck) |
| `npm run test:contract` | **0** | 52 files / **511** tests |
| `npm run test:ci` | **0** | 11 files / **113** tests |
| `npm run test -w @mccoy/cms-editor` | **0** | 12 files / **61** tests (incl. Stage 4 barrel suite) |
| `npm run test -w @mccoy/admin` | **0** | 10 files / **59** tests |
| `npm run build -w @mccoy/admin` | **0** | Pass |
| `npm run build -w @mccoy/storefront` | **0** | Pass |
| `npm run test:e2e:forms` | **0** | **4 passed** |
| `npm run test:e2e:locale` (run1) | **1** | **4 passed / 1 failed** — `cms-locale-en-publish` `savePage` timeout waiting for `"Opgeslagen"`; snapshot shows **Live** + publish/discard **disabled**. Classified fixture defect (+ race secondary). Log: `.data/locale-e2e-run1.log`. |
| `npm run test:e2e:locale` (run2) | **1** | **4 passed / 1 failed** — same `savePage` / `"Opgeslagen"` timeout; retry1 snapshot again **Live** + **"Opslaan & publiceren" [disabled]** + **"Verwerpen" [disabled]**. Log: `.data/locale-e2e-run2.log`. Confirms flaky fixture, not Stage 4 product regression. |
| `npm run test:e2e:coverage` | **0** | **8 passed** (after E2E helper `Zoek…` placeholder regex fix in `e2e/helpers/cms.ts`) |

### Preserved invariants

- Public `@mccoy/cms-editor` export names unchanged
- `storefront ↛ cms-editor`; `cms-editor ↛ apps/admin`; `renderer ↛ cms-editor`
- Internal modules use concrete sibling imports (never `./index` / `@mccoy/cms-editor`)
- ai-assist does not import inspectors
- No Aanvragen / RegisteredBlockView / blockViewRegistry / schema catalog / admin CMS store / storefront edits
- No behaviour or visual changes intended (mechanical move)

### Recommended Stage 5

Registry decomposition — continue extracting catalog / editor / view modules; shrink `RegisteredBlockView` switch.

### Stage 5 checkpoint — plans family

**Status:** First registry family complete (plans → `PlansSectionView`). Stage 5 overall remains **in progress**.

**Checkpoint commit:** *(filled after commit)* — *Extract plans block into registered PlansSectionView (Stage 5).*

| Item | Detail |
|------|--------|
| View extracted | `packages/cms-renderer/src/blocks/PlansSectionView.tsx` |
| Registry | `blockViewRegistry.plans` |
| Switch arm | `RegisteredBlockView` `case "plans"` → registry dispatch only |
| Parity tests | `PlansSectionView.test.tsx` (RegisteredBlockView markup ≡ direct view) |
| Public entry | Still `RegisteredBlockView` (admin + storefront `BlockView`) |
| Out of scope | Image-fill / object-cover restores; other registry families |

---

## Stage 3 closeout (complete — 2026-08-06)

**Status:** Complete. Aanvragen mailbox extracted into admin-owned feature modules; route is thin composition only.

### Behaviour freeze (manual acceptance 2026-08-06)

Aanvragen product behaviour is **frozen**. Stage 3 is structural only — no redesign of Graph, threading, deletion, loading, or persistence. Coverage index: `features/inquiries/tests/frozen-behaviour-coverage.test.ts`.

| Frozen behaviour | Primary regression evidence |
|------------------|----------------------------|
| Stable list loading | `features/inquiries/tests/hooks.test.tsx` |
| Stale-while-refresh | `hooks.test.tsx` + list UI states |
| Single / bulk deletion | `hooks.test.tsx`, `optimistic-delete.test.ts`, `@mccoy/email` `graph-bulk-delete.test.ts` |
| Partial deletion rollback | `hooks.test.tsx` (keep successful deletes) |
| Stale-response protection | tombstones in `optimistic-delete` + hook tests |
| One inquiry per conversation | `inquiry-thread-correlation.test.ts` (no subject-only merge) |
| Message timeline persistence | `sync-request-graph-thread.test.ts` |
| Graph/RFC thread correlation | `inquiry-thread-correlation.test.ts` |
| Repeated-sync idempotency | `sync-request-graph-thread.test.ts` |

### Files created / edited

| Action | Path |
|--------|------|
| Add | `apps/admin/src/features/inquiries/index.ts` |
| Add | `apps/admin/src/features/inquiries/types/search.ts` |
| Add | `apps/admin/src/features/inquiries/lib/format.ts` |
| Add | `apps/admin/src/features/inquiries/lib/filters.ts` |
| Add | `apps/admin/src/features/inquiries/lib/form-fields.ts` |
| Add | `apps/admin/src/features/inquiries/lib/pins.ts` (re-export) |
| Add | `apps/admin/src/features/inquiries/hooks/useInquiriesListQuery.ts` |
| Add | `apps/admin/src/features/inquiries/hooks/useInquiryDetailQuery.ts` |
| Add | `apps/admin/src/features/inquiries/hooks/useInquirySelection.ts` |
| Add | `apps/admin/src/features/inquiries/hooks/useInquiryListDeletes.ts` |
| Add | `apps/admin/src/features/inquiries/hooks/useInquiryReply.ts` |
| Add | `apps/admin/src/features/inquiries/hooks/useInquiryDetailDelete.ts` |
| Add | `apps/admin/src/features/inquiries/hooks/useInquiriesRealtimeRefresh.ts` |
| Add | `apps/admin/src/features/inquiries/lib/optimistic-delete.ts` |
| Add | `apps/admin/src/features/inquiries/components/InquiriesPage.tsx` |
| Add | `apps/admin/src/features/inquiries/components/InquiriesList.tsx` |
| Add | `apps/admin/src/features/inquiries/components/InboxDetail.tsx` |
| Add | `apps/admin/src/features/inquiries/components/InboxListSelectionToolbar.tsx` |
| Add | `apps/admin/src/features/inquiries/components/InquiryListDeleteDialogs.tsx` |
| Add | `apps/admin/src/features/inquiries/components/ConversationThread.tsx` |
| Add | `apps/admin/src/features/inquiries/components/AttachmentsBlock.tsx` |
| Add | `apps/admin/src/features/inquiries/components/FormFieldValue.tsx` |
| Add | `apps/admin/src/features/inquiries/components/MailboxConfigHelp.tsx` |
| Add | `apps/admin/src/features/inquiries/tests/format-filters.test.ts` |
| Add | `apps/admin/src/features/inquiries/tests/hooks.test.tsx` |
| Add | `apps/admin/src/features/inquiries/tests/InquiriesList.test.tsx` |
| Add | `apps/admin/src/features/inquiries/tests/optimistic-delete.test.ts` |
| Add | `apps/admin/src/features/inquiries/tests/realtime-refresh.test.tsx` |
| Add | `apps/admin/src/features/inquiries/tests/frozen-behaviour-coverage.test.ts` |
| Edit | `packages/email/src/sync-request-graph-thread.test.ts` — repeated-sync idempotency |
| Edit | `apps/admin/src/routes/admin.inquiries.tsx` — thin route (~6–8 lines) |
| Edit | `apps/admin/vitest.config.ts` (+ setupFiles) |
| Add | `apps/admin/vitest.setup.ts` |
| Edit | `docs/refactoring/frontend-component-audit.md` / `frontend-component-architecture.md` |

### Responsibilities moved

| Responsibility | From | To |
|----------------|------|-----|
| Search validation | route | `types/search.ts` |
| Kind filters / formatWhen / form-field helpers | route | `lib/*` |
| List load + refresh + badge mark-read | route | `hooks/useInquiriesListQuery` |
| Detail load + thread + unread clear | route | `hooks/useInquiryDetailQuery` |
| Multi-select | route | `hooks/useInquirySelection` |
| List single + bulk delete | route | `hooks/useInquiryListDeletes` + `InquiryListDeleteDialogs` |
| Detail reply / detail delete | route | `hooks/useInquiryReply`, `useInquiryDetailDelete` |
| List / detail UI | route | `InquiriesList`, `InboxDetail`, thread/attachments |
| Graph/IMAP config help copy | route | `MailboxConfigHelp` |
| Orchestration | route | `InquiriesPage` |
| Route wiring | — | thin `admin.inquiries.tsx` |

### Remaining route line count

`apps/admin/src/routes/admin.inquiries.tsx`: **6** physical lines (createFileRoute + validateSearch + InquiriesPage).

### Command results (Stage 3 verification)

| Command | Exit | Result |
|---------|-----:|--------|
| `npm run typecheck` | **0** | Pass (all workspaces incl. admin) |
| `npm run lint` | **0** | Pass (root lint alias → cms-renderer typecheck) |
| `npm run test:contract` | **0** | 52 files / **511** tests |
| `npm run test:ci` | **0** | 11 files / **113** tests |
| `npm run build -w @mccoy/admin` | **0** | Pass |
| `npm run build -w @mccoy/storefront` | **0** | Pass |
| `npm run test -w @mccoy/admin` | **0** | inquiry + async UX suites (incl. frozen-behaviour coverage index) |
| `npm run test:e2e:forms` | **0** | **4 passed** (2026-08-06 closeout rerun). Ports 5173/5174 freed; Playwright Chromium installed; fixture search label aligned to frozen UI `Zoek aanvragen` (`e2e/fixtures/forms.ts`). Auth setup + contact → Aanvragen, offerte glass → Aanvragen, vacatures form visibility. |

### Manual checks outstanding after Stage 3

1. Optional operator Graph smoke on non-prod mailbox (not required for Stage 3 structural gate).
2. Carry-over from Stage 2: CMS AI overwrite confirm UX when convenient.

`npm run test:e2e:forms` is **recorded green** in the Stage 3 closeout command table above.

### Preserved invariants

- No UniversalMailbox / GenericCrudPage / multi-domain abstractions
- Unchanged mailbox APIs (`admin-requests.functions`), Graph/IMAP behaviour, read-on-open, reply recipients, delete semantics
- No schema / notifications / CMS / localisation / form-source / auth / route-path changes
- Pins remain at `@/lib/requests/inquiry-pins` (feature re-exports only)
- Selected inquiry = `selectedId` + authoritative `getAdminFormInboxMessage` detail
- Dutch copy, pins, selection toolbar, bulk delete, attachments, conversation thread, `FORM_INBOX_SHOW_ALL` banner preserved

### Follow-on

Stage 4 (cms-editor barrel / inspector split) is **complete** — see Stage 4 closeout above. Recommended next: Stage 5 registry decomposition.