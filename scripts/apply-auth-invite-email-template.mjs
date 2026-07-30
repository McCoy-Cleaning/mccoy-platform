/**
 * Push the McCoy staff-invite HTML to the hosted Supabase Auth "Invite user" template.
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN  — https://supabase.com/dashboard/account/tokens
 *   SUPABASE_PROJECT_REF   — optional; derived from SUPABASE_URL / VITE_SUPABASE_URL when unset
 *
 * Usage:
 *   npm run apply:auth-invite-template
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function projectRefFromUrl(raw) {
  if (!raw?.trim()) return null;
  try {
    const host = new URL(raw.trim()).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

loadDotEnv();

const token = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const projectRef =
  (process.env.SUPABASE_PROJECT_REF || "").trim() ||
  projectRefFromUrl(process.env.SUPABASE_URL) ||
  projectRefFromUrl(process.env.VITE_SUPABASE_URL);

const templatePath = join(root, "supabase", "templates", "invite.html");
const subject = "Uitnodiging voor McCoy Admin";

if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens and set it in .env or the shell.",
  );
  console.error(
    `Or paste ${templatePath} manually into Dashboard → Authentication → Email Templates → Invite user.`,
  );
  process.exit(1);
}

if (!projectRef) {
  console.error(
    "Missing project ref. Set SUPABASE_PROJECT_REF or SUPABASE_URL / VITE_SUPABASE_URL.",
  );
  process.exit(1);
}

if (!existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`);
  process.exit(1);
}

const html = readFileSync(templatePath, "utf8");
if (!html.includes("{{ .ConfirmationURL }}")) {
  console.error("Template must include {{ .ConfirmationURL }} for Auth invite links.");
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const response = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    mailer_subjects_invite: subject,
    mailer_templates_invite_content: html,
  }),
});

if (!response.ok) {
  const body = await response.text();
  console.error(`Failed to update Auth invite template (${response.status}): ${body}`);
  process.exit(1);
}

console.log(`Updated Auth invite template on project ${projectRef}.`);
console.log(`Subject: ${subject}`);
console.log("Next invite emails from inviteUserByEmail will use the McCoy HTML.");
