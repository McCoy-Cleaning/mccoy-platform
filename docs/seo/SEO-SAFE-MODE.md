# SEO Safe Mode — Protected Invariants

McCoy SEO work must not change visible site composition, copy, or protected product surfaces unless explicitly authorized outside Safe Mode.

## Locked invariants (this program)

| Flag | Required value | Meaning |
|------|----------------|---------|
| `SECTION_LOGIC_CHANGED` | `false` | No edits to CMS section composition / block views / registries used for rendering |
| `VISIBLE_COPY_CHANGED` | `false`* | No deployed NL/EN marketing copy changes in page bodies |
| `VISIBLE_BODY_CHANGED` | `false`* | Normalized visible body fingerprint unchanged vs baseline |
| `EN/NL_FIELDS_CHANGED` | `false` | No CMS locale field mutations for SEO content work |
| `VISUAL_STYLING_CHANGED` | `false` | No CSS/layout/visual redesign for SEO |
| `PRODUCTEN/AANVRAGEN/AUTH_CHANGED` | `false` | Producten content, Aanvragen flows, auth untouched |
| `MG5_EXECUTED` | `false` | No MG5 apply |
| `MR_STARTED` | `false` | No merge-request / migration-run kickoff from this program |

\* **Phase 6 exception:** on-page titles, meta descriptions, and H1 semantics/copy are explicitly authorized (`docs/seo/SEO-SAFE-MODE-AUTHORIZATION.md`). Refresh visible-body baselines after those intentional changes. Layout/CSS classNames remain unchanged.

`HEAD_TECHNICAL_OUTPUT_CHANGED` may list technical head/crawl changes only (absolute canonicals, robots, sitemap, IndexNow, JSON-LD structure without invented claims).

## Forbidden without explicit authorization

SEO tranche diffs must not touch:

- `packages/cms-renderer` block views / `RegisteredBlockView` / `SitePageSections`
- Block registries and fixed/block compatibility layers
- CMS migration logic (including MG5 apply paths)
- Translation schema / overlay mutation for SEO copy
- Producten content surfaces
- Aanvragen flows
- Authentication

Enforced by `scripts/seo/safe-mode-diff-guard.mjs` (wired into `npm run test:seo`).

## SEO-7 ≠ SEO-8

- **SEO-7** may centralize metadata resolution, absolute canonicals, and technical meta from **existing** CMS SEO fields or currently deployed hardcoded titles/descriptions.
- **SEO-8 / Phase 6:** factual title/description/H1 deploy is **authorized** for this migration hardening program. Deployed copy lives in `frozen-deployed-seo.ts` and is recorded in `docs/seo/proposed-metadata.md` with `DEPLOYED`. Do not invent unsupported claims or thin EN.

## Canonical host

Production canonical origin is always `https://www.mccoy.nl`.

Preview, localhost, admin, draft, and Vercel preview hosts must never become the canonical origin.

## IndexNow

Only submit `https://www.mccoy.nl/...` URLs. Publish must succeed if IndexNow fails (fail-open).

## Qualification

Final report: `docs/seo/seo-tranche-qualification.md`.
