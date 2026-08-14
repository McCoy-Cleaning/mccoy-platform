# Google Analytics 4 (storefront)

Consent-gated GA4 (`gtag`) for the public storefront. Scripts load **only after** the visitor accepts analytics cookies.

## Vercel env (storefront project)

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_GA_MEASUREMENT_ID` | Yes (to enable) | `G-MVMC3FS5GK` |
| `VITE_GA_ENABLE_DEV` | No | `1` — allow GA on localhost / non-prod builds |

`VITE_*` values are baked at **build** time — set them on the storefront Vercel project, then **redeploy**.

Also add the same keys (commented) to root `.env.example` if missing:

```bash
# VITE_GA_MEASUREMENT_ID=G-XXXXXXXX
# VITE_GA_ENABLE_DEV=1
```

## Behaviour

1. Banner appears when measurement ID is set and runtime is allowed (production, or `VITE_GA_ENABLE_DEV`).
2. Choice is stored in `localStorage` key `mccoy-analytics-consent` (`granted` | `denied`).
3. `gtag.js` loads from `googletagmanager.com` only after `granted`.
4. CMS bridge routes (`/cms-preview`, `/cms-sync`) never show the banner or load GA.
5. `@vercel/analytics` remains separate (cookieless); left enabled.

## Privacy copy

Default seed text in `packages/cms-schema/src/legal-defaults.ts` discloses GA4 + consent. If the live `/privacy` page is CMS-published, update the cookies article in Admin to match (defaults alone do not overwrite published CMS content).

## Verify

1. Production (or local with both env vars): open site → Network must **not** show `gtag/js` before consent.
2. Click **Accepteer analytics cookies** → request to `www.googletagmanager.com/gtag/js?id=G-…`.
3. Reload → no banner; gtag loads again (consent persisted).
4. Clear `localStorage` key `mccoy-analytics-consent` to re-test the banner.
