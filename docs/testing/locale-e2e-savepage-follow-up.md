# Locale E2E `savePage` / "Opgeslagen" follow-up

**Status:** Open follow-up — **not blocking Stage 5** architecture work once classified.

**Tracking opened:** 2026-08-06 (Stage 4 closeout)

## Classification (primary)

**Fixture defect** — `e2e/helpers/cms.ts` `savePage` asserts an ephemeral success toast (`Opgeslagen`) instead of durable publish UI state.

**Secondary:** **Race / eventual consistency** — even when the toast briefly appears, a 60s poll can miss it if the toast dismisses before the next poll tick after a slow publish.

**Not:** Stage 4 product regression. Structural commit `9c7bb0470bc7d4e73bd9b5e817ead77e6b729c48` only extracted cms-editor inspectors into sibling modules; it did not change save/publish toast logic.

## Evidence

| Source | Observation |
|--------|-------------|
| Spec | `e2e/cms-locale-en-publish.spec.ts` — custom page NL+EN hero titles → `savePage` |
| Helper | `e2e/helpers/cms.ts` (~332): `expect.poll` waits for visible text `"Opgeslagen"` (or alert matching `/opgeslagen/i`) for 60s |
| Failure snapshot (run1 retry1) | `test-results/cms-locale-en-publish-CMS--4404a-o-titles-publish-to-and-en--chromium-retry1/error-context.md` |
| Snapshot durable UI | Page badge **Live**; button **"Opslaan & publiceren" [disabled]**; **"Verwerpen" [disabled]** — clean published toolbar |
| Run1 | `.data/locale-e2e-run1.log` — 4 passed / 1 failed (same `savePage` timeout) |
| Run2 | `.data/locale-e2e-run2.log` — **4 passed / 1 failed** (identical failure; Live + disabled Opslaan/Verwerpen) |
| Prior product report | `docs/testing/application-defect-report.md` previously listed locale as green after product fixes (toast/assert targeting), confirming this is a flaky fixture vs durable state |
| SUPABASE notes | Playwright clears `SUPABASE_*` for file-CMS / `MCCOY_E2E=1`; Missing `SUPABASE_URL` in admin logs is environmental noise — snapshot evidence above is stronger |

## Recommended fix

Update `savePage` to treat success as durable toolbar state:

1. Prefer: page badge text **Live** (or equivalent published indicator) **and/or** **"Opslaan & publiceren"** disabled (and optionally **Verwerpen** disabled).
2. Optionally still accept visible `"Opgeslagen"` / alert if present (fast path).
3. Keep rejecting non-save alerts (`Opslaan rejected: …`).

Do **not** lengthen the toast-only poll as the primary fix.

## Scope guard

- Fix lives in E2E helpers / specs only unless product toast timing is separately product-owned.
- Does not reopen Stage 4 cms-editor barrel work.
- Does not block Stage 5 registry decomposition once this classification is recorded.
