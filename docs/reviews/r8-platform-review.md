# R8 — Platform review

**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Date:** 2026-08-08  
**Skill:** `.cursor/skills/platform-review/SKILL.md`  
**Mode:** report-only

## MG5 status (authoritative for R8)

| Item | Status |
|------|--------|
| MG5 implementation | **QUALIFIED** |
| Fixture qualification | **PASS** |
| Staging persisted-data qualification | **PENDING** |
| Production migration | **NOT EXECUTED** |
| Legacy retirement eligibility | **NOT ESTABLISHED** |

## Evidence

```text
npm run cms:migrate-fixed-blocks:verify-env -- --environment staging
ok=false
code=mg5.env.missing_mccoy_environment
targetVerified=false
branch=development
```

Fail-closed behaviour confirmed. Staging is **not** inferred from branch name alone. No staging/production apply executed during R8.

## Findings

### PL-001 — MG5 staging environment identity operations hold

| Field | Value |
|-------|-------|
| id | `PL-001` |
| ruleId | `platform.mg5.staging-identity-hold` |
| severity | info |
| confidence | high |
| path | `docs/refactoring/mg5-migration-closeout.md` |
| status | deferred |
| evidence | verify-env exit 2; missing `MCCOY_ENVIRONMENT` / staging project allowlist |
| impact | Blocks staging persisted-data dry-run/apply until ops configures a separate safe staging Supabase target |
| recommendation | Set positively identified staging env + allowlists; do not weaken guards |
| relatedFindings | — |

This is an **OPERATIONS HOLD**, not an R8 code defect.

## MR status

**NOT ELIGIBLE / NOT STARTED**

## Verdict

**PASS with OPERATIONS HOLD (PL-001)**
