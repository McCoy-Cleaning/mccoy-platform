#!/usr/bin/env node
/**
 * One-time bootstrap: create the first McCoy super_admin in Supabase Auth + public.users.
 *
 * After this script succeeds, sign in at /admin/login with the bootstrap
 * email + password (Supabase Auth), then complete MFA enrollment.
 * Requires root `.env` loaded into the admin Vite SSR process
 * (see scripts/vite-load-monorepo-env.mjs).
 *
 * Requirements:
 * - SUPABASE_URL
 * - SUPABASE_SECRET_KEY (service role)
 * - BOOTSTRAP_SUPER_ADMIN_EMAIL
 * - BOOTSTRAP_SUPER_ADMIN_PASSWORD (temporary; for post-cutover Supabase sign-in)
 * - BOOTSTRAP_CONFIRM=CREATE_FIRST_SUPER_ADMIN
 *
 * Disable/remove after production bootstrap. Do not expose as a public HTTP endpoint.
 *
 * Usage (from repo root):
 *   node --env-file=.env scripts/bootstrap-super-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

const url = requireEnv("SUPABASE_URL");
const secret = requireEnv("SUPABASE_SECRET_KEY");
const email = requireEnv("BOOTSTRAP_SUPER_ADMIN_EMAIL").toLowerCase();
const password = requireEnv("BOOTSTRAP_SUPER_ADMIN_PASSWORD");
const confirm = process.env.BOOTSTRAP_CONFIRM?.trim();

if (confirm !== "CREATE_FIRST_SUPER_ADMIN") {
  console.error('Refusing to run: set BOOTSTRAP_CONFIRM=CREATE_FIRST_SUPER_ADMIN');
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { count, error: countError } = await supabase
  .from("users")
  .select("id", { count: "exact", head: true })
  .eq("account_kind", "staff")
  .eq("staff_role", "super_admin");

if (countError) {
  console.error("Failed to check existing super_admins:", countError.message);
  console.error("Apply identity migrations first.");
  process.exit(1);
}

// Keep in sync with shouldAbortSuperAdminBootstrap (@mccoy/database staff-policy).
function shouldAbortSuperAdminBootstrap(existingSuperAdminCount) {
  return (existingSuperAdminCount ?? 0) > 0;
}

if (shouldAbortSuperAdminBootstrap(count ?? 0)) {
  console.error("A super_admin already exists. Bootstrap aborted.");
  process.exit(1);
}

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { account_kind: "staff", staff_role: "super_admin" },
});

if (createError || !created.user) {
  console.error("Auth createUser failed:", createError?.message ?? "unknown");
  process.exit(1);
}

const userId = created.user.id;

const { error: profileError } = await supabase.from("users").insert({
  id: userId,
  account_kind: "staff",
  staff_role: "super_admin",
  status: "invited",
  email,
  full_name: process.env.BOOTSTRAP_SUPER_ADMIN_NAME?.trim() || null,
  created_by: null,
});

if (profileError) {
  console.error("Profile insert failed:", profileError.message);
  console.error("Auth user id for reconciliation:", userId);
  process.exit(1);
}

const { error: auditError } = await supabase.schema("private").from("audit_logs").insert({
  actor_user_id: userId,
  action: "staff.bootstrap_super_admin",
  target_type: "user",
  target_id: userId,
  after_data: { email, staff_role: "super_admin", status: "invited" },
  metadata: { source: "scripts/bootstrap-super-admin.mjs" },
});

if (auditError) {
  console.warn("Audit insert warning:", auditError.message);
}

console.log(JSON.stringify({
  ok: true,
  userId,
  email,
  status: "invited",
  note: "Supabase Auth user + public.users staff row created (status=invited until MFA aal2).",
  next: [
    "Restart admin: npm run dev:admin",
    "Sign in at http://localhost:5174/admin/login with BOOTSTRAP_SUPER_ADMIN_EMAIL + BOOTSTRAP_SUPER_ADMIN_PASSWORD",
    "Complete TOTP MFA at /admin/mfa (invited + aal1 is allowed for enrollment)",
    "Remove BOOTSTRAP_* env vars after first successful login",
  ],
}, null, 2));
