# R8 — Performance review

**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Date:** 2026-08-08  
**Skill:** `.cursor/skills/performance-review/SKILL.md`  
**Mode:** report-only (measurement-backed)

## Measurements

| Build | Exit | Duration (baseline) |
|-------|-----:|---------------------|
| `npm run build -w @mccoy/admin` | 0 | ~7374 ms |
| `npm run build -w @mccoy/storefront` | 0 | ~5887 ms |

R7 closeout noted storefront `pageSectionRenderers` SSR chunk ~87KB and `BlockView` ~19KB — no R8 composition regression introduced (no composition code changes in R8).

## Inspected

- Intentional home deferred chunks (preserved by R7 contract)
- CMS media list errors under E2E (missing Supabase URL) — expected in legacy E2E env; not a production N+1 claim
- No new unbounded listener patterns introduced by R8 (skills/docs/runner only)

## Findings

No measurable production performance regression attributable to R8. No high-severity “add useMemo” recommendations without evidence.

## Verdict

**PASS**
