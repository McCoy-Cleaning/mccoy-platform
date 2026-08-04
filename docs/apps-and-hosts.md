# Apps & hosts — McCoy monorepo

This repository is an **npm workspaces monorepo** with two independently deployable product surfaces:

| Host | App | Package |
|------|-----|---------|
| `www.mccoy.nl` / `mccoy.nl` | Public website | `apps/storefront` (`@mccoy/storefront`) |
| `admin.mccoy.nl` | Administration panel | `apps/admin` (`@mccoy/admin`) |

Shared logic lives under `packages/*`. CMS **authoring** (`@mccoy/cms-editor`, `@mccoy/content-ai`) is Admin-only. Storefront keeps shared **rendering** (`@mccoy/cms-renderer`) and iframe edit/preview protocol helpers from `@mccoy/cms-schema`.

Deployment details: [docs/deployment/independent-app-deployments.md](deployment/independent-app-deployments.md).

## Local development

```bash
npm install
npm run dev:storefront   # http://localhost:5173
npm run dev:admin        # http://localhost:5174
```

Production-like local servers (compressed `srvx` when using `start`):

```bash
npm run build:storefront && npm run start:storefront   # http://localhost:4173
npm run build:admin && npm run start:admin             # http://localhost:4174
# Or: npm run preview:storefront / npm run preview:admin
```

### Lighthouse / performance audits

Run mobile Lighthouse against a **production build**, not `vite dev` (`localhost:5173`):

```bash
npm run build:storefront && npm run preview:storefront   # http://localhost:4173
```

Then Chrome DevTools → Lighthouse → Mobile → Performance (throttling: Simulated / applied 4G).

Vite DEV will not score ≥90: unminified modules, HMR, and no production asset graph. Treat DEV scores as directional only.

Production-oriented wins already in the storefront shell:

- Self-hosted Archivo (`/fonts/*.woff2`) — no Google Fonts CSS waterfall
- Inline dark critical CSS before the main stylesheet
- Deferred CMS edit stack + idle published-bundle hydrate
- Lazy below-fold home sections / Footer; Motion chunked off the home fixed-section path

Vite dev serves unminified source maps and large transformed modules, so “Minify JS”, “Enormous network payloads”, and unused-JS estimates are mostly **dev noise**. Prefer opportunities that also apply to the preview/production bundle (images, fonts, LCP preload, code-splitting).

Convenience: `npm run dev` starts the storefront only (no `/admin*` routes).

Optional hosts file aliases:

```
127.0.0.1 www.mccoy.local admin.mccoy.local
```

```
ADMIN_HOST=admin.mccoy.local
PUBLIC_HOST=www.mccoy.local
HOST_ENFORCE=strict
```

Then run storefront on 5173 and admin on 5174.

## Production mapping

Point DNS/CDN:

- `www.mccoy.nl` / `mccoy.nl` → storefront Vercel project
- `admin.mccoy.nl` → admin Vercel project

```
ADMIN_HOST=admin.mccoy.nl
PUBLIC_HOST=www.mccoy.nl,mccoy.nl
HOST_ENFORCE=strict
```

Storefront host middleware uses `app: "storefront"` and redirects `/admin*` to `ADMIN_HOST`. Admin uses `app: "admin"` and redirects `/` → `/admin`.

Infrastructure paths such as `/_serverFn/*` are never host-gated.

## Env

Root `.env` / `.env.example` (both apps set `envDir` to the monorepo root):

- `SMTP_*` — Nodemailer SMTP for outbound mail (forms fallback, replies fallback, invites). Works independently of inbox read provider
- `FORM_TO_EMAIL`, `FORM_FROM_EMAIL`, `SMTP_REPLY_TO` — notification recipient / From / Reply-To
- `FORM_INBOX_PROVIDER` — `imap` | `graph` | `auto` (default `auto`). **M365 → `graph` (or `auto` + Graph env)** for Admin → Aanvragen reads. `imap` is for Gmail App Password style; M365 IMAP basic auth fails fast
- `MICROSOFT_GRAPH_*` / `TENANT_ID` + `CLIENT_ID`|`APPLICATION_ID` + `CLIENT_SECRET` + `GRAPH_MAILBOX` — Entra app-only credentials for Aanvragen reads **and** form notification send (`Mail.Send` as `GRAPH_MAILBOX`; SMTP is fallback only)
- `FORM_INBOX_*` — optional IMAP overrides (Gmail-style); not recommended for `outlook.office365.com`
- `ADMIN_*` — admin credentials + session secret (**Admin Vercel project only**)
- `ADMIN_HOST`, `PUBLIC_HOST`, `HOST_ENFORCE` — host routing
- `MCCOY_ALLOW_INDEXING` — storefront crawl override (`1` force allow, `0` force deny). Default: allow only when `VERCEL_ENV=production`; preview/local/staging stay `noindex` (see `packages/security/src/indexing.ts`)
- `MCCOY_DATA_DIR` — optional override for local/file CMS and request stores
- `GROQ_*` — content AI (**Admin only**)

## Website requests / Aanvragen

**Admin → Aanvragen** lists mailbox mail via Microsoft Graph when `FORM_INBOX_PROVIDER` is `graph` or `auto` with Graph credentials configured. IMAP is for Gmail App Password style hosts; Microsoft 365 blocks IMAP basic auth (fail-fast). Public form submit notifies staff via **Graph Mail.Send** as `GRAPH_MAILBOX` (SMTP is fallback only). Do not associate guest submissions with a company solely by email match. Escape customer content when displaying.

## CMS live edit

Admin embeds the Storefront origin in an iframe (`VITE_STOREFRONT_ORIGIN`). Storefront accepts `_cmsMode=edit` and `/cms-preview` for draft/preview rendering only — not staff authoring chrome.
