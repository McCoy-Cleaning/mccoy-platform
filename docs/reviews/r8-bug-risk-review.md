# R8 — Bug-risk review

**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Date:** 2026-08-08  
**Skill:** `.cursor/skills/bug-risk-review/SKILL.md`  
**Mode:** report-only

## Scope

CMS save/publish races, Aanvragen forms path, locale EN publish console loop, MG5 idempotency tests.

## Evidence

| Area | Result |
|------|--------|
| Forms → Aanvragen E2E | 4 passed |
| CMS inventory / coverage | 14 + 7 passed |
| MG5 unit/operator/idempotency | 42 passed |
| Locale EN publish E2E | **fixed** — `npm run test:e2e:locale` green after LocalePublishPanel coverage-effect deps use stable store refs |

## Findings

### BR-001 — Admin CMS editor update-depth loop during custom-page EN publish

| Field | Value |
|-------|-------|
| id | `BR-001` |
| ruleId | `bug.cms.editor-update-depth` |
| severity | medium |
| confidence | high |
| path | `apps/admin/src/components/admin/cms/LocalePublishPanel.tsx` |
| status | **resolved** |
| evidence | Root cause: coverage `useEffect` depended on `getEditablePage()` nested fields; `applyDraftToPage` always `structuredClone`s so deps churned every render → `setCoverage` loop. Fixed by depending on `useCms()` draft/saved/version/`updatedAt` and `useEditablePage`. |
| impact | Was: noisy EN publish E2E via failureSink; editor jank. Now: locale + focused CMS editor E2E green without ignoring update-depth console errors. |
| recommendation | Keep avoiding `getEditablePage()` object identity in React effect deps (see `admin.website.$pageId.tsx` / `useEditablePage`). |
| verification | `npm run test:e2e:locale`; unit `LocalePublishPanel.test.tsx` |

## Verdict

**PASS** — BR-001 resolved at editor source (not failureSink masking).
