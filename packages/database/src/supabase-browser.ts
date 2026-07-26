import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type MccoySupabaseClient = SupabaseClient;

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

type ViteImportMeta = ImportMeta & {
  env?: Record<string, string | undefined>;
};

function readViteEnv(name: string): string {
  const env = (import.meta as ViteImportMeta).env;
  return String(env?.[name] ?? "").trim();
}

/**
 * Browser-safe public config from `VITE_*` only.
 * Never reads server secrets or Node env loaders.
 */
export function getBrowserSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = readViteEnv("VITE_SUPABASE_URL");
  const publishableKey = readViteEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function hasBrowserSupabaseConfig(): boolean {
  return getBrowserSupabasePublicConfig() !== null;
}

/**
 * Browser publishable Supabase client (RLS-bound). Never uses the service-role key.
 */
export function createBrowserSupabaseClient(options?: {
  storageKey?: string;
}): MccoySupabaseClient | null {
  const config = getBrowserSupabasePublicConfig();
  if (!config) return null;
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      ...(options?.storageKey ? { storageKey: options.storageKey } : {}),
    },
  });
}
