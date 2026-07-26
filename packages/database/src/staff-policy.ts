import type { StaffUserProfile } from "@mccoy/domain";
import { AdminAuthError } from "@mccoy/security";

/** Pure gate used by bootstrap-super-admin (and unit tests). */
export function shouldAbortSuperAdminBootstrap(existingSuperAdminCount: number): boolean {
  return (existingSuperAdminCount ?? 0) > 0;
}

export type StaffInviteEmailDecision = "create_new" | "reinstate_blocked" | "reject_duplicate";

/**
 * Decide invite flow when an email already has a staff profile.
 * Blocked staff may be securely reinstated; active/invited must be rejected.
 */
export function decideStaffInviteForExistingEmail(
  existing: Pick<StaffUserProfile, "status" | "blockedAt"> | null,
): StaffInviteEmailDecision {
  if (!existing) return "create_new";
  if (existing.status === "blocked" || existing.blockedAt) return "reinstate_blocked";
  return "reject_duplicate";
}

export function isStaffBlocked(profile: Pick<StaffUserProfile, "status" | "blockedAt">): boolean {
  return profile.status === "blocked" || Boolean(profile.blockedAt);
}

/**
 * Pure authorization check for super-admin-only staff invite/list/remove paths.
 * Throws AdminAuthError when the session/actor is not an active super_admin.
 */
export function assertActiveSuperAdminActor(input: {
  sessionUserId?: string | null;
  sessionStaffRole?: string | null;
  actor: Pick<StaffUserProfile, "accountKind" | "staffRole" | "status" | "blockedAt"> | null;
}): void {
  if (!input.sessionUserId || input.sessionStaffRole !== "super_admin") {
    throw new AdminAuthError("Alleen een actieve super_admin mag beheerders uitnodigen.");
  }
  const actor = input.actor;
  if (
    !actor ||
    actor.accountKind !== "staff" ||
    actor.staffRole !== "super_admin" ||
    actor.status !== "active" ||
    actor.blockedAt
  ) {
    throw new AdminAuthError("Alleen een actieve super_admin mag beheerders uitnodigen.");
  }
}

/**
 * Session resolution gate: blocked staff must never obtain an admin principal.
 */
export function assertStaffProfileAllowsAdminSession(
  profile: Pick<StaffUserProfile, "accountKind" | "staffRole" | "status" | "blockedAt">,
): void {
  if (profile.accountKind !== "staff" || !profile.staffRole) {
    throw new AdminAuthError("Geen toegang tot de admin.");
  }
  if (isStaffBlocked(profile)) {
    throw new AdminAuthError("Dit account is geblokkeerd.");
  }
}

/** Detect PostgREST "Invalid schema: private" (schema not exposed). */
export function messageIfPrivateSchemaMissing(errorMessage: string): string | null {
  if (/invalid schema:\s*private/i.test(errorMessage)) {
    return "Het private-schema is niet beschikbaar in de API. Expose `private` onder Supabase → Settings → API → Exposed schemas zodat uitnodigingen (private.staff_invitations) werken. Profiel- en wachtwoordwijzigingen hebben dit niet nodig.";
  }
  return null;
}
