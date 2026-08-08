---
name: ui-ux-review
description: >-
  Report-only McCoy UI/UX review for objective usability defects in Admin and
  storefront. Use when running R8 ui-ux-review or assessing loading, errors,
  confirmations, drafts, or responsive task completion — not taste.
disable-model-invocation: true
---

# UI/UX review (report-only)

## PURPOSE

Find objective usability defects that block or confuse task completion.

## SCOPE

Admin CMS, Aanvragen, auth/MFA, settings; storefront navigation, forms, Producten, Vacatures, locale chrome.

## INPUTS

Frontend audit/architecture docs; Playwright form/coverage/locale specs; `npm run review:r8 -- --review ui-ux`.

## OUT OF SCOPE

Subjective color/spacing/typography taste; brand unification; redesign; silent CSS rewrites.

## REQUIRED EVIDENCE

Repro steps, screenshots only if already available, failing interaction tests, or concrete component paths.

## REVIEW PROCEDURE

1. Inspect destructive actions for clear confirmation (custom dialogs, not native confirm preference alone).
2. Check loading vs refreshing clarity; error states that preserve user data; empty states; form feedback.
3. Check save/publish and draft/live clarity; double-submit; misleading status; modal/focus that blocks tasks.
4. Preserve separate Admin vs storefront branding.
5. Emit findings per [finding-contract.md](../_shared/finding-contract.md) → `docs/reviews/r8-ui-ux-review.md`.

## SEVERITY RULES

- blocker/high: task cannot complete or data loss on error
- medium: confusing but recoverable
- low/info: visual suggestions without usability failure

## FALSE-POSITIVE RULES

Do not fail “I would redesign this card”. Design suggestions are low/info unless they cause measurable usability/a11y harm.

## OUTPUT FORMAT

Common finding contract; dedupe `ruleId+path+symbol`.

## NO-AUTO-FIX POLICY

Report only unless user explicitly requests a minimal usability fix.

## EXAMPLES

- Finding: publish error clears the entire editor draft → high
- Non-finding: prefer different accent color → info at most
