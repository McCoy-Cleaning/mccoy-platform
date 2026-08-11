# SEO-1 — Search engines & IndexNow (operator checklist)

Human-only. No automatic external profile edits.

**Post-deploy runbooks (Phase 12):**

- Google: [`search-console-post-deploy.md`](./search-console-post-deploy.md)
- Bing: [`bing-post-deploy.md`](./bing-post-deploy.md)

Use those after production ships Phases 2–11. This file remains the short kickoff stub.

## Google Search Console

1. Confirm property `https://www.mccoy.nl` (URL-prefix or Domain).
2. Verify ownership (DNS or HTML file).
3. Submit sitemap `https://www.mccoy.nl/sitemap.xml`.
4. Inspect apex `mccoy.nl` redirect → www (one hop preferred).
5. Review Coverage / Pages for noindex on preview hosts (should be absent from property).

## Bing Webmaster Tools

1. Import from GSC or verify `https://www.mccoy.nl`.
2. Submit the same sitemap.
3. Configure IndexNow key matching production `INDEXNOW_KEY`.
4. Confirm key file `https://www.mccoy.nl/{INDEXNOW_KEY}.txt` returns the key.

## Google Business Profile / Places

1. Align NAP with `nap-canonical.md`.
2. Primary category and service area (Twente / Oldenzaal) — operator decision.
3. Do not invent review counts in GBP or on-site JSON-LD.

## IndexNow (production)

| Item | Value |
|------|-------|
| Env | `INDEXNOW_KEY` (server-only, never client) |
| Key file | `apps/storefront/public/{key}.txt` or hosting equivalent |
| Host | `www.mccoy.nl` only |
| Failure | Publish remains successful |

## Sign-off

| Step | Owner | Date | Done |
|------|-------|------|------|
| GSC sitemap | | | |
| Bing sitemap | | | |
| IndexNow key live | | | |
| GBP NAP aligned | | | |
