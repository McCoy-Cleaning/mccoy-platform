import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv(resolve(process.cwd(), ".env"));
const url = env.SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(JSON.stringify({ ok: false, error: "missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY" }));
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/health`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const body = await res.text();

console.log(
  JSON.stringify({
    ok: res.ok,
    status: res.status,
    urlHost: new URL(url).host,
    keyKind: key.startsWith("sb_publishable_")
      ? "publishable"
      : key.startsWith("eyJ")
        ? "jwt-anon"
        : "other",
    bodyPreview: body.slice(0, 160),
  }),
);
