# Google Analytics 4 (storefront)

Consent-gated GA4 (`gtag`) for the public storefront. Scripts load **only after** the visitor accepts analytics cookies.

## Vercel env (storefront project)

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_GA_MEASUREMENT_ID` | One of these IDs | `G-XXXXXXXX` |
| `GA_MEASUREMENT_ID` | Alias (server / Vercel env, no `VITE_` prefix) | `G-XXXXXXXX` |
| `GOOGLE_ANALYTICS_MEASUREMENT_ID` | Alias | `G-XXXXXXXX` |
| `VITE_GA_ENABLE_DEV` | No | `1` — local/preview only. Production still requires a measurement ID. |

`VITE_*` values are baked at **build** time. Server aliases (`GA_MEASUREMENT_ID`, `GOOGLE_ANALYTICS_MEASUREMENT_ID`) are read at SSR and injected as `window.__MCCOY_GA_MEASUREMENT_ID__`, so production can work without the `VITE_` prefix after a storefront redeploy. Locally they are read from the **repo root** `.env` / `.env.local`. Restart `vite` after changing them.

Also add the same keys (commented) to root `.env.example` if missing:

```bash
# VITE_GA_MEASUREMENT_ID=G-XXXXXXXX
# GA_MEASUREMENT_ID=G-XXXXXXXX
# GOOGLE_ANALYTICS_MEASUREMENT_ID=G-XXXXXXXX
# VITE_GA_ENABLE_DEV=1
```

## Behaviour

1. Consent banner appears when runtime is allowed **and** a valid measurement ID is set. `VITE_GA_ENABLE_DEV` without an ID is local/design preview only (no fake production banner). Two explicit buttons (Alleen noodzakelijk / Accepteer analytics cookies); banner copy does not describe script-load timing.
2. Runtime is allowed in production builds, or when `VITE_GA_ENABLE_DEV` is truthy (`1` / `true` / `yes`).
3. Choice is stored in `localStorage` **and** a first-party cookie, both keyed `mccoy-analytics-consent` (`granted` | `denied`), so SSR/other tabs can see it.
4. Consent Mode v2: default `analytics_storage` / ads denied (`wait_for_update: 500`) before any `gtag` config. On accept: `gtag('consent', 'update', { analytics_storage: 'granted' })`, then load `gtag.js` and send `page_view` in the same turn. On reject: keep denied and do not load gtag.
5. CMS bridge routes (`/cms-preview`, `/cms-sync`) never show the banner or load GA.
6. `@vercel/analytics` remains separate (cookieless); left enabled.
7. GA config uses `send_page_view: false`; the TanStack Router integration emits one explicit `page_view` for the initial accepted page and each SPA pathname change.
8. Page-view payloads contain only the pathname (including `/en` locale prefixes), origin, public document title, and measurement target. Query strings and hashes are excluded.
9. Storefront CSP allows the gtag script and explicit collection hosts (`www.googletagmanager.com`, `www.google-analytics.com`, `region1.google-analytics.com`, `analytics.google.com`); it does not use bare `https:` or `wss:` in `connect-src`.

## Local preview (PowerShell)

From the monorepo root, ensure root `.env` includes at least:

```powershell
# Banner only (no gtag):
# VITE_GA_ENABLE_DEV=1

# Full consent + gtag on localhost:
# VITE_GA_MEASUREMENT_ID=G-XXXXXXXX
# VITE_GA_ENABLE_DEV=1
```

Then restart the storefront dev server (env is baked at process start):

```powershell
cd apps\storefront
npm run dev
```

Clear a prior choice so the banner shows again:

```powershell
# In DevTools → Application, delete localStorage and cookie:
# mccoy-analytics-consent
```

If `VITE_GA_ENABLE_DEV=1` but the measurement ID is missing, the banner still appears and the console warns that gtag will not load.

## Privacy copy

Default seed text in `packages/cms-schema/src/legal-defaults.ts` discloses necessary tech + consent-gated GA4. **Published CMS privacy does not auto-update from seeds** (`seedBuiltinsIfEmpty` only fills empty builtins). Live `https://www.mccoy.nl/privacy` must be updated in Admin and republished.

### Admin — update live cookies article (required for production)

1. Open Admin CMS → page **Privacyverklaring** (`/privacy`).
2. Find the article **Cookies, of vergelijkbare technieken, die wij gebruiken**.
3. Replace the body with the NL text below (same as `defaultPrivacyMainContent()` in `legal-defaults.ts`).
4. Optionally bump **laatst bijgewerkt** (seed uses `augustus 2026`).
5. **Opslaan** / publish NL.
6. EN: privacy has no full EN article overlays by default (only a seeded EN page heading after MG5). If EN article overlays exist, paste the EN block below into the matching article body, then republish EN. Otherwise leave EN as Dutch bleed / existing noindex behaviour.

**NL body (paste):**

```text
McCoy Cleaning B.V. gebruikt cookies en vergelijkbare technieken op deze website.

Noodzakelijk
Wij gebruiken noodzakelijke cookies en/of lokale opslag die nodig zijn voor de werking van de website. Denk hierbij aan het onthouden van je taalvoorkeur, het opslaan van je cookievoorkeur (localStorage) en, voor zover van toepassing, sessie- of beveiligingstechnieken. Voor deze technieken is geen toestemming vereist.

Optionele analytics
Voor niet-noodzakelijke statistieken vragen wij apart toestemming via de cookiebanner. Kies je Accepteer, dan laden wij Google Analytics 4 (Google Ireland Limited / Google LLC) om te begrijpen hoe bezoekers de website gebruiken en om de website te verbeteren (onder meer paginaweergaven en technische gegevens zoals browser of apparaat). Analytics-scripts en bijbehorende cookies worden niet geladen zolang je analytics niet hebt geaccepteerd. Kies je Alleen noodzakelijk, dan laden wij geen Google Analytics.

Google kan gegevens (mede) verwerken in landen buiten de Europese Economische Ruimte (EER). Waar van toepassing gebeurt dit met passende waarborgen, zoals door Google gehanteerde standaardcontractbepalingen. De bewaartermijn van analyticsgegevens volgt de Google Analytics-instellingen in ons account.

Je kunt toestemming weigeren of later intrekken door Alleen noodzakelijk te kiezen, door in je browser de lokale opslag (localStorage) van deze website te wissen, of via je browserinstellingen cookies en sitegegevens van mccoy.nl te verwijderen. Daarna verschijnt de banner opnieuw. Meer informatie over je rechten staat elders in deze privacyverklaring.

Daarnaast kan Vercel Web Analytics actief zijn. Dat is een cookieloze, geaggregeerde meting van websitebezoek en valt buiten de analytics-cookiebanner.
```

**EN body (only if EN article overlays are maintained):**

```text
McCoy Cleaning B.V. uses cookies and similar technologies on this website.

Necessary
We use necessary cookies and/or local storage required for the website to function. This includes remembering your language preference, storing your cookie preference (localStorage) and, where applicable, session or security technologies. These techniques do not require consent.

Optional analytics
For non-essential statistics we ask for separate consent via the cookie banner. If you choose Accept, we load Google Analytics 4 (Google Ireland Limited / Google LLC) to understand how visitors use the website and to improve it (including page views and technical data such as browser or device). Analytics scripts and related cookies are not loaded until you accept analytics. If you choose Necessary only, we do not load Google Analytics.

Google may process data in countries outside the European Economic Area (EEA). Where applicable, this is done with appropriate safeguards, such as standard contractual clauses used by Google. Analytics retention follows the Google Analytics settings in our account.

You can refuse or later withdraw consent by choosing Necessary only, by clearing this site’s local storage (localStorage) in your browser, or by removing cookies and site data for mccoy.nl in your browser settings. The banner will then appear again. More information about your rights is set out elsewhere in this privacy statement.

Vercel Web Analytics may also be active. That is a cookieless, aggregated measurement of website visits and falls outside the analytics cookie banner.
```

This is product privacy disclosure for the storefront, not formal legal advice.

## Verify

1. Production (or local with measurement ID + `VITE_GA_ENABLE_DEV`): open site → Network must **not** show `gtag/js` before consent.
2. Click **Accepteer analytics cookies** → request to `www.googletagmanager.com/gtag/js?id=G-…` (only when ID is set).
3. Reload → no banner; gtag loads again (consent persisted).
4. Navigate between two storefront routes without reloading → one `g/collect` request with `en=page_view` per navigation; verify `dl`/`dp` uses the current pathname and contains no query values.
5. Open `/cms-preview` or `/cms-sync` directly → no banner, `gtag/js`, or GA collect request.
6. Clear `localStorage` key `mccoy-analytics-consent` **and** the same-named cookie to re-test the banner.
7. Local with only `VITE_GA_ENABLE_DEV=1`: banner appears; Network must still show no `gtag/js`. Production with enableDev and no ID must not show the banner.
