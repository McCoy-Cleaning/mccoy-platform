/**
 * Build McCoy-owned staff auth links that land on `/invite` directly.
 * Avoids Supabase-hosted `/auth/v1/verify` pages that can show recovery UI
 * or redirect to the wrong Site URL when redirect allowlists drift.
 */

export type StaffAuthAppLinkType = "invite" | "recovery" | "signup" | "magiclink" | "email";

export type StaffAuthGenerateLinkProperties = {
  action_link?: string | null;
  hashed_token?: string | null;
  verification_type?: string | null;
};

const APP_LINK_TYPES = new Set<string>(["invite", "recovery", "signup", "magiclink", "email"]);

export function normalizeStaffAuthAppLinkType(raw: string | null | undefined): StaffAuthAppLinkType | null {
  const value = raw?.trim().toLowerCase() ?? "";
  if (!value || !APP_LINK_TYPES.has(value)) return null;
  return value as StaffAuthAppLinkType;
}

/** Direct app URL consumed by the admin invite page auth callback handler. */
export function buildStaffAuthAppLink(input: {
  redirectTo: string;
  hashedToken: string;
  type: StaffAuthAppLinkType;
}): string {
  const url = new URL(input.redirectTo.trim());
  url.searchParams.set("token_hash", input.hashedToken);
  url.searchParams.set("type", input.type);
  return url.toString();
}

/** Force `redirect_to` on legacy Auth action links (manual fallback). */
export function withInviteRedirectTo(actionLink: string, redirectTo: string): string {
  try {
    const url = new URL(actionLink);
    url.searchParams.set("redirect_to", redirectTo);
    return url.toString();
  } catch {
    return actionLink;
  }
}

/**
 * Prefer a McCoy app link (`/invite?token_hash=&type=`) over Supabase `action_link`.
 * Falls back to `action_link` with an enforced `redirect_to` when hashed_token is missing.
 */
export function resolveStaffAuthEmailLink(input: {
  redirectTo: string;
  properties: StaffAuthGenerateLinkProperties | null | undefined;
}): string | null {
  const properties = input.properties;
  if (!properties) return null;

  const hashedToken = properties.hashed_token?.trim();
  const linkType = normalizeStaffAuthAppLinkType(properties.verification_type);
  if (hashedToken && linkType) {
    return buildStaffAuthAppLink({
      redirectTo: input.redirectTo,
      hashedToken,
      type: linkType,
    });
  }

  const actionLink = properties.action_link?.trim();
  if (!actionLink) return null;
  return withInviteRedirectTo(actionLink, input.redirectTo);
}
