# SEO DEVELOPMENT DEPLOYMENT QUALIFICATION

Date: 2026-08-09  
Branch: `development`  
Classification: **SEO_DEV_BLOCKED**

## Verdict

Local Safe Mode tranche qualification **PASS** (tests, typecheck, storefront build, local production runtime SEO probes).  
Remote push / Vercel development deploy of the 5 SEO commits **FAIL** — GitHub rejected the McCoy SSH key (`Permission denied (publickey)`). No storefront development deployment URL available for the new HEAD. Do **not** promote to `main`.

Eligible commit range for later main promotion (after successful push + Vercel runtime re-qualify):

`3262444..750683a` (inclusive: `3262444`, `2f2104a`, `cb0e231`, `a9df41e`, `750683a`)

## Five SEO commits

| Hash | Subject |
|------|---------|
| `3262444` | `seo(docs): SEO Safe Mode + program baseline` |
| `2f2104a` | `seo(infra): host redirects, robots/sitemap hardening` |
| `cb0e231` | `seo(meta): resolveSeoMetadata + absolute head on marketing routes` |
| `a9df41e` | `seo(indexnow): post-publish notify with fail-open publish` |
| `750683a` | `test(seo): CI regression gates for Safe Mode` |

Local HEAD: `750683a1597fdd2c7fe9fe716013bcf41b628d62`  
Remote `origin/development` (unchanged): `d213d8377789383ce4461f4f763f95d3a0969275`

## Step 1 — Pre-push commands

| Command | Exit |
|---------|------|
| `git status --short` | `0` (clean) |
| `git diff --check` | `0` (no whitespace errors) |
| `git log --oneline --decorate -15` | `0` |
| `npm run test:seo` | `0` |
| `npm run typecheck -w @mccoy/security` | `0` |
| `npm run typecheck -w @mccoy/cms-schema` | `0` |
| `npm run typecheck -w @mccoy/database` | `0` |
| `npm run typecheck -w @mccoy/storefront` | `0` |
| `npm run lint` (cms-renderer typecheck) | `0` |
| `npm run lint:storefront` | `1` (see notes) |
| `npm run test -w @mccoy/storefront` | `0` (29 tests) |
| `npm run build -w @mccoy/storefront` | `0` |

### `test:seo` detail

- `seo:diff-guard` → `ok:true`, `protectedHits:0`, base `origin/development`, `seoFiles:24`
- `seo:visible-baseline:check` → `VISIBLE_BODY_CHANGED=false`
- `@mccoy/security` indexing + host-canonical → 16 passed
- `@mccoy/cms-schema` resolve-seo → 4 passed
- `@mccoy/database` indexnow + sitemap-seo + conformance → 9 passed

### Lint note

`npm run lint:storefront` failed with ~11.9k Prettier `Delete ␍` (CRLF) findings across the storefront tree. Treated as **Windows line-ending environmental noise**, not an SEO architecture defect. Root `npm run lint` passed.

No secrets / `.env` / backups / unrelated WIP in the 5-commit range.

## Step 2 — Invariants

From `docs/seo/SEO-SAFE-MODE.md` / `docs/seo/seo-tranche-qualification.md`:

| Flag | Value | Result |
|------|-------|--------|
| `SECTION_LOGIC_CHANGED` | `false` | PASS |
| `VISIBLE_COPY_CHANGED` | `false` | PASS |
| `VISIBLE_BODY_CHANGED` | `false` | PASS (baseline check) |
| `EN/NL_FIELDS_CHANGED` | `false` | PASS |
| `VISUAL_STYLING_CHANGED` | `false` | PASS |
| `PRODUCTEN/AANVRAGEN/AUTH_CHANGED` | `false` | PASS |
| `MG5_EXECUTED` | `false` | PASS |
| `MR_STARTED` | `false` | PASS |
| Diff guard protected paths | `0` hits | PASS |
| SEO-7 ≠ SEO-8 | proposed copy `PENDING_APPROVAL` only | PASS |

`HEAD_TECHNICAL_OUTPUT_CHANGED` (allowed): absolute www canonicals, og:url absolute, frozen deployed NL titles/descriptions, robots/sitemap, IndexNow fail-open, host redirects, BreadcrumbList / absolute sameAs.

## Step 3 — Push development

| Attempt | Result |
|---------|--------|
| `$env:GIT_SSH_COMMAND = 'ssh -i C:/Users/Ra/.ssh/id_ed25519_mccoy -o IdentitiesOnly=yes'; git push origin development` | **FAIL** exit `128` — `Permission denied (publickey)` |
| Default SSH config (`github.com-mccoy` → `IdentityFile ~/.ssh/id_ed25519_mccoy`) | **FAIL** same |
| Verbose SSH | Key offered (`ED25519 SHA256:3Rcbmn7+…`) then rejected by GitHub |

`git pull --no-rebase` not applicable (push never accepted; not a non-fast-forward).  
**main was not pushed.**

## Steps 4–14 — Deploy runtime

### Vercel URL discovery

| Probe | Result |
|-------|--------|
| Vercel CLI | Not installed; no `.vercel/project.json` |
| `https://mccoy-platform-storefront-git-development-mccoy1.vercel.app` | `404` `DEPLOYMENT_NOT_FOUND` |
| `https://mccoy-platform-admin-git-development-mccoy1.vercel.app` | Live (`302` → `/admin`, `X-Robots-Tag: noindex`) — admin only |
| SEO commits on remote development | **No** (push blocked) |

**Live Vercel storefront development deploy of this tranche: UNAVAILABLE.**

### Local production artifact runtime (`npm run build` + `npm run start:storefront` → `http://localhost:4173`)

| Check | Result |
|-------|--------|
| App smoke: `/`, `/products`, `/contact`, `/offerte`, `/vacatures`, `/about` | PASS `200` |
| CMS page (`/about`) | PASS |
| EN route `/en` | PASS `302` → `/` with `x-robots-tag: noindex, nofollow` (no separate EN document in this env) |
| Indexing safety: robots meta | PASS `noindex, nofollow` on all probed pages |
| `robots.txt` non-prod | PASS `Disallow: /` |
| Canonical never localhost/vercel | PASS — all `https://www.mccoy.nl…` |
| `og:url` absolute www | PASS |
| `sitemap.xml` | PASS — 9 locs, all `https://www.mccoy.nl…`, no draft/admin/preview/localhost |
| JSON-LD parse | PASS — CleaningService / WebPage+BreadcrumbList / JobPosting; www URLs; no invented aggregateRating |
| Metadata boundary | PASS — frozen deployed NL titles (e.g. Contact) via `frozen-deployed-seo.ts`; no SEO-8 copy |
| IndexNow | PASS (unit) — www allowlist only; fail-open; disabled when non-production (`disabled_non_production`) |
| Host redirects (curl Host override) | PASS — `mccoy.nl/contact?utm=1` → `301 https://www.mccoy.nl/contact?utm=1`; `www…/contact/` → `301 https://www.mccoy.nl/contact` |
| Visible body baseline | PASS `VISIBLE_BODY_CHANGED=false` |
| Playwright vs Vercel deploy | SKIP — Playwright MCP blocked; no Vercel storefront URL |

Production `https://www.mccoy.nl/robots.txt` still indexable (`Allow: /` + sitemap) — expected for prod; **not** used as evidence that this SEO tranche is deployed (remote HEAD unchanged).

## PASS/FAIL summary

| Field | Status |
|-------|--------|
| Pre-push clean tree / no secrets | PASS |
| Identify 5 SEO commits | PASS |
| `test:seo` | PASS |
| Typecheck (security/cms-schema/database/storefront) | PASS |
| Lint (root) | PASS |
| Lint (storefront eslint) | FAIL (CRLF environmental) |
| Storefront unit tests | PASS |
| Storefront build | PASS |
| Safe Mode invariants all false | PASS |
| Diff guard | PASS |
| Push `origin/development` | **FAIL** |
| Vercel storefront development deploy URL | **FAIL** / unavailable |
| Live deploy smoke on SEO HEAD | **FAIL** (blocked by push) |
| Local prod-runtime SEO probes | PASS |
| IndexNow / canonical / robots / sitemap / JSON-LD (local+unit) | PASS |
| No SEO-8 / MG5 / MR / content | PASS |

## Classification

**SEO_DEV_BLOCKED**

### Blockers to clear for SEO_DEV_ACCEPTED

1. Restore GitHub SSH access for `id_ed25519_mccoy` (or authorized alternate) and `git push origin development`.
2. Confirm Vercel storefront project builds `development` and obtain the stable development URL.
3. Re-run Steps 4–14 against that URL (smoke, noindex, canonical www, robots/sitemap, JSON-LD).
4. Optionally normalize storefront CRLF / Prettier so `lint:storefront` is green on Windows CI agents.

### Explicit non-actions

- Did not push or merge `main`
- Did not start SEO-8 / content / location-page work
- Did not run MG5 apply or MR kickoff
- Did not change SEO architecture beyond existing tranche commits
