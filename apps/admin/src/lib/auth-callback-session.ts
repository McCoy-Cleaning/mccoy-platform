import type { SupabaseClient, Session } from "@supabase/supabase-js";

/**
 * Auth invite/recovery emails often redirect with implicit-grant tokens in the
 * URL hash (`#access_token=…&type=invite`). The admin client defaults to PKCE,
 * so `detectSessionInUrl` alone may never create a session — the invite page
 * then shows "open the email link" even when the link was valid.
 */
export async function establishBrowserSessionFromAuthCallback(
  supabase: SupabaseClient,
): Promise<{ session: Session | null; error: string | null }> {
  const url = new URL(window.location.href);

  // PKCE: ?code=
  const code = url.searchParams.get("code");
  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
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

  // Email templates sometimes use ?token_hash=&type=invite|recovery on the app URL.
  // Do not treat Auth `/verify?token=` as token_hash — that param is only for the Auth host.
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = (url.searchParams.get("type") || "").toLowerCase();
  if (
    tokenHash &&
    (otpType === "invite" ||
      otpType === "recovery" ||
      otpType === "signup" ||
      otpType === "magiclink" ||
      otpType === "email")
  ) {
    const verified = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as "invite" | "recovery" | "signup" | "magiclink" | "email",
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

  // Implicit grant: #access_token=…&refresh_token=…&type=invite
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (hash) {
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const errorDescription = params.get("error_description") || params.get("error");
    if (errorDescription) {
      return {
        session: null,
        error: decodeURIComponent(errorDescription.replace(/\+/g, " ")),
      };
    }
    if (accessToken && refreshToken) {
      const set = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
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
  }

  // Already signed in from a previous step on this device.
  const existing = await supabase.auth.getSession();
  return { session: existing.data.session, error: null };
}
