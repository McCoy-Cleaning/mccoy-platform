# CMS Content AI (Phase E)

Editor-assisted Dutch copy and NL→EN drafts. AI **never** auto-publishes.

## What shipped

- `packages/content-ai` — `ContentAiProvider`, Groq, Zod parse, semantic checks (E4), source-hash cache (E5), audit provenance (E6)
- Admin server functions — auth + rate limit + server-only `GROQ_API_KEY`
- Inspector UX — Genereer NL / Vertaal naar EN (preview → Toepassen)

## Configure

```
GROQ_API_KEY=
# GROQ_MODEL=llama-3.1-8b-instant
# CMS_SITE_ORIGIN=https://www.mccoy.nl
```

## Verify

1. Edit field → Genereer NL → preview → Toepassen
2. Vertaal naar EN → apply to draft only (or wait for Opslaan auto-sync)
3. **Opslaan** auto-translates every NL text field (including nested column/card strings) into `enFieldDrafts`, and removes EN drafts for deleted/empty NL fields
4. Publish EN explicitly via LocalePublishPanel (Phase D) when you want `/en` public

See `docs/cms-i18n-runtime.md` for bilingual production gates.
