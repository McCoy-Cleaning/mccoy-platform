/**
 * One-off: set a staff Auth password by email (service role).
 *
 * Usage (from repo root, with .env loaded):
 *   node --env-file=.env scripts/set-staff-password.mjs margareth@mccoy.nl "YourNewPassword1!"
 *
 * Optional: pass --clear-mfa to remove TOTP factors so she can re-enroll.
 */
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] || "").trim().toLowerCase();
const password = process.argv[3] || "";
const clearMfa = process.argv.includes("--clear-mfa");

if (!email || !password) {
  console.error(
    'Usage: node --env-file=.env scripts/set-staff-password.mjs <email> "<password>" [--clear-mfa]',
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let page = 1;
let user = null;
for (;;) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  user = data.users.find((u) => (u.email || "").toLowerCase() === email) ?? null;
  if (user || data.users.length < 200) break;
  page += 1;
}

if (!user) {
  console.error(`No Auth user for ${email}`);
  process.exit(1);
}

if (clearMfa) {
  const { data: factors } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
  for (const factor of factors?.factors ?? []) {
    const del = await supabase.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: user.id,
    });
    if (del.error) console.warn("MFA delete:", del.error.message);
    else console.log("Removed MFA factor", factor.id);
  }
}

const { error } = await supabase.auth.admin.updateUserById(user.id, {
  password,
  ban_duration: "none",
  email_confirm: true,
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Password updated for ${email} (${user.id}).`);
console.log("Share the new password with her out of band; ask her to change it after login.");
