# Follow-up recommendations (post-R8)

**Date:** 2026-08-08  
**Companion:** [`r8-final-verification.md`](./r8-final-verification.md)

## MUST BEFORE PRODUCTION

1. Positively identify a **separate safe staging Supabase** project; set `MCCOY_ENVIRONMENT`, staging/production project allowlists; complete MG5 staging persisted-data dry-run before any apply.
2. Keep MG5 production apply **NO-GO** until staging cohort GO and operator confirmations.
3. Do **not** start MR legacy fixed-section retirement until staging/production persisted-data migration evidence exists.

## SHOULD SOON

1. Fix Admin CMS editor `Maximum update depth exceeded` during custom-page EN publish (BR-001) so `test:e2e:locale` is fully green without failureSink masking.
2. Reduce cms-media noisy failures when Supabase is intentionally unset in E2E (graceful empty list).
3. Run `test:e2e:quality` (axe/responsive/security browser) on a clean port pair as a scheduled gate.

## OPTIONAL IMPROVEMENT

1. Promote Producten/About presentation markup into `@mccoy/cms-renderer` for admin-canvas parity (post-MG5 candidate).
2. Further split Contact/Offerte/Vacatures storefront modules if they grow.
3. Expand deterministic R8 checks (SEO head presence, a11y unlabelled inputs) beyond current architecture/security/ui detectors.

## OPERATIONS HOLD

1. **MG5 staging qualification** needs a positively identified safe staging Supabase target before staging dry-run/apply (`PL-001`).
2. Production migration credentials and confirm-phrase operator runbook remain unused until GO.

## FUTURE HARDENING

1. Fully server-proxied MFA removing any temporary browser refresh-token exposure (already constrained to memory MFA client).
2. Broader supply-chain monitoring beyond ad-hoc `npm audit` when CI policy is defined.
3. Optional `@mccoy/ui` promotion only for proven cross-app primitives (R8 skills gate remains report-only).
