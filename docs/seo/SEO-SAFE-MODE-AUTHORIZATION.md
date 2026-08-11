# SEO Safe Mode — Authorization marker

```
SEO_SAFE_MODE_AUTHORIZED
```

## Tranche

**Phase 6 — On-page titles, meta descriptions, and H1 semantics** (SEO Migration Hardening).

**Phase 7 — Services modal SSR + hash anchors** (same authorization window; no visual redesign; no new service landing pages).

**Phase 10 — Image alts + performance SEO report** (alt text / decorative markers only; no visual redesign; no cms-renderer edits).

## Explicit authorization

Full on-page SEO is authorized for this tranche:

- Deploy factual NL/EN titles and meta descriptions (frozen deployed SEO)
- Change H1/H2/H3 **tags** and heading **copy** where needed
- **Zero visual redesign** — same CSS classNames / layout
- Remove ranking `<meta name="keywords">` stuffing from public heads
- Refresh visible-body / visual fingerprints after intentional copy/semantics
- Phase 7: SSR one real instance of each service `full` body + crawlable `/services#…` (and `/en/services#…`) links — **not** an `sr-only` duplicate; dedicated service landings remain deferred
- Phase 10: replace generic image alts (`Image` / `Afbeelding` / empty) with concise descriptive alts or `alt=""` for decorative; performance report for key routes

## Still forbidden

- `packages/cms-renderer` block views / registries (unless a later phase authorizes)
- MG5 apply / MR kickoff
- Producten commerce content / Aanvragen / auth
- Invented reviews, ratings, prices, or thin EN legal copy

## Diff guard

`scripts/seo/safe-mode-diff-guard.mjs` accepts this file when it contains `SEO_SAFE_MODE_AUTHORIZED`.