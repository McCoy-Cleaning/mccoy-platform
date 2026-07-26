/**
 * Ensure monorepo-root `.env` is present in `process.env` for SSR / server fns.
 * Vite may not inject non-VITE_* keys into Nitro worker process.env.
 * Safe to call repeatedly; no-ops in the browser.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { findMonorepoRoot } from "./env";

let loaded = false;

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
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

export function ensureMonorepoEnvLoaded(): void {
  if (loaded) return;
  loaded = true;

  if (typeof (globalThis as { window?: unknown }).window !== "undefined") return;

  try {
    const root = findMonorepoRoot();
    if (!root) return;
    const envPath = join(root, ".env");
    if (!existsSync(envPath)) return;
    const parsed = parseEnvFile(readFileSync(envPath, "utf8"));
    const e2e = process.env.MCCOY_E2E === "1";
    for (const [key, value] of Object.entries(parsed)) {
      if (e2e && /^(SUPABASE_|VITE_SUPABASE_)/.test(key)) {
        continue;
      }
      if (process.env[key] === undefined || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  } catch {
    // Do not crash server boot if .env is unreadable.
  }
}
