/**
 * @deprecated Prefer adminExchangeAuthCallback (server-side verify + HttpOnly cookies).
 * Kept for any residual hash/PKCE edge cases — does not use sessionStorage.
 */
import type { SupabaseClient, Session } from "@supabase/supabase-js";

import { parseStaffAuthCallbackParams } from "@/lib/staff-auth-callback-params";

export async function establishBrowserSessionFromAuthCallback(
  supabase: SupabaseClient,
): Promise<{ session: Session | null; error: string | null }> {
  const params = parseStaffAuthCallbackParams();
  if (!params) {
    const existing = await supabase.auth.getSession();
    return { session: existing.data.session, error: null };
  }

  if (params.code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(params.code);
    if (exchanged.error) {
      return {
        session: null,
        error:
          exchanged.error.message ||
          "Uitnodigingslink is ongeldig of verlopen. Vraag een nieuwe uitnodiging aan.",
      };
    }
    return { session: exchanged.data.session, error: null };
  }

  if (params.tokenHash && params.type) {
    const verified = await supabase.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: params.type,
    });
    if (verified.error) {
      return {
        session: null,
        error:
          verified.error.message ||
          "Uitnodigingslink is ongeldig of verlopen. Vraag een nieuwe uitnodiging aan.",
      };
    }
    return { session: verified.data.session, error: null };
  }

  if (params.accessToken && params.refreshToken) {
    const set = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (set.error) {
      return {
        session: null,
        error:
          set.error.message ||
          "Sessie uit uitnodigingslink mislukt. Vraag een nieuwe uitnodiging aan.",
      };
    }
    return { session: set.data.session, error: null };
  }

  const existing = await supabase.auth.getSession();
  return { session: existing.data.session, error: null };
}
