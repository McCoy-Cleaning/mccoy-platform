# Locale EN gaps — Phase 3 (SEO Migration Hardening)

Documented **2026-08-11**. Does **not** invent English marketing or legal copy.

Companion: [`mccoy-seo-baseline.md`](./mccoy-seo-baseline.md), [`docs/cms-i18n-runtime.md`](../cms-i18n-runtime.md).

## Architecture (unchanged)

- Dual NL + `/en` product surfaces.
- Pending / missing EN → **302** to Dutch sibling (`resolveEnglishPathAccess`).
- Published EN body = NL base + `enFieldDrafts` overlays (`localizeCmsPageForLocale`).
- Hreflang / sitemap alternates = **published + indexable** only (`getPublishedLocaleAlternates` + `indexable` flag).

## Gaps found

| Surface | Issue | Phase 3 action | Deferred |
|---------|--------|----------------|----------|
| `/en/terms` | Live title/body still Dutch (“Algemene voorwaarden”) when EN published without overlays | **noindex,follow** on EN resolve when legal Dutch bleed; **omit EN from hreflang** on NL+EN heads/sitemap | Operator: add factual EN legal overlays, then republish EN (lifts noindex) |
| `/en/privacy` | Same Dutch-bleed risk | Same automatic noindex + hreflang omit | Same |
| `/en/offerte` | EN unpublished → 302 `/offerte` | Kept (existing policy) | Publish EN only with real overlays |
| Thin marketing EN | Partial overlays → NL fallback for missing fields | Document only; do not invent copy; hreflang allowed when EN is published + indexable | Editorial translate-missing / Opslaan sync |
| Seeds `localeStates.en` | Previously marked `published` in seed helpers | Aligned to **missing** (matches `seedBuiltinsIfEmpty`) | — |

## Hreflang acceptance (automated)

For every **emitted** NL↔EN alternate pair, tests assert:

1. Peer alternate exists  
2. Peer policy = published + HTTP 200 (not 302/301/404/410)  
3. Peer indexable (no `noindex`)  
4. Correct `inLanguage` / URL locale  
5. Self-canonical matches hreflang href  
6. Reciprocal hreflang back to origin  

Never emit hreflang toward unpublished, redirected, noindex, or missing pages.

## Consolidation note (`/en/terms`)

Until factual English terms exist in CMS overlays:

- `/en/terms` may still **render** (if EN locale is published) so editors can preview, but crawlers get **noindex**.
- NL `/terms` does **not** advertise `hreflang=en`.
- Preferred end state: EN legal overlays + republish → indexable reciprocal pair. Alternative operator choice: unpublish EN legal locales entirely (302 to NL) — not required for Phase 3 if noindex is in place.

## `og:locale`

- URL `/…` (NL) → `og:locale=nl_NL` (+ alternate `en_GB`)
- URL `/en…` → `og:locale=en_GB` (+ alternate `nl_NL`)
- Root fallback alternate aligned to `en_GB` (was `en_US`).
