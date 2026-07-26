# McCoy Cleaning — monorepo

Custom B2B / marketing platform for McCoy Cleaning (TanStack Start + Vite).

## Layout

```
apps/
  storefront/   # Public site (www.mccoy.nl) — no CMS authoring
  admin/        # Admin app (admin.mccoy.nl) on port 5174
packages/
  domain/       # Form kinds, request types, labels
  validation/   # Zod schemas
  database/     # Website-requests store (JSON file; Postgres next)
  email/        # SMTP + Microsoft Graph / IMAP adapters (`/contracts`, `/server`)
  security/     # Admin session, host helpers, rate limit, env
  ui/           # Shared primitives (cn, Button)
  cms-schema/   # Shared CMS contracts + iframe protocols
  cms-renderer/ # Shared public/admin render
  cms-editor/   # Admin-only authoring
  content-ai/   # Admin-only
```

## Local development

Install from the repo root (npm workspaces):

```bash
npm install
```

Copy env:

```bash
cp .env.example .env
```

Run:

| Command | What | URL |
|---------|------|-----|
| `npm run dev` / `npm run dev:storefront` | Storefront | http://localhost:5173 |
| `npm run dev:admin` | Admin app | http://localhost:5174/admin/login |

Typecheck / scoped checks:

```bash
npm run typecheck:packages
npm run typecheck:apps
npm run check:admin
npm run check:storefront
npm run check:shared
```

Independent deploy readiness: [docs/deployment/independent-app-deployments.md](docs/deployment/independent-app-deployments.md). Hosts: [docs/apps-and-hosts.md](docs/apps-and-hosts.md).

Website form submissions notify `FORM_TO_EMAIL` via SMTP (Nodemailer). **Admin → Aanvragen** syncs the mailbox via Microsoft Graph and/or IMAP depending on `FORM_INBOX_PROVIDER` (`imap` | `graph` | `auto`). For Microsoft 365 use `graph` (or `auto` + Graph env); `imap` is for Gmail App Password style — M365 blocks IMAP basic auth. SMTP can still send while Graph handles reads.
