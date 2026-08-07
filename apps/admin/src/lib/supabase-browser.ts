import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Allowlisted historical browser auth keys — never wipe unrelated localStorage. */
export const ADMIN_LEGACY_AUTH_STORAGE_KEYS = ["mccoy-admin-auth"] as const;

function readViteSupabaseConfig(): { url: string; publishableKey: string } | null {
  // CMS Playwright E2E forces legacy admin auth (no MFA / no browser Supabase).
  if (String(import.meta.env.VITE_E2E_CMS || "").trim() === "1") return null;
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export type MemoryAuthStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  /** Test / audit: snapshot of keys currently held in memory. */
  keys: () => string[];
};

export function createMemoryAuthStorage(): MemoryAuthStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    keys: () => [...map.keys()],
  };
}

export function purgeAllowlistedLegacyAuthKeys(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  for (const key of ADMIN_LEGACY_AUTH_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore quota / privacy mode
    }
  }
}

function createBrowserClient(
  storage: MemoryAuthStorage,
  storageKey: string,
): SupabaseClient {
  const config = readViteSupabaseConfig();
  if (!config) {
    throw new Error("Supabase browserconfig ontbreekt.");
  }
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage,
      storageKey,
    },
  });
}

let realtimeClient: SupabaseClient | null = null;
let realtimeStorage: MemoryAuthStorage | null = null;

let mfaClient: SupabaseClient | null = null;
let mfaStorage: MemoryAuthStorage | null = null;
let mfaAuthSubscription: { unsubscribe: () => void } | null = null;

/**
 * Realtime-only client: no Auth session, no browser refresh.
 * Authorize channels with `supabase.realtime.setAuth(accessToken)`.
 */
export function getAdminRealtimeSupabase(): SupabaseClient | null {
  const config = readViteSupabaseConfig();
  if (!config) return null;
  if (!realtimeClient) {
    purgeAllowlistedLegacyAuthKeys();
    realtimeStorage = createMemoryAuthStorage();
    realtimeClient = createBrowserClient(realtimeStorage, "mccoy-admin-realtime-auth");
  }
  return realtimeClient;
}

/**
 * MFA-only client: explicit in-memory storage; `setSession` only during an active MFA flow.
 * Destroy with `clearMfaBrowserMemory()` — never unqualified `auth.signOut()` after MFA success.
 */
export function getAdminMfaSupabase(): SupabaseClient | null {
  const config = readViteSupabaseConfig();
  if (!config) return null;
  if (!mfaClient) {
    purgeAllowlistedLegacyAuthKeys();
    mfaStorage = createMemoryAuthStorage();
    mfaClient = createBrowserClient(mfaStorage, "mccoy-admin-mfa-auth");
  }
  return mfaClient;
}

/** @deprecated Prefer getAdminRealtimeSupabase or getAdminMfaSupabase. */
export function getAdminBrowserSupabase(): SupabaseClient | null {
  return getAdminRealtimeSupabase();
}

export function hasBrowserSupabaseConfig(): boolean {
  return readViteSupabaseConfig() !== null;
}

export function getAdminRealtimeAuthConfig(): {
  persistSession: boolean;
  autoRefreshToken: boolean;
  detectSessionInUrl: boolean;
} {
  return {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  };
}

/**
 * Local MFA memory teardown — does not revoke the durable HttpOnly cookie session.
 * Recreates a fresh MFA client so no Auth API signOut (global) is performed.
 */
export function clearMfaBrowserMemory(): void {
  if (mfaAuthSubscription) {
    try {
      mfaAuthSubscription.unsubscribe();
    } catch {
      // ignore
    }
    mfaAuthSubscription = null;
  }
  mfaStorage?.clear();
  mfaStorage = null;
  mfaClient = null;
  purgeAllowlistedLegacyAuthKeys();
}

/** Clear Realtime JWT / channels helper storage (caller removes channels). */
export function clearRealtimeBrowserMemory(): void {
  const client = realtimeClient;
  if (client) {
    try {
      client.realtime.setAuth("");
    } catch {
      // ignore
    }
    try {
      void client.removeAllChannels();
    } catch {
      // ignore
    }
  }
  realtimeStorage?.clear();
  realtimeStorage = null;
  realtimeClient = null;
  purgeAllowlistedLegacyAuthKeys();
}

/** Test helpers */
export function __getMfaMemoryStorageForTests(): MemoryAuthStorage | null {
  return mfaStorage;
}

export function __getRealtimeMemoryStorageForTests(): MemoryAuthStorage | null {
  return realtimeStorage;
}

export function __resetAdminSupabaseClientsForTests(): void {
  clearMfaBrowserMemory();
  clearRealtimeBrowserMemory();
}
