# Application defect report — Playwright CMS / Aanvragen audit

**Date:** 2026-07-24 (re-verified from scratch; prior “52 passed” claim treated as unverified)  
**Verdict:** **READY** (fuller Chromium gate green with `--retries=0`)

---

## Severity summary

| Severity | Count | Notes |
|----------|------:|-------|
| Critical | 0 | |
| High | 0 | Silent-save / EN-unpublish / form hydration races fixed |
| Medium | 1 | Gallery publish still needs Supabase media in E2E |
| Low | 2 | Admin overview mock; products/users stubs |
| Info | 2 | Graph/IMAP opt-in; Vite `Server function not resolved` noise under `E2E_USE_DEV` |

---

## Re-verification method

1. Cleared ports 5173/5174; Playwright Chromium available.
2. Re-ran the seven previously disputed CMS specs individually with `E2E_USE_DEV=1` — **all green** (prior product fixes already present in tree).
3. Ran fuller gate — initially **exit 0** but **1 flaky** (`forms-aanvragen` contact submit); classified and fixed.
4. Re-ran fuller with **`--retries=0`** after the form fix — **52 passed / 0 failed / 1 expected skip**.
5. Stage scripts (documented as smoke / quality): both green with `--retries=0`.

---

## Classification table (this run)

| Spec / failure | Classification | Verified root cause | Fix / status |
|----------------|----------------|---------------------|--------------|
| `cms-custom-page.spec.ts` | *(prior)* **PRODUCT_DEFECT** | Silent success: `alert` only when `result.warning` set | Already fixed: always `alert(warning \|\| "Opgeslagen.")` — **green this run** |
| `cms-save-reload-discard.spec.ts` | *(prior)* **PRODUCT_DEFECT** | Same silent-save | Same — **green** |
| `cms-draft-publication-block.spec.ts` | *(prior)* **PRODUCT_DEFECT** | Empty hero title publishable; weak field identity | `HERO_TITLE_REQUIRED` + NL section/field messages + `htmlFor`/`useId` — **green** |
| `cms-cross-origin-bridge.spec.ts` | *(prior)* **PRODUCT_DEFECT** | Canvas click on `data-cms-inline-edit` skipped selection | Always `onSelect`; React `onPointerDown` — **green** |
| `cms-edit-interaction.spec.ts` | *(prior)* **PRODUCT_DEFECT** | Same selection path | Same + edit guard capture listeners — **green** |
| `cms-locale-en-publish.spec.ts` | *(prior)* **PRODUCT_DEFECT** (+ prior test targeting) | `setEnFieldDrafts` unpublished live EN; broad EN label filled eyebrow | Keep publication; mark stale; assert `hero-heading` / Titel EN — **green** |
| `cms-roadmap.spec.ts` | *(prior)* **PRODUCT_DEFECT** | Silent-save blocked lifecycle | Same save alert — **green** |
| `forms-aanvragen` contact submit (found during fuller re-verify) | **PRODUCT_DEFECT** + **TIMING_OR_READINESS_DEFECT** | Submit clicked before React hydration → **native GET** to `/contact?name=…&email=…` (empty form after reload; no success) | `useClientReady()` disables submit until mount; `data-testid="site-form-ready"`; fixture waits for ready/enabled; assert no `?name=` — **green twice with `--retries=0`** |

Prior agent’s “fuller already green / no remaining reds” was **not** re-proven until this run. The seven CMS specs were already fixed in code; the **forms hydration race** was still red on cold first attempt and would have been masked by Playwright’s default `retries: 1`.

---

## Product fixes confirmed in tree (CMS)

- `apps/admin/src/routes/admin.website.$pageId.tsx` — always alert on successful publish
- `@mccoy/cms-schema` — `HERO_TITLE_REQUIRED`
- Admin Field `htmlFor` / `useId`; NL validation messages with section + `(veld: titel)`
- `data-testid="hero-heading"` on hero renderer
- Canvas selection still fires for `data-cms-inline-edit`; React `onPointerDown`
- `setEnFieldDrafts` does not unpublish live EN; marks `freshness: "stale"` when published

## Product fix added this run (forms)

- `apps/storefront/src/lib/use-client-ready.ts`
- Contact / Offerte / Vacatures submit disabled until client mount
- E2E `fixtures/forms.ts` + `resilience.spec.ts` wait for `site-form-ready`

---

## Gate results (verified this session)

### Individual CMS specs (`E2E_USE_DEV=1`)

| Spec | Result |
|------|--------|
| `e2e/cms-custom-page.spec.ts` | passed |
| `e2e/cms-save-reload-discard.spec.ts` | passed |
| `e2e/cms-draft-publication-block.spec.ts` | passed |
| `e2e/cms-cross-origin-bridge.spec.ts` | passed |
| `e2e/cms-edit-interaction.spec.ts` | passed |
| `e2e/cms-locale-en-publish.spec.ts` | passed |
| `e2e/cms-roadmap.spec.ts` | passed |

### Stage 2 — P0 smoke

`E2E_USE_DEV=1 npx playwright test --project=chromium e2e/smoke.p0.spec.ts --retries=0`  
→ **5 passed**, exit 0

### Stage 3 — quality subset

`E2E_USE_DEV=1 npx playwright test --project=chromium e2e/a11y.critical.spec.ts e2e/responsive.spec.ts e2e/resilience.spec.ts e2e/security.browser.spec.ts --retries=0`  
→ **13 passed**, exit 0  
(= `npm run test:e2e:quality`)

### Fuller gate

`E2E_USE_DEV=1 npx playwright test --project=chromium --reporter=list --grep-invert "pixel screenshots|Brave" --retries=0`  
(= `test:e2e:fuller` with retries forced off for honesty)

| Metric | Count |
|--------|------:|
| Passed | **52** |
| Failed | **0** |
| Skipped | **1** (expected: `providers/real-inbox.integration` placeholder) |
| Flaky | **0** (with `--retries=0`) |
| Quarantined P0/P1 | **0** |
| Duration | ~2.8m |
| Exit | **0** |

### Acceptance gate

- [x] 0 failed
- [x] 0 unexpectedly skipped
- [x] 0 quarantined P0/P1
- [x] Stage 2 (smoke) and Stage 3 (quality) green
- [x] Seven former CMS reds green
- [x] Forms contact submit green without relying on retries

---

## Known limitations

- `MCCOY_E2E=1` clears Supabase → gallery **image upload** cannot finalize; title/preview still covered.
- Vite `E2E_USE_DEV=1` can still log transient `Server function not resolved` (allowlisted in `failureSink`); inbox list recovered in forms run.
- CMS **block** forms in `@mccoy/cms-renderer` (`ConversionSectionViews`) still lack the client-ready submit gate — same native-GET risk if clicked pre-hydration; not exercised by fuller P0 forms path.
- Real Graph/IMAP remains opt-in (`docs/testing/provider-strategy.md`).

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run test:e2e:smoke` | Stage 2 — P0 smoke |
| `npm run test:e2e:forms` | Forms → Aanvragen |
| `npm run test:e2e:quality` | Stage 3 — a11y / responsive / resilience / security |
| `npm run test:e2e:coverage` | Field coverage + add sections |
| `npm run test:e2e:locale` | Locale specs |
| `npm run test:e2e:fuller` | Chromium minus pixel screenshots |
| `npm run test:e2e:ci` | Full Chromium including screenshots |

CI workflow: `.github/workflows/cms-e2e.yml` → `test:e2e:ci`

---

## Final verdict: **READY**

**Evidence:** fuller Chromium **52 passed / 0 failed / 1 expected skip** with `--retries=0`; seven CMS specs green; forms hydration product defect fixed and regression-hardened; Stage smoke + quality green.
