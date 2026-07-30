/**
 * Mark a staff user active after an Admin API password reset (skips invite shell).
 *
 *   node --env-file=.env scripts/activate-staff-user.mjs margareth@mccoy.nl
 */
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node --env-file=.env scripts/activate-staff-user.mjs <email>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error } = await supabase
  .from("users")
  .update({ status: "active" })
  .ilike("email", email)
  .eq("account_kind", "staff")
  .eq("status", "invited")
  .is("blocked_at", null)
  .select("id, email, status, staff_role");

if (error) {
  console.error(error.message);
  process.exit(1);
}

if (!rows?.length) {
  const { data: existing } = await supabase
    .from("users")
    .select("id, email, status, staff_role, blocked_at")
    .eq("email", email)
    .maybeSingle();
  console.log("No invited→active update. Current row:", existing ?? "not found");
  process.exit(existing?.status === "active" ? 0 : 1);
}

console.log("Activated:", rows[0]);
