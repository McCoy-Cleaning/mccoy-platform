---
name: bug-risk-review
description: >-
  Report-only McCoy bug-risk review for races, stale async, missing cleanup,
  idempotency gaps, and CMS/Aanvragen/MFA regression surfaces. Use for R8
  bug-risk-review or before risky refactors.
disable-model-invocation: true
---

# Bug-risk review (report-only)

## PURPOSE

Find deterministic race, stale-state, cleanup, and idempotency defects.

## SCOPE

CMS load/save/publish/local recovery/preview; Aanvragen Graph sync/delete/threading; notifications; MFA; MG5 tooling.

## INPUTS

Historical closeouts; package tests; `npm run review:r8 -- --review bug-risk`.

## OUT OF SCOPE

Reopening fixed architecture without evidence; redesign; speculative refactors.

## REQUIRED EVIDENCE

Code path + race scenario, failing test, or clear missing cleanup/idempotency.

## REVIEW PROCEDURE

1. Look for stale async overwrite, missing abort/generation tokens, duplicate writes, optimistic rollback gaps.
2. Event listener / timer cleanup; page/locale identity mismatches; silent fallbacks masking errors.
3. Idempotency for webhooks/sync/delete; destructive retries; non-deterministic IDs where deterministic IDs required.
4. Emit findings per [finding-contract.md](../_shared/finding-contract.md) → `docs/reviews/r8-bug-risk-review.md`.

## SEVERITY RULES

- blocker/high: data corruption, duplicate fulfilment, lost saves under concurrency
- medium: intermittent UX races
- low/info: defensive hardening

## FALSE-POSITIVE RULES

Documented known locale E2E console flakes without product save failure are deferred, not new blockers, unless new evidence appears.

## OUTPUT FORMAT

Common finding contract; link related CMS/security findings.

## NO-AUTO-FIX POLICY

Report only by default.

## EXAMPLES

- Finding: publish handler ignores request generation and can apply older response → high
- Non-finding: “file is complex” without race evidence → ignore or info
