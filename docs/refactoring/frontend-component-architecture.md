# Frontend component architecture — Stage 1

**Date:** 2026-08-06  
**Scope:** Target architecture and roadmap for frontend component refactoring. Documentation only.  
**Companion audit:** [frontend-component-audit.md](./frontend-component-audit.md)

This document maps layered ownership onto the McCoy monorepo, states dependency rules, describes how CMS registries evolve, and summarizes Stages 2–8 including Stage 7 skills requirements.

---

## Goals

1. Keep **premium, accessible** UI without merging storefront and admin brands.
2. Preserve **CMS invariants** (pageKey, layout versions, EN paths, form sources, publish validation, preview parity).
3. Make **responsibility boundaries** obvious so large files can be split safely later.
4. Prefer **server-enforced** domain rules in packages; UI packages stay presentation-focused.
5. Measure progress with **parity / reuse / dependency / regression gates**, not LOC.

---

## Layers A–F (mapped to this repo)

| Layer | Name | Responsibility | McCoy mapping |
|------:|------|----------------|---------------|
| **A** | Design tokens & primitives | `cn`, buttons, low-level class tokens, future shared tokens | `packages/ui` today: `cn`, `Button`, `LayoutList`. App CSS tokens: admin `.a-*` in `apps/admin/src/styles.css`; storefront brand CSS in storefront. App-local shadcn under `apps/*/src/components/ui` (46 files each). |
| **B** | App chrome & shell | Navigation, page headers, admin layout, storefront navbar/footer | Admin: route shell, `AdminBits.PageHeader`, admin buttons. Storefront: `Navbar`, `Footer`, locale chrome. **Do not cross-import.** |
| **C** | Feature UI (app-owned) | Route-level features with product semantics | Admin: `admin.inquiries`, `admin.settings`, MFA/invite, website page shell. Storefront: `SitePageSections`, city landings, vacatures application section wrappers. |
| **D** | CMS authoring | Editors, inspectors, AI assist, layout authoring | `@mccoy/cms-editor` (+ admin providers that inject server/AI bridges). Consumed by **admin only**. |
| **E** | CMS rendering | Public/preview block views, section chrome | `@mccoy/cms-renderer` — shared by storefront, admin preview, and tests. |
| **F** | Domain contracts | Schema, ids, migrate, validate, form sources, i18n field paths | `@mccoy/cms-schema` (+ `@mccoy/domain` for fixed form source ids). Also persistence adapters in `@mccoy/database`. **No React chrome here.** |

### Supporting packages (not a separate UI layer)

| Package | Role |
|---------|------|
| `@mccoy/content-ai` | Server-side AI for CMS copy — admin wiring only |
| `@mccoy/security` / `@mccoy/email` / `@mccoy/notifications` | Platform services — not UI |
| `@mccoy/validation` | Shared validation helpers |

Deployable apps: `apps/storefront` (`www`), `apps/admin` (`admin`) — see [docs/apps-and-hosts.md](../apps-and-hosts.md).

---

## Package ownership

| Concern | Owner | May depend on |
|---------|-------|---------------|
| Public site UX | `@mccoy/storefront` | schema, renderer, ui, domain (browser-safe) |
| Admin UX | `@mccoy/admin` | schema, renderer, **cms-editor**, content-ai (server), ui, domain |
| Block editors | `@mccoy/cms-editor` | schema, renderer (preview widgets only), ui |
| Block views | `@mccoy/cms-renderer` | schema (+ ui sparingly; prefer schema tokens / local section CSS) |
| CMS rules | `@mccoy/cms-schema` | domain, zod — **no** apps, **no** cms-editor |
| Shared primitives | `@mccoy/ui` | none of the apps; no CMS domain |

### Ownership rules of thumb

- If it **validates publish** or **normalizes block data** → schema (F).
- If it **renders published/preview markup** → renderer (E).
- If it **edits** CMS fields → cms-editor (D).
- If it is **Aanvragen mailbox / MFA / settings** → admin feature UI (C).
- If it is **marketing section composition** → storefront (C) calling renderer (E).
- Promote to `@mccoy/ui` (A) only after **two+ call sites** with **identical** visual/interaction semantics and no app-specific copy.

---

## Dependency direction rules

```text
apps/storefront ──► cms-renderer ──► cms-schema ──► domain
       │                 ▲
       │                 │
       └─────────────────┴── ui (optional)

apps/admin ──► cms-editor ──► cms-renderer ──► cms-schema
     │              │
     │              └──► ui
     └──► ui / content-ai (server) / database (server)
```

### Hard prohibitions

| Forbidden | Reason |
|-----------|--------|
| `storefront → cms-editor` | Authoring must not ship on public host (contract-tested) |
| `cms-schema → React app code` | Keeps domain portable and testable |
| `cms-editor → apps/admin` | Breaks package boundary; use dependency inversion (callbacks/providers) |
| `renderer → cms-editor` | Preview/public must not pull editors |
| Browser → service-role / Mollie / privileged keys | Security (platform rules) |
| Trusting client prices/roles/`company_id` | Platform rules (future commerce) |

### Allowed inversion patterns

- Admin implements `CmsAiAssistApi` and passes it into cms-editor context, including structured `confirmOverwrite: (request: CmsConfirmationRequest) => Promise<boolean>` wired to `appConfirm`. Missing support, provider errors, Escape, and cancellation must **fail closed** (`false` / abort); preserve CMS content; **never** fall back to `window.confirm`.
- Admin passes `CmsImagePickerProps` into editors.
- Schema exposes pure functions; apps/stores call them.

---

## How registries evolve

McCoy already uses **registry + dedicated module** patterns. Continue that instead of growing mega-switches.

### Schema block catalog (`packages/cms-schema`)

- **Source of truth** for block types, defaults, normalize, publish checks.
- Pattern: extract per-family modules (`plans.ts`, `jobs.ts`, `offers.ts`, `new-sections.ts`, `form-fields.ts`) and re-export from `catalog.ts` / barrel.
- Evolution rule: **new block type = new definition module + registry entry + tests**; avoid adding large inline defs to `catalog.ts`.

### Editor registry (`packages/cms-editor/.../blockEditorRegistry.ts`)

- Maps `BlockType` → editor component + metadata (`editor-definition.ts`).
- Aggregates such as `StructureBlockEditors.tsx` / `NewSectionsBlockEditors.tsx` are **temporary cohesion**; split when a family gains independent tests or distinct dependencies.
- Evolution rule: register in registry; do not add new editors into `index.tsx`.

### View registry (`packages/cms-renderer/.../blockViewRegistry.ts`)

- **Stage 5 complete:** every publishable `BlockType` is registered; `RegisteredBlockView` is orchestration-only (parse → lookup → explicit fallback).
- Family view modules: `BasicContentSectionViews`, `StructuralSectionViews`, `MediaSocialSectionViews`, `InformationLegalSectionViews`, conversion views, plus preserved `Plans/Jobs/Offers/StepsSectionView`.
- Editor registry composed from `editor-registry/*` family modules.
- Closeout: [`stage5-registry-closeout.md`](./stage5-registry-closeout.md). Inventory: [`stage5-registry-inventory.md`](./stage5-registry-inventory.md).

### Fixed sections vs blocks

- Builtin fixed sections (hero, partners, …) use schema section keys + editor inspectors + storefront/renderer views.
- Do not force fixed sections through the block registry unless a deliberate migration says so.

### Form sources

- Identity is **canonical form source keys** (+ legacy aliases), never “whatever block id is in the current layout.”
- Owned by schema (`form-source.ts`) with domain fixed ids.

---

## Stage 2–8 roadmap summary

| Stage | Theme | Intent | Primary surfaces |
|------:|-------|--------|------------------|
| **1** | Audit + architecture | This pair of docs; baseline recorded | `docs/refactoring/*` |
| **2** | Admin async UX + dialogs | **Complete (2026-08-06).** Empty/Error/InlineLoader; FormField token; remove all cms-editor AI `window.confirm` via structured `CmsConfirmationRequest` | admin primitives, inquiries UX, `ai-assist.tsx`, `AdminCmsContentAiProvider` |
| **3** | Aanvragen feature extraction | **Complete (2026-08-06).** Extracted into `apps/admin/src/features/inquiries/`; thin route composition only | `apps/admin/src/features/inquiries/*`, thin `admin.inquiries.tsx` (6 lines) |
| **4** | cms-editor barrel / inspector split | **Complete (2026-08-06).** Inspectors/helpers out of barrel; `index.tsx` re-exports only (**97** lines; was **3102**) | `packages/cms-editor` |
| **5** | Registry decomposition | **Complete (2026-08-06).** All 35 types registered; orchestration-only `RegisteredBlockView` | cms-schema, cms-editor, cms-renderer |
| **6** | Admin CMS store modularization | Split persistence / layout mutations / publish / EN planning | `apps/admin/src/lib/cms/store.ts` |
| **7** | Storefront composition cleanup | Clarify section routers vs renderer; no admin chrome leakage | `SitePageSections`, home sections |
| **8** | Cursor skills + optional `@mccoy/ui` promotion | Report-only skills under `.cursor/skills/`; promote only proven cross-app primitives | `.cursor/skills/*`, `packages/ui` |

Stages 3+ must re-check the **protected-invariants register** in the audit doc before each slice.

### Stage 2 closeout (complete)

See audit § “Stage 2 closeout”. Highlights:

- Zero live `window.confirm` / `alert` / `prompt` in cms-editor AI paths and admin src.
- Confirmation tests in `ai-assist.confirm.test.tsx`.
- EN draft whitespace: store raw value; trim only when classifying blank/unresolved (`translation-field.ts` + regression test).
- Outstanding manual: CMS AI overwrite dialogs; forms E2E when Chromium available.

### Stage 3 (complete — 2026-08-06)

Extracted Aanvragen into `apps/admin/src/features/inquiries/`. Thin route is composition only.

**Behaviour freeze:** manually accepted product semantics are frozen. Stage 3 must not redesign Graph, threading, deletion, loading, or persistence. Coverage index: `features/inquiries/tests/frozen-behaviour-coverage.test.ts`.

| Concern | Owner |
|---------|-------|
| Route + `validateSearch` | `routes/admin.inquiries.tsx` (**6** lines) |
| Search types/validators | `features/inquiries/types/search.ts` |
| Formatting / filters / form fields / optimistic delete | `features/inquiries/lib/*` |
| List/detail query, selection, reply, deletes, realtime | `features/inquiries/hooks/*` |
| Page / list / detail / dialogs / mailbox config help | `features/inquiries/components/*` |
| Tests | `features/inquiries/tests/*` |

**Preserved invariants:** mailbox APIs, Graph/IMAP, read-on-open, reply recipients, delete semantics, pins (`@/lib/requests/inquiry-pins`), Dutch copy, selection toolbar, bulk delete, `FORM_INBOX_SHOW_ALL` banner, no UniversalMailbox abstractions. Selected inquiry = `selectedId` + authoritative detail query.

### Stage 4 (complete — 2026-08-06)

Collapsed `packages/cms-editor/src/index.tsx` to a thin re-export barrel (**97** lines; was **3102**).

**Checkpoint commit (structural):** `9c7bb0470bc7d4e73bd9b5e817ead77e6b729c48` — *Extract cms-editor fixed inspectors into sibling modules (Stage 4 structural).*

| Concern | Owner |
|---------|-------|
| Public API | `src/index.tsx` (re-exports only) |
| Selection | `selection.ts` (`CmsSelection`, `buildSectionMutation`) |
| Edit/preview guards + section frame | `EditInteractionGuard.tsx`, `SectionSelectFrame.tsx` |
| Image / typed link fields | `PrototypeImageField.tsx` |
| Card lists | `CardListEditor.tsx` + `list-helpers.tsx` |
| Fixed-inspector chrome | `inspector-chrome.tsx` (not `blocks/field-chrome` — style diverge) |
| Fixed-section inspectors + dispatcher | `inspectors/*` (`SelectedSectionInspector` last) |

**Preserved invariants:** public export names; `storefront ↛ cms-editor`; `cms-editor ↛ apps/admin`; sibling imports only (no `./index`); ai-assist ↛ inspectors; no Aanvragen / RegisteredBlockView / catalog / admin store / storefront changes.

**Locale E2E closeout:** `test:e2e:locale` failure on `savePage` / `"Opgeslagen"` classified as **fixture defect** (secondary: race). Durable UI already shows published state (Live + disabled Opslaan). Tracked: [`docs/testing/locale-e2e-savepage-follow-up.md`](../testing/locale-e2e-savepage-follow-up.md). Not a Stage 4 product regression; does not block Stage 5.

**Localisation unit coverage:** see audit § Stage 4 “Localisation unit coverage matrix” (`translation-field`, `en-field-drafts`, `en-field-sync`, `translation-coverage`, `cms-text-fallback`, `en-draft-fields`).

**Stage 5 (complete — 2026-08-06):** All 35 publishable types registered; `RegisteredBlockView` orchestration-only. See [`stage5-registry-closeout.md`](./stage5-registry-closeout.md). Do not start Stage 6 until prioritised.

### Stage 2 default (historical detail)

See audit § “Precise Stage 2 slice recommendation”. Summary:

- Admin-owned `EmptyState`, `ErrorState`, `InlineLoader`, `AdminFormField`.
- Inquiries becomes the reference consumer.
- AI assist overwrite confirms go through structured `CmsAiAssistApi.confirmOverwrite(CmsConfirmationRequest)` → admin `appConfirm` / `ConfirmationDialog` (fail closed; no `window.confirm`).
- No registry/store splits in Stage 2.

---

## Stage 7 — skills requirements

Skills live under **`.cursor/skills/`** (directory currently **absent**). Guardian hooks/CLI may already exist for verify/inventory/smoke; skills are a separate, report-oriented layer and must not silently rewrite production code.

### Mandatory skill behaviour

| Requirement | Meaning |
|-------------|---------|
| **Report-only default** | Skills emit findings and suggested patches; they do **not** apply refactors unless the user explicitly asks to implement. |
| **Common finding schema** | Every finding uses one shared JSON/Markdown schema (id, ruleId, severity, package, path, evidence[], recommendation, confidence). |
| **Evidence + confidence** | Each finding cites concrete paths/lines or command output; confidence is `high \| medium \| low` with a one-line rationale. |
| **Deduplication** | Findings with the same ruleId+path(+symbol) collapse; skills must merge duplicates across runs. |
| **No subjective Guardian gate** | Do not block merges on taste (“looks cleaner”). Gates are invariant/regression/dependency checks from Stage 1 outcome gates and CI. Guardian may **report**; it must not invent subjective pass/fail cosmetics. |

### Suggested Stage 7 skill set (non-implementing)

1. `frontend-boundary-check` — dependency direction violations.
2. `cms-invariant-check` — pageKey / form-source / publish validation touch points.
3. `a11y-async-ux-check` — spinner-only, missing alert roles, `window.confirm`.
4. `duplication-report` — candidate shared components with call-site lists.

Each skill should read the Stage 1 audit/architecture docs as input context.

---

## Relation to existing platform rules

- Follow [AGENTS.md](../../AGENTS.md) / `.cursor/rules/mccoy-core.mdc` for security, money, and RLS — this refactor track does not relax them.
- Architecture rule file references `docs/architecture/package-boundaries.md`; if that file is missing in-tree, **this document + `docs/apps-and-hosts.md`** are the operational boundary guides until package-boundaries is restored/added.
- CMS i18n runtime notes: [docs/cms-i18n-runtime.md](../cms-i18n-runtime.md).

---

## Success criteria (architecture-level)

1. Layers A–F have clear owners; new files land in the correct layer on first try.
2. Registries grow by **addition of modules**, not by unbounded switch/barrel growth.
3. Admin and storefront brands remain separate; shared code is schema/renderer/ui-proven only.
4. Stage 2 completes with baseline green and zero `window.confirm` in cms-editor AI paths.
5. Stage 7 skills can run report-only with deduped, evidenced findings and no subjective merge gate.
