#!/usr/bin/env node
/**
 * Reproduce staff login server path without browser.
 * Usage from repo root: node scripts/repro-staff-login.mjs
 * Does not print secrets/tokens.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = { ...loadEnv(join(root, ".env")), ...process.env };
const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").trim();
const publishable = (env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
const secret = (env.SUPABASE_SECRET_KEY || "").trim();
const email = (env.BOOTSTRAP_SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const password = env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || "";

const report = {
  hasUrl: Boolean(url),
  hasPublishable: Boolean(publishable),
  hasSecret: Boolean(secret),
  hasEmail: Boolean(email),
  hasPassword: Boolean(password),
};

if (!url || !publishable || !secret || !email || !password) {
  console.log(JSON.stringify({ ok: false, step: "env", report }, null, 2));
  process.exit(1);
}

const anon = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
  email,
  password,
});

if (signInError || !signIn.session) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        step: "signInWithPassword",
        code: signInError?.code || signInError?.message || "no_session",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const access = signIn.session.access_token;
const service = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: userData, error: userError } = await service.auth.getUser(access);
if (userError || !userData.user) {
  console.log(
    JSON.stringify(
      { ok: false, step: "getUser", message: userError?.message || "no_user" },
      null,
      2,
    ),
  );
  process.exit(1);
}

const { data: profile, error: profileError } = await service
  .from("users")
  .select("id,account_kind,staff_role,status,blocked_at,email")
  .eq("id", userData.user.id)
  .maybeSingle();

if (profileError) {
  console.log(
    JSON.stringify({ ok: false, step: "profile", message: profileError.message }, null, 2),
  );
  process.exit(1);
}

const payload = JSON.parse(
  Buffer.from(access.split(".")[1], "base64url").toString("utf8"),
);

const userClient = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${access}` } },
});
const { data: factors, error: factorError } = await userClient.auth.mfa.listFactors();

console.log(
  JSON.stringify(
    {
      ok: true,
      step: "full",
      userIdPresent: Boolean(userData.user.id),
      profile: profile
        ? {
            account_kind: profile.account_kind,
            staff_role: profile.staff_role,
            status: profile.status,
            blocked: Boolean(profile.blocked_at),
          }
        : null,
      aal: payload.aal || "missing",
      factorCount: factors?.totp?.length ?? null,
      factorError: factorError?.message || null,
      wouldAllowMfaOnboarding:
        profile?.status === "invited" && (payload.aal === "aal1" || payload.aal === "aal2"),
    },
    null,
    2,
  ),
);
