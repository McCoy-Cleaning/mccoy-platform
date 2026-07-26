import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readServerEnv } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

export type MccoySupabaseClient = SupabaseClient;

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

/** Server-side public config (URL + publishable key). Safe for RLS-bound clients. */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  ensureMonorepoEnvLoaded();
  const url = readServerEnv("SUPABASE_URL") || readServerEnv("VITE_SUPABASE_URL");
  const publishableKey =
    readServerEnv("SUPABASE_PUBLISHABLE_KEY") ||
    readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (!url) {
    throw new SupabaseConfigError("Missing SUPABASE_URL (or VITE_SUPABASE_URL).");
  }
  if (!publishableKey) {
    throw new SupabaseConfigError(
      "Missing SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).",
    );
  }
  return { url, publishableKey };
}

/**
 * Browser/SSR client with the publishable key. All access is subject to RLS.
 * Do not use for privileged admin writes.
 */
export function createSupabasePublishableClient(): MccoySupabaseClient {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Server-only privileged client. Requires SUPABASE_SECRET_KEY (service role).
 * Never import this into browser code or expose via VITE_*.
 */
export function createSupabaseServiceClient(): MccoySupabaseClient {
  ensureMonorepoEnvLoaded();
  const { url } = getSupabasePublicConfig();
  const secretKey = readServerEnv("SUPABASE_SECRET_KEY");
  if (!secretKey) {
    throw new SupabaseConfigError(
      "Missing SUPABASE_SECRET_KEY. Add the service-role / secret key from Project Settings → API (server only).",
    );
  }
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function hasSupabasePublicConfig(): boolean {
  try {
    getSupabasePublicConfig();
    return true;
  } catch {
    return false;
  }
}

export function hasSupabaseServiceConfig(): boolean {
  return Boolean(readServerEnv("SUPABASE_SECRET_KEY"));
}
