# Independent Admin and Storefront deployments

**Updated:** 2026-07-23  
**Repository:** McCoy npm workspaces monorepo  
**Verdict:** **READY WITH CONFIGURATION**

Code and CI support two independently deployable apps from one GitHub repository. Dual Vercel **projects** still require dashboard linking (Root Directory, domains, env, Include files outside root). Those settings cannot be proven from git alone.

---

## Architecture (target = current code)

```text
GitHub monorepo
├── apps/admin          → Vercel project (Root Directory: apps/admin)
├── apps/storefront     → Vercel project (Root Directory: apps/storefront)
├── packages/*
│   ├── cms-schema      # shared contracts + iframe postMessage protocols
│   ├── cms-renderer    # shared public/admin render
│   ├── cms-editor      # Admin-only authoring
│   ├── content-ai      # Admin-only
│   └── …               # shared domain/email/security/ui/…
├── supabase/*
└── e2e/*               # Playwright starts both apps for CMS bridge tests
```

| Host | App | Package |
|------|-----|---------|
| `www.mccoy.nl` / `mccoy.nl` | Storefront | `@mccoy/storefront` |
| `admin.mccoy.nl` | Admin | `@mccoy/admin` |

Local: storefront `:5173`, admin `:5174`. Both Vite configs set `envDir` to the monorepo root.

---

## Package boundaries (enforced)

| Package | Class | Storefront | Admin |
|---------|-------|:----------:|:-----:|
| `@mccoy/cms-editor` | **Admin-only** | No (package + imports) | Yes |
| `@mccoy/content-ai` | **Admin-only** | No | Yes |
| `@mccoy/cms-schema` | Shared (render + protocol) | Yes | Yes |
| `@mccoy/cms-renderer` | Shared rendering | Yes | Yes |
| Other `@mccoy/*` | Shared | As needed | As needed |

**Storefront must not:**

- Ship `/admin*` route modules
- Declare or import `@mccoy/cms-editor`
- Contain CMS authoring UI (PageEditor, InlineEdit, staff auth)

**Storefront may:**

- Render published CMS via `@mccoy/cms-renderer`
- Host iframe live-edit / preview consumers (`_cmsMode=edit`, `/cms-preview`, postMessage protocols in `cms-schema`)
- Use a **local** `EditInteractionGuard` (not the editor package)

**Boundary tests:** `packages/cms-schema/src/no-static-cms-editor-import.test.ts`

---

## Dependency graphs

### Admin

```text
apps/admin
├── @mccoy/cms-schema, cms-renderer, cms-editor
├── @mccoy/content-ai
├── @mccoy/database, domain, email, security, ui, validation
```

### Storefront

```text
apps/storefront
├── @mccoy/cms-schema, cms-renderer
├── @mccoy/database, domain, email, security, ui, validation
└── (no cms-editor, no content-ai)
```

Host middleware: Storefront uses `app: "storefront"` (redirects `/admin*` → `ADMIN_HOST`). Admin uses `app: "admin"`.

---

## Change-impact matrix

| Changed path | Admin CI/build | Storefront CI/build | Notes |
|--------------|:--------------:|:-------------------:|-------|
| `apps/admin/**` | Y | N* | |
| `apps/storefront/**` | N* | Y | |
| `packages/cms-editor/**` | Y | N* | Admin-only filter in CI + Vercel ignore |
| `packages/content-ai/**` | Y | N | |
| `packages/cms-schema/**` / `cms-renderer/**` | Y | Y | Shared contracts |
| Other shared packages / lockfile / `scripts/` / `supabase/` | Y | Y | |
| Docs only | N | N | |

\*When path filters / `scripts/vercel-ignore.mjs` are active.

---

## GitHub Actions

| Workflow | Purpose |
|----------|---------|
| `.github/workflows/app-checks.yml` | Stable jobs `admin-checks`, `storefront-checks`, `shared-checks` + cms-editor boundary test; skip heavy work when unaffected |
| `.github/workflows/cms-e2e.yml` | Full CMS Playwright (both apps) — do **not** weaken lifecycle/security coverage |

Root scripts:

- `npm run check:admin`
- `npm run check:storefront`
- `npm run check:shared`

Require these job names (plus CMS E2E as appropriate) on branch protection.

---

## Vercel (in-repo + dashboard)

### In repository

| File | Role |
|------|------|
| `apps/admin/vercel.json` | `npm ci` from repo root, `build -w @mccoy/admin`, ignore via `vercel-ignore.mjs admin` |
| `apps/storefront/vercel.json` | Same for storefront |
| `scripts/vercel-ignore.mjs` | Exit 0 skip / 1 build based on `VERCEL_GIT_PREVIOUS_SHA` path set |

### Dashboard checklist (per project)

| Setting | Admin | Storefront |
|---------|-------|------------|
| Git repository | This monorepo | Same |
| Root Directory | `apps/admin` | `apps/storefront` |
| Include files outside Root Directory | **On** | **On** |
| Production branch | `main` | `main` |
| Staging | `staging` (or separate staging projects) | Same |
| Domains | `admin.mccoy.nl` | `www.mccoy.nl`, `mccoy.nl` |
| Env | Admin secrets + `GROQ_*`, staff, inbox | Public + form SMTP; **no** `GROQ_*` / staff invite |

`.vercel/project.json` is local linking only — not committed. Linking both projects locally is optional for CLI deploys.

---

## Environment ownership (names only)

| Variable | Admin | Storefront |
|----------|:-----:|:----------:|
| `VITE_SUPABASE_*` / `SUPABASE_URL` / publishable | Y | Y |
| `SUPABASE_SECRET_KEY` | Y | Only if storefront server fns need it |
| `VITE_ADMIN_ORIGIN` / `VITE_STOREFRONT_ORIGIN` | Y | Y |
| `ADMIN_HOST` / `PUBLIC_HOST` / `HOST_ENFORCE` | Y | Y |
| `ADMIN_*` session / legacy auth | Y | N |
| `GROQ_*` / `STAFF_INVITE_*` | Y | N |
| `SMTP_*` / `FORM_*` | Inbox/reply as needed | Form notify as needed |

Never put secrets in `VITE_*`.

---

## Release notes for shared CMS

1. Prefer expand-and-contract on schema/protocol changes.
2. Deploy **Storefront** before Admin when Storefront must understand a new published shape before Admin publishes it.
3. Protocol changes to iframe postMessage require both apps (and CMS E2E).

---

## Terminology

One git push ≠ two histories. **Independent deployment** means scoped commits where possible, two Vercel projects with separate rollbacks, and CI/build graphs that skip the unaffected app when safe. A two-repo split is **not** recommended: shared CMS + Supabase still force coordination.

---

## Verification commands

```bash
npm run check:shared
npm run check:admin
npm run check:storefront
npm run test -w @mccoy/cms-schema -- --run src/no-static-cms-editor-import.test.ts
npm run test:e2e
```
