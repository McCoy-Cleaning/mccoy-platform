/**
 * Pure helpers that gate Realtime channel setup on a usable staff access token.
 *
 * Kept separate from `notification-service.ts` so they can be unit-tested without
 * importing the service (which wires toast/platform-event bridges and Supabase
 * server functions at module load).
 */

/**
 * Minimum remaining JWT lifetime required before subscribing a Realtime channel.
 *
 * `realtime.setAuth(token)` silently no-ops when the token is expired per the
 * browser clock (clock skew, or a token that expires during the server→browser
 * round trip), leaving the anon publishable key as the channel's access token.
 * Requiring a safety margin prevents the channel from joining as `anon`, which
 * lacks SELECT on `notification_recipients` and makes Realtime raise
 * `invalid column for filter user_id` (P0001) from `subscription_check_filters()`.
 */
export const REALTIME_TOKEN_MIN_REMAINING_MS = 30_000;

/** Backoff before retrying Realtime setup when no usable token is available yet. */
export const REALTIME_SETUP_RETRY_MS = 10_000;

/** Decodes a JWT's `exp` claim to epoch milliseconds, or `null` if unparseable. */
export function decodeAccessTokenExpMs(accessToken: string): number | null {
  try {
    const segments = accessToken.split(".");
    if (segments.length < 2) return null;
    const payload = JSON.parse(atob(segments[1]));
    const exp = payload?.exp;
    if (typeof exp === "number" && Number.isFinite(exp)) return exp * 1000;
    return null;
  } catch {
    return null;
  }
}

/** True when the JWT has more than `minRemainingMs` left per the browser clock. */
export function isAccessTokenUsable(accessToken: string, minRemainingMs: number): boolean {
  const expMs = decodeAccessTokenExpMs(accessToken);
  if (expMs === null) return false;
  return expMs - Date.now() > minRemainingMs;
}
