---
name: seo-review
description: >-
  Report-only McCoy technical SEO review for the public storefront (titles,
  canonicals, robots, SSR content, locales). Use for R8 seo-review or public
  route meta qualification — not keyword-density opinions.
disable-model-invocation: true
---

# SEO review (report-only)

## PURPOSE

Verify public storefront technical SEO correctness with evidence from routes/SSR.

## SCOPE

Public storefront only: `/`, producten, services, over-ons, contact, offerte, vacatures, privacy/terms, custom CMS pages; sitemap/robots if present.

## INPUTS

Route `head` helpers; `tanstackHeadFromCms`; `npm run review:r8 -- --review seo`; representative HTTP/SSR checks when environment allows.

## OUT OF SCOPE

Keyword density; inventing mandatory schema.org types; Admin SEO; MG5 apply.

## REQUIRED EVIDENCE

Actual title/description/canonical/robots/H1 from code or rendered output.

## REVIEW PROCEDURE

1. For representative routes check title, description, canonical, robots, indexability, H1, heading structure.
2. Locale URLs / hreflang if implemented; OG; structured data only if present.
3. SSR/indexable content; accidental noindex; broken canonicals; sitemap/robots; 404/redirects.
4. Emit findings per [finding-contract.md](../_shared/finding-contract.md) → `docs/reviews/r8-seo-review.md`.

## SEVERITY RULES

- blocker/high: major public routes missing title/canonical or wrongly noindexed
- medium: incomplete meta on secondary routes
- low/info: optional enhancements

## FALSE-POSITIVE RULES

Do not invent business-required JSON-LD types. Preview/admin routes may be noindex by design.

## OUTPUT FORMAT

Common finding contract with route evidence.

## NO-AUTO-FIX POLICY

Report only by default.

## EXAMPLES

- Finding: producten route omits canonical → high if confirmed in head output
- Non-finding: “add FAQ schema” without product requirement → info
