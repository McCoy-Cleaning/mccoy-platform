---
name: security-review
description: >-
  Report-only McCoy security review for Admin cookie auth, MFA isolation,
  RLS/service-role boundaries, XSS, forms abuse, CMS publish/migration guards,
  and supply-chain exposure. Use for R8 security-review or auth regressions.
disable-model-invocation: true
---

# Security review (report-only)

## PURPOSE

Detect authentication, authorization, XSS, secret, and migration-guard defects.

## SCOPE

Admin cookie auth / Realtime / MFA; RLS and service-role; input/XSS; forms; CMS publish & MG5 guards; headers; npm audit exposure classification.

## INPUTS

`apps/admin/src/lib/supabase-browser.ts`, staff auth modules, `@mccoy/security` tests, `npm run test -w @mccoy/security`, `npm run review:r8 -- --review security`. Never print secrets.

## OUT OF SCOPE

Blind dependency upgrades; fully redesigning MFA; MG5 staging/production apply; printing credentials.

## REQUIRED EVIDENCE

Code paths, test failures, header config, or exploitability rationale — not CVE number alone.

## REVIEW PROCEDURE

1. AUTH: cookie-authoritative Admin; `adminRealtimeSupabase` persistSession/autoRefresh/detectSessionInUrl all false; MFA memory-only; no `mccoy-admin-auth` persistence reintroduction; server refresh; AAL2 server verify; logout; CSRF/origin.
2. BOUNDARIES: service-role server-only; no secret in client bundles; authz not browser-trusted.
3. INPUT: XSS / dangerouslySetInnerHTML / sanitisation; open redirect; uploads; SSRF; SQL interpolation.
4. FORMS: validation, anti-abuse, trusted recipients.
5. CMS/MG5: publish validation; production guards fail closed; backup leakage.
6. SUPPLY CHAIN: npm audit if available — classify by exposure.
7. Emit findings per [finding-contract.md](../_shared/finding-contract.md) → `docs/reviews/r8-security-review.md`.

## SEVERITY RULES

- blocker/high: auth boundary break, secret exposure, privilege escalation, persistent Admin JWT reintroduction
- medium: defense-in-depth gap with limited exposure
- low/info: hardening suggestions

## FALSE-POSITIVE RULES

Storefront/public Supabase client with `persistSession: true` is not Admin auth regression if Admin clients remain cookie-authoritative with persistSession false. Script-only service clients are expected offline tooling.

## OUTPUT FORMAT

Common finding contract; cross-link platform findings instead of duplicating.

## NO-AUTO-FIX POLICY

Report only by default. Remediations require explicit user/orchestrator request and tests.

## EXAMPLES

- Finding: Admin browser client sets `persistSession: true` → blocker
- Non-finding: generic `createBrowserSupabaseClient` for public RLS-bound use → accepted pattern if Admin path isolated
