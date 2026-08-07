import {
  adminEnsureMfaBrowserSession,
  adminStartMfaBrowserFlow,
} from "@/lib/api/admin-auth.functions";
import {
  clearMfaBrowserMemory,
  getAdminMfaSupabase,
} from "@/lib/supabase-browser";

type AdminMfaBrowserPurpose = "mfa_setup" | "mfa_challenge" | "authenticator_replace";

/** One-shot: put purpose-gated tokens into the MFA supabase-js client (memory only). */
export async function hydrateMfaBrowserSession(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getAdminMfaSupabase();
  if (!supabase) {
    return { ok: false, error: "Supabase browserconfig ontbreekt." };
  }
  const { error } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (error) {
    return {
      ok: false,
      error: error.message || "Browsersessie voor MFA kon niet worden gezet.",
    };
  }
  return { ok: true };
}

/**
 * Start MFA-flow capability + hydrate MFA client from cookies via ensure.
 * Prefer this over returning refresh tokens from ordinary Admin pages.
 */
export async function ensureMfaBrowserSessionForPurpose(
  purpose: AdminMfaBrowserPurpose,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const started = await adminStartMfaBrowserFlow({ data: { purpose } });
  if (!started.ok) {
    return { ok: false, error: started.error };
  }
  const ensured = await adminEnsureMfaBrowserSession({ data: { purpose } });
  if (!ensured.ok) {
    return { ok: false, error: ensured.error };
  }
  return hydrateMfaBrowserSession(ensured.hydration);
}

/** Local teardown after AAL2 cookies are issued — must not revoke the durable Supabase session. */
export function destroyMfaBrowserSessionLocally(): void {
  clearMfaBrowserMemory();
}

/** @deprecated Use hydrateMfaBrowserSession / ensureMfaBrowserSessionForPurpose. */
export async function hydrateBrowserSupabaseSession(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return hydrateMfaBrowserSession(tokens);
}
