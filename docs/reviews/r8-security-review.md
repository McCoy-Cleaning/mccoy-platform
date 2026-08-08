# R8 — Security review

**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Date:** 2026-08-08  
**Skill:** `.cursor/skills/security-review/SKILL.md`  
**Mode:** report-only (no secrets printed)

## Scope

Admin cookie-authoritative auth, MFA memory isolation, service-role boundaries, XSS unit coverage, MG5 fail-closed guards.

## Auth evidence

`apps/admin/src/lib/supabase-browser.ts`:

- Realtime + MFA clients: `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`
- Memory storage; legacy `mccoy-admin-auth` purged via allowlisted keys
- Tests: `supabase-browser.test.ts`, `admin-cookie-auth-acceptance.test.ts` (baseline admin suite green)

Public helper `packages/database/src/supabase-browser.ts` uses `persistSession: true` for **RLS-bound public** clients — **not** Admin auth; classified accepted pattern (false-positive if flagged as Admin regression).

## Deterministic commands

| Command | Result |
|---------|--------|
| `npm run review:r8 -- --review security` | 0 Admin `persistSession: true` hits |
| `npm run test -w @mccoy/security` | 23 passed |
| `npm run test -w @mccoy/admin` | auth tests included — passed |
| `npm run cms:migrate-fixed-blocks:verify-env -- --environment staging` | exit 2 fail-closed (`missing_mccoy_environment`) |
| Renderer XSS text-node tests | passed in `test:ci` |

## Findings

No open blocker/high security defects in R8.

## Verdict

**PASS**
