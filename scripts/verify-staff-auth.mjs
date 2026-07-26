#!/usr/bin/env node
/**
 * Safe staff Auth probe — prints only booleans / opaque status codes.
 * Never prints secrets, tokens, or passwords.
 *
 * Usage (repo root):
 *   node --env-file=.env scripts/verify-staff-auth.mjs
 */

import { createClient } from "@supabase/supabase-js";

function present(name) {
  return Boolean(process.env[name]?.trim());
}

const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || "";
const publishable =
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";
const secret = process.env.SUPABASE_SECRET_KEY?.trim() || "";
const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase() || "";
const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || "";

console.log(
  JSON.stringify(
    {
      env: {
        hasUrl: Boolean(url),
        hasPublishable: Boolean(publishable),
        hasSecret: Boolean(secret),
        hasBootstrapEmail: Boolean(email),
        hasBootstrapPassword: Boolean(password),
        hasViteUrl: present("VITE_SUPABASE_URL"),
        hasVitePublishable: present("VITE_SUPABASE_PUBLISHABLE_KEY"),
      },
    },
    null,
    2,
  ),
);

if (!url || !publishable || !secret) {
  console.error("FAIL: missing Supabase server env (url/publishable/secret).");
  process.exit(1);
}

const service = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let authUserFound = false;
if (email) {
  const { data: listed, error: listError } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) {
    console.error("FAIL: admin.listUsers:", listError.message);
    process.exit(1);
  }
  authUserFound = Boolean(listed.users?.some((u) => u.email?.toLowerCase() === email));
}

const { count: staffCount, error: staffError } = await service
  .from("users")
  .select("id", { count: "exact", head: true })
  .eq("account_kind", "staff");

if (staffError) {
  console.error("FAIL: public.users staff query:", staffError.message);
  console.error("Hint: apply identity migrations, then run bootstrap-super-admin.mjs");
  process.exit(1);
}

let signInOk = false;
let signInCode = "skipped";
if (email && password) {
  const anon = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  signInOk = Boolean(!error && data.session);
  signInCode = error?.code || error?.message || (signInOk ? "ok" : "unknown");
  if (data.session) {
    await anon.auth.signOut().catch(() => undefined);
  }
}

const result = {
  ok: authUserFound && (staffCount ?? 0) > 0 && (password ? signInOk : true),
  authUserForBootstrapEmail: authUserFound,
  staffRowCount: staffCount ?? 0,
  signInWithPassword: password ? { ok: signInOk, code: signInCode } : { ok: null, code: "no_password_env" },
  next:
    !authUserFound || (staffCount ?? 0) === 0
      ? ["Run: node --env-file=.env scripts/bootstrap-super-admin.mjs"]
      : [
          "Restart: npm run dev:admin",
          "Login at http://localhost:5174/admin/login with bootstrap email + password",
          "Complete MFA at /admin/mfa",
        ],
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 2);
