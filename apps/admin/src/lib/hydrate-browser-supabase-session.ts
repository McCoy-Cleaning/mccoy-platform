import { getAdminBrowserSupabase } from "@/lib/supabase-browser";

/** One-shot: put HttpOnly-backed tokens into supabase-js for MFA APIs (memory + client store). */
export async function hydrateBrowserSupabaseSession(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getAdminBrowserSupabase();
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
