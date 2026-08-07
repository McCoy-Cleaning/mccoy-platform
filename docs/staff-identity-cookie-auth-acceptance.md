# Admin cookie-only auth — production acceptance closeout

**Classification:** `COOKIE_AUTH_BLOCKED`

**Reason blocked:** Manual DevTools acceptance (login → reload → Realtime hydrate → MFA → logout storage/cookie inspection) could not be completed in this acceptance environment. Playwright Chromium binaries were missing (`playwright install` required), and interactive browser MCP was unavailable. Deterministic automated gates and static audit are green; operator must complete § Manual DevTools before promoting to `COOKIE_AUTH_ACCEPTED`.

**Implementation base:** `371a40dff5fbe0326406fb4939cc0facb4baf913` (`371a40d Further fixes`) plus uncommitted cookie-auth working tree changes (see `git status`).

**Acceptance date:** 2026-08-07

---

## Architecture (as shipped)

### Clients

| Client | Role |
|--------|------|
| `getAdminRealtimeSupabase()` | Realtime only; `realtime.setAuth(accessToken)`; no Auth session persistence |
| `getAdminMfaSupabase()` | MFA only; in-memory `setSession` during purpose-gated MFA flow |

Auth flags (both):

```ts
persistSession: false
autoRefreshToken: false
detectSessionInUrl: false
storage: explicitMemoryAuthStorage
```

### Refresh authority

Server-only: `refreshAccessTokenIfNeeded()` rotates HttpOnly `mccoy_sb_*`. Browser `autoRefreshToken` stays `false`.

### Realtime access-token lifecycle

1. Cookie-authenticated `adminHydrateRealtimeAccessToken` → `buildRealtimeAccessHydration` → `{ accessToken, expiresAt }` only  
2. `Cache-Control: no-store`  
3. `supabase.realtime.setAuth(accessToken)`  
4. Near-expiry renew repeats the same server path  

### MFA capability lifecycle

1. `startMfaBrowserFlow(purpose)` issues HttpOnly `mccoy_admin_mfa_flow` (HMAC; no refresh token inside)  
2. Purposes: `mfa_setup` | `mfa_challenge` | `authenticator_replace`  
3. `ensureMfaBrowserSession` requires valid Admin cookies + matching flow  
4. Temporary access+refresh → MFA client memory only  
5. After verify: `adminEstablishSession({ requireAal2: true })` → HttpOnly AAL2 cookies  
6. `clearMfaBrowserMemory()` / `destroyMfaBrowserSessionLocally()` — **no** `auth.signOut()`  

### AAL2 trust boundary

Server reads AAL from validated access token via `readAal` / `resolveSupabasePrincipal`. Client-supplied `{ aal: "aal2" }` is never trusted. `requireAal2: true` rejects AAL1 without modifying cookies.

### Local MFA teardown

Destroys MFA client singleton + clears in-memory storage + purges allowlisted legacy keys. Does not revoke durable Supabase session / HttpOnly cookies / other devices.

### Cookie attributes (contract)

| Cookie | HttpOnly | SameSite | Path | Secure |
|--------|----------|----------|------|--------|
| `mccoy_sb_access_token` | yes | lax | `/` | production |
| `mccoy_sb_refresh_token` | yes | lax | `/` | production |
| `mccoy_admin_mfa_flow` | yes | lax | `/` | production (TTL 10m) |

---

## Static / security audit classification

| Pattern | Finding |
|---------|---------|
| `mccoy-admin-auth` | Allowlisted legacy key purge + event name `mccoy-admin-auth` (not storage). Tests only. |
| `persistSession/autoRefreshToken/detectSessionInUrl: true` | **Absent** in Admin browser clients |
| `signInWithPassword` | Normal path: **none**. Rare fallback `signInViaBrowserThenEstablish` only when Supabase server path not enabled |
| `auth.setSession` | MFA hydrate helper only (+ deprecated `auth-callback-session.ts`) |
| `auth.signOut` (browser) | **Absent** on MFA teardown / logout; logout uses memory clear + `adminSignOut` cookies |
| `auth.admin.signOut` | Server staff revoke (legitimate) |
| `refreshToken` in Realtime hydrate | **Not returned**; DTO field-by-field `{ accessToken, expiresAt }` |
| Server `refresh_token` / cookie refresh | Legitimate server authority |
| `console.log(session/data/auth` | **None** in `apps/admin/src/lib` |
| `localStorage` | CMS drafts, pins, i18n, sidebar — **not** auth JWTs; purge allowlisted only |

`git diff --check`: exit **2** — trailing whitespace in unrelated `docs/testing/playwright-application-audit.md` (not cookie-auth).

---

## Deterministic regression results

| Command | Exit | Notes |
|---------|------|-------|
| `npm run typecheck` | **0** | Full monorepo |
| `npm run lint` | **0** | cms-renderer typecheck |
| `npm run test:contract` | **0** | cms-schema **555** tests |
| `npm run test:ci` | **0** | cms-renderer **134** tests |
| `npm run test -w @mccoy/security` | **0** | **21** tests |
| `npm run test -w @mccoy/database` | **0** | **109** tests |
| `npm run test -w @mccoy/admin` | **0** | **80** tests (incl. acceptance + supabase-browser) |
| `npm run build:admin` | **0** | client+ssr |
| `npm run build:storefront` | **0** | client+ssr |
| `npm run test:e2e:quality` | **1** | Playwright Chromium binary missing in environment |

Added/verified automated contracts:

- LOGIN: no dual browser `signInWithPassword` on normal path; allowlisted purge  
- REALTIME: DTO exact keys; no `refresh` serialization; `setAuth`; autoRefresh disabled  
- MFA: purpose enum; flow cookie attributes; `requireAal2`; memory teardown; no-store headers on auth fns  
- LOGOUT: Realtime+MFA clear; allowlisted keys only; unrelated storage preserved  

---

## Manual DevTools acceptance

| Check | Status |
|-------|--------|
| A. Fresh login storage + HttpOnly cookies | **NOT RUN** (blocked) |
| B. Hard reload survives from cookies | **NOT RUN** |
| C. Realtime hydrate network shape + renew | **NOT RUN** |
| D. MFA no-store / memory clear / reload AAL2 | **NOT RUN** |
| E. Logout clears cookies; unrelated prefs kept | **NOT RUN** |

**Operator checklist:** run against a real Admin session (dev or staging), then flip classification to `COOKIE_AUTH_ACCEPTED` if all pass.

---

## Cookie / XSS regression (code-level)

- Auth/hydration server functions call `setNoStoreHeaders()` (`Cache-Control: no-store`, `Pragma: no-cache`).  
- Tokens not placed in React Query persistence by design (no auth cache keys).  
- Residual XSS: during an **authorized MFA flow**, temporary access+refresh exist in same-origin JS memory — documented in `docs/staff-identity-phase1.md`. Not eliminated.

---

## Residual XSS risk

- Durable auth = HttpOnly cookies.  
- Ordinary runtime = short-lived Realtime access JWT in memory only.  
- MFA still temporarily exposes access+refresh to same-origin JS.  
- Safer than durable `localStorage` JWTs; **not** fully server-proxied MFA.

## Follow-up hardening

1. Complete Manual DevTools checklist → promote to `COOKIE_AUTH_ACCEPTED`.  
2. Install Playwright browsers for CI E2E.  
3. Future: fully server-proxied MFA (out of scope for this pass).  

Do not start server-side MFA in this acceptance pass.
