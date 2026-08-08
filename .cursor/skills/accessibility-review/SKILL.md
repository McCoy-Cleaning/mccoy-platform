---
name: accessibility-review
description: >-
  Report-only McCoy accessibility review targeting WCAG 2.2 AA-relevant issues
  in Admin and storefront. Use for R8 accessibility-review, keyboard/focus,
  labels, dialogs, and axe-based checks — not formal certification claims.
disable-model-invocation: true
---

# Accessibility review (report-only)

## PURPOSE

Detect WCAG 2.2 AA-relevant defects that harm keyboard, AT, or critical flows.

## SCOPE

Labels, names, headings, landmarks, focus, modals, aria-live, reduced motion, alt text, forms, tables/lists; Admin login/MFA/CMS/Aanvragen; storefront nav/forms/dialogs.

## INPUTS

`e2e/a11y.critical.spec.ts` when present; `npm run test:e2e:quality` if available; `npm run review:r8 -- --review accessibility`.

## OUT OF SCOPE

Formal WCAG certification claims; subjective visual polish without a11y impact.

## REQUIRED EVIDENCE

axe violations, keyboard repro, missing label associations, concrete component paths.

## REVIEW PROCEDURE

1. Check heading hierarchy / meaningful H1; landmarks; labels and error associations; accessible names.
2. Buttons vs links; keyboard operation; focus order; modal trap/return; aria-live for async state.
3. Reduced motion; alt text; duplicate IDs; color-independent state; target sizes; hidden content exposure.
4. Emit findings per [finding-contract.md](../_shared/finding-contract.md) → `docs/reviews/r8-accessibility-review.md`.

## SEVERITY RULES

- blocker/high: critical flow inaccessible or task impossible
- medium: material a11y defect
- low: quality improvement

## FALSE-POSITIVE RULES

Decorative icons with empty alt; intentional visually-hidden labels that are correctly associated.

## OUTPUT FORMAT

Common finding contract; never claim certification unless performed.

## NO-AUTO-FIX POLICY

Report only by default.

## EXAMPLES

- Finding: MFA code input without accessible name → high
- Non-finding: prefer different focus ring color without contrast failure → low/info
