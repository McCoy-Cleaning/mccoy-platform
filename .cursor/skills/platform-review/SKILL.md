---
name: platform-review
description: >-
  Report-only McCoy platform/ops review for env separation, Vercel assumptions,
  MG5 fail-closed guards, secrets hygiene, CI/build scripts, and operations
  holds. Use for R8 platform-review or migration readiness — never to force
  staging green.
disable-model-invocation: true
---

# Platform review (report-only)

## PURPOSE

Validate production-operational correctness and accurate MG5 status wording.

## SCOPE

Env separation; Supabase project identity; secrets; CI/build; MG5 operator guards; logging/telemetry; cache headers; fail-closed behaviour.

## INPUTS

`docs/refactoring/mg5-migration-closeout.md`; MG5 env verify scripts; `.env.example`; `npm run review:r8 -- --review platform`. Never print secrets.

## OUT OF SCOPE

Executing MG5 staging/production apply; weakening guards to make staging green; MR retirement.

## REQUIRED EVIDENCE

Command exit codes, missing env diagnostics (redacted), config paths, docs status.

## REVIEW PROCEDURE

1. Check Vercel/dev/main assumptions and env variable separation.
2. MG5: implementation QUALIFIED; fixture PASS; staging persisted-data PENDING; production NOT EXECUTED; legacy retirement NOT ESTABLISHED.
3. Confirm staging apply remains NO-GO without positively identified separate staging Supabase target.
4. Confirm production migration guards fail closed; staging is not inferred from branch name alone.
5. Secrets: no committed secrets; examples placeholders only; service-role server-side.
6. Emit findings per [finding-contract.md](../_shared/finding-contract.md) → `docs/reviews/r8-platform-review.md`.
7. Represent MG5 staging hold as **OPERATIONS HOLD** / info — not a code defect — when machinery is correct.

## SEVERITY RULES

- blocker/high: production guard bypass, secret commit, env mix-up that can hit production
- medium: missing docs/CI guardrails
- info: OPERATIONS HOLD for staging identity

## FALSE-POSITIVE RULES

Missing local staging credentials are an operations hold, not R8_BLOCKED, when fail-closed behaviour is verified.

## OUTPUT FORMAT

Common finding contract; MG5 status table mandatory in R8 report.

## NO-AUTO-FIX POLICY

Report only. Do not apply migrations.

## EXAMPLES

- Finding: CLI allows production apply without confirm phrase → blocker
- Info: staging verify fails with missing `MCCOY_ENVIRONMENT` → OPERATIONS HOLD
