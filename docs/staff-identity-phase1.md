# Staff identity Phase 1 — bootstrap & Auth cutover

## Prerequisites

1. Supabase project with URL + **secret/service role** key in server env only:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `SUPABASE_PUBLISHABLE_KEY` (server)
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (browser — same publishable values; never the secret key)
2. Apply identity migrations under `supabase/migrations/2026071914*.sql` (after any earlier CMS stubs).
3. Auth: disable public signup in the dashboard (Authentication → Providers / settings).
4. Configure Auth redirect URLs for admin MFA onboarding (local / staging / production separately).

Do **not** grant `anon` / `authenticated` USAGE on `private` or any table rights there. Server code uses the service-role key with `.schema("private")`. PostgREST must list `private` in exposed schemas (migration `20260723170000_expose_private_schema_postgrest.sql`, or Dashboard → Project Settings → Data API → Exposed schemas). Still safe while grants exclude browser roles. Audit writes must not block login if private is unavailable. See `docs/cms-media-storage.md` for exact SQL / clicks.

## Apply migrations

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Or apply SQL via the owning account’s MCP / SQL editor in order of migration filenames.

## Admin login (Auth cutover — current)

When Supabase URL + publishable + secret keys are configured, `/admin/login` uses **Supabase Auth**:

1. Prefer browser `signInWithPassword` (publishable key via `VITE_SUPABASE_*`); if those are missing, the server signs in with the same publishable key
2. Server validates the JWT (`getUser`), loads `public.users`, enforces staff rules
3. HttpOnly cookies store access/refresh tokens (`mccoy_sb_*`); APIs call `requireAdminSession()` from `@mccoy/database`
4. If JWT `aal` is `aal1`, user is sent to `/admin/mfa` to enroll or verify TOTP (**requires `VITE_SUPABASE_*`** for the browser MFA client)
5. After `aal2`, invited staff are activated (`status = active`); audit best-effort

### Access rule (full admin APIs)

```
authenticated
AND account_kind = staff
AND staff_role in (super_admin, admin)
AND status = active
AND blocked_at is null
AND jwt.aal = aal2
```

First login while `status = invited` is allowed only for MFA onboarding (aal1 → enroll/verify). Full admin routes require aal2 (+ activation).

### Legacy ADMIN_* fallback

- Used automatically when Supabase is **not** configured
- Or when `ADMIN_LEGACY_AUTH=true` (dev-only escape hatch)
- When Supabase keys exist, Supabase takes precedence for email login; do not rely on `ADMIN_USERNAME` / `ADMIN_PASSWORD` in normal operation

Env:

- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — legacy only
- `ADMIN_SESSION_SECRET` — signs the lightweight session marker cookie
- `ADMIN_LEGACY_AUTH=true` — opt-in legacy path beside Supabase

Local URLs:

- Dedicated admin app: `http://localhost:5174/admin/login` (`npm run dev:admin`)
- Dedicated admin: `http://localhost:5174/admin/login`
- Storefront no longer ships `/admin*` (use the admin app)

## First super_admin (one-time)

```bash
# .env (never commit)
BOOTSTRAP_SUPER_ADMIN_EMAIL=you@mccoy.nl
BOOTSTRAP_SUPER_ADMIN_PASSWORD=<strong-temporary>
BOOTSTRAP_SUPER_ADMIN_NAME=McCoy Super Admin
BOOTSTRAP_CONFIRM=CREATE_FIRST_SUPER_ADMIN

node --env-file=.env scripts/bootstrap-super-admin.mjs
```

Creates:

1. Supabase Auth user (`email_confirm: true`)
2. `public.users` staff profile with `staff_role = super_admin`, `status = invited`

### Test login (e.g. maria@rekp.ai)

1. Ensure root `.env` has `SUPABASE_*`, `SUPABASE_SECRET_KEY`, and matching `VITE_SUPABASE_*`
   (admin/storefront Vite loads this via `scripts/vite-load-monorepo-env.ts` into `process.env` + `VITE_*`; restart after changes)

2. `npm run dev:admin`
3. Open `http://localhost:5174/admin/login`
4. Sign in with bootstrap email + `BOOTSTRAP_SUPER_ADMIN_PASSWORD`
5. Complete TOTP on `/admin/mfa`
6. Confirm dashboard loads; `public.users.status` becomes `active`
7. Remove `BOOTSTRAP_*` variables after success

## Invite administrators

Only an **active** `super_admin` session at **aal2** may invite. Invites create **`admin` only** (never `super_admin`).

### Server flow

1. Validate session + aal2 + `staff_role = super_admin`
2. Rate-limit invites per actor
3. Normalize email; reject if active invite or existing staff
4. Insert `private.staff_invitations` (`intended_role = admin` only, 7-day expiry)
5. Prefer branded delivery when Graph/SMTP is configured:
   - Auth Admin `generateLink({ type: "invite", redirectTo })`
   - Email CTA uses a **direct McCoy app link** (`/admin/invite?token_hash=&type=`) built from `hashed_token` — not the Supabase `action_link` host (avoids hosted verify/recovery UI and bad Site URL redirects)
   - Send McCoy HTML via `@mccoy/email` → Graph/SMTP
6. Fallback (no SMTP): Auth Admin `inviteUserByEmail` (Supabase sends the Invite template)
7. Insert `public.users` staff profile (`status = invited`, role `admin`)
8. Mark invitation `sent` + audit (`staff.invitation_created`, `staff.invitation_sent`)

Compensation if Auth succeeds but profile/email fails: mark invitation `failed`, store `auth_user_id`, reconcile manually.

### Invitee registration + MFA

1. Invitee opens the CTA → lands on `/admin/invite` with Auth invite tokens (`#access_token` / `type=invite` or `?code=`)
2. Browser establishes session; server cookies via `adminEstablishSession` (aal1 allowed)
3. Registration form: full name (if missing), password + confirm (min 8)
4. Password is set with authenticated `updateUser` (own account only — never trust client prices/roles)
5. Server marks invitation `accepted`, audits `staff.invite_password_set` + `staff.invitation_accepted`
6. Redirect to `/admin/mfa` for TOTP enroll/verify
7. After aal2, staff is activated (`staff.mfa_onboarding_completed`); full `/admin` access requires active + aal2

### Env

```bash
# Prefer explicit invite redirect (listed in Supabase Auth redirect allow-list)
STAFF_INVITE_REDIRECT_URL=http://localhost:5174/admin/invite
# Or rely on VITE_ADMIN_ORIGIN + /admin/invite
VITE_ADMIN_ORIGIN=http://localhost:5174

# Branded invite email (recommended) — uses Nodemailer SMTP
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASS=...
# Or reuse FORM_INBOX_USER / FORM_INBOX_PASS
STAFF_INVITE_FROM_EMAIL=McCoy Admin <noreply@your-domain>
# Falls back to FORM_FROM_EMAIL when STAFF_INVITE_FROM_EMAIL is unset
```

### Supabase Dashboard (required)

**Authentication → URL Configuration**

Add redirect URLs for each environment, for example:

- `http://localhost:5174/admin/invite`
- `https://admin.mccoy.nl/admin/invite` (production)
- Matching staging/preview origins (`https://*.vercel.app/admin/invite`)

Site URL may remain the admin origin (e.g. `https://admin.mccoy.nl`); invite emails land directly on `/admin/invite` but keep redirect URLs allow-listed for legacy `action_link` fallbacks and password reset.

**Do not** set Site URL to `*.supabase.co` or a bare Vercel URL without `/admin/invite` in the allow-list — misconfiguration still breaks legacy links and password reset.

**Authentication → Providers**

- Disable public signup (invites only).

### Auth Invite email template (required while Graph/SMTP cannot send branded mail)

Invites currently go through Supabase `inviteUserByEmail`, which uses the **Dashboard** Auth template — not the in-app Graph/SMTP HTML — until Graph has `Mail.Send`.

Apply the McCoy template (logo + Dutch copy + steps) in one of these ways:

1. **Script (recommended)**  
   - Create a token at https://supabase.com/dashboard/account/tokens  
   - Set `SUPABASE_ACCESS_TOKEN` in `.env`  
   - Run: `npm run apply:auth-invite-template`

2. **Dashboard**  
   - Open Authentication → Email Templates → **Invite user**  
   - Subject: `Uitnodiging voor McCoy Admin`  
   - Body: paste [`supabase/templates/invite.html`](../supabase/templates/invite.html) (same as [`docs/email/staff-invite-supabase-auth.html`](../email/staff-invite-supabase-auth.html))

Source of truth for Graph/SMTP later: `buildStaffInviteEmail()` / `buildStaffInviteSupabaseAuthTemplate()` in `@mccoy/email`.

## Blocking

Set `status = blocked` and `blocked_at = now()`. Prefer Auth Admin sign-out / session revoke. Do not delete staff with audit history.

## Future customers

`account_kind = customer` with `staff_role` null; companies/memberships in a later migration. Guests never get Auth or `public.users` rows.
