import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readViteSupabaseConfig(): { url: string; publishableKey: string } | null {
  // CMS Playwright E2E forces legacy admin auth (no MFA / no browser Supabase).
  if (String(import.meta.env.VITE_E2E_CMS || "").trim() === "1") return null;
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

let browserClient: SupabaseClient | null = null;

/** Browser-only publishable Supabase client. Never uses the secret key. */
export function getAdminBrowserSupabase(): SupabaseClient | null {
  const config = readViteSupabaseConfig();
  if (!config) return null;
  if (!browserClient) {
    browserClient = createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "mccoy-admin-auth",
      },
    });
  }
  return browserClient;
}

export function hasBrowserSupabaseConfig(): boolean {
  return readViteSupabaseConfig() !== null;
}
