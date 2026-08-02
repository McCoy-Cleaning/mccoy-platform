import type { StaffUserProfile } from "@mccoy/domain";
import { AdminAuthError } from "@mccoy/security";

/** Pure gate used by bootstrap-super-admin (and unit tests). */
export function shouldAbortSuperAdminBootstrap(existingSuperAdminCount: number): boolean {
  return (existingSuperAdminCount ?? 0) > 0;
}

export type StaffInviteEmailDecision =
  | "create_new"
  | "reinstate_blocked"
  | "resend_invite"
  | "reject_duplicate";

/**
 * Decide invite flow when an email already has a staff profile.
 * - blocked → reinstate (same id/data; MFA cleared by caller)
 * - invited → resend link
 * - active → reject (use dedicated account recovery instead)
 * Super-admin only callers; never used for anonymous self-signup.
 */
export function decideStaffInviteForExistingEmail(
  existing: Pick<StaffUserProfile, "status" | "blockedAt"> | null,
): StaffInviteEmailDecision {
  if (!existing) return "create_new";
  if (existing.status === "blocked" || existing.blockedAt) return "reinstate_blocked";
  if (existing.status === "invited") return "resend_invite";
  if (existing.status === "active") return "reject_duplicate";
  return "reject_duplicate";
}

/**
 * Gates super-admin-initiated MFA account recovery for active staff who lost their authenticator.
 * Requires an active super_admin at AAL2; cannot target self or non-active accounts.
 */
export function assertCanRecoverStaffAccount(input: {
  actorUserId: string;
  actorAal: "aal1" | "aal2" | null | undefined;
  actor: Pick<
    StaffUserProfile,
    "accountKind" | "staffRole" | "status" | "blockedAt"
  > | null;
  target: Pick<
    StaffUserProfile,
    "id" | "accountKind" | "staffRole" | "status" | "blockedAt"
  > | null;
}): void {
  assertActiveSuperAdminActor({
    sessionUserId: input.actorUserId,
    sessionStaffRole: input.actor?.staffRole ?? null,
    actor: input.actor,
  });
  if (input.actorAal !== "aal2") {
    throw new AdminAuthError(
      "Rond eerst MFA af (aal2) voordat je een account kunt herstellen.",
    );
  }
  if (!input.target || input.target.accountKind !== "staff" || !input.target.staffRole) {
    throw new AdminAuthError("Medewerker niet gevonden.");
  }
  if (input.target.id === input.actorUserId) {
    throw new AdminAuthError(
      "Je kunt je eigen account niet herstellen. Vraag een andere super admin.",
    );
  }
  if (input.target.status === "blocked" || input.target.blockedAt) {
    throw new AdminAuthError(
      "Geblokkeerde accounts herstel je via een nieuwe uitnodiging.",
    );
  }
  if (input.target.status !== "active") {
    throw new AdminAuthError(
      "Accountherstel is alleen voor actieve medewerkers die hun authenticator kwijt zijn.",
    );
  }
}

/** Product rule: bootstrap owner + one backup — never an open-ended super_admin roster. */
export const MAX_SUPER_ADMINS = 2;

/**
 * Gates role changes (promote/demote). Only active super_admins may change roles.
 * At most {@link MAX_SUPER_ADMINS} super admins; the last active super_admin cannot be demoted.
 */
export function assertCanChangeStaffRole(input: {
  actorUserId: string | null | undefined;
  actor: Pick<StaffUserProfile, "id" | "accountKind" | "staffRole" | "status" | "blockedAt"> | null;
  target: Pick<
    StaffUserProfile,
    "id" | "accountKind" | "staffRole" | "status" | "blockedAt"
  > | null;
  nextRole: StaffUserProfile["staffRole"];
  /** Active + invited (non-blocked) super_admins — used for the promote cap. */
  rosterSuperAdminCount: number;
  /** Active-only count — used so the last *active* super_admin cannot be demoted. */
  activeSuperAdminCount: number;
}): void {
  const { actor, target, nextRole } = input;
  if (!input.actorUserId || !actor || actor.staffRole !== "super_admin") {
    throw new AdminAuthError("Alleen een actieve super_admin mag rollen wijzigen.");
  }
  if (
    actor.accountKind !== "staff" ||
    actor.status !== "active" ||
    actor.blockedAt
  ) {
    throw new AdminAuthError("Alleen een actieve super_admin mag rollen wijzigen.");
  }
  if (!target || target.accountKind !== "staff" || !target.staffRole) {
    throw new AdminAuthError("Medewerker niet gevonden.");
  }
  if (target.status === "blocked" || target.blockedAt) {
    throw new AdminAuthError("Herstel of nodig de medewerker opnieuw uit voordat je de rol wijzigt.");
  }
  if (!nextRole || (nextRole !== "admin" && nextRole !== "super_admin")) {
    throw new AdminAuthError("Ongeldige rol.");
  }
  if (target.staffRole === nextRole) {
    throw new AdminAuthError("Deze medewerker heeft die rol al.");
  }
  if (nextRole === "super_admin" && input.rosterSuperAdminCount >= MAX_SUPER_ADMINS) {
    throw new AdminAuthError(
      `Er mogen maximaal ${MAX_SUPER_ADMINS} super admins zijn (jij + één andere). Degradeer eerst een bestaande super admin naar admin.`,
    );
  }
  if (
    target.staffRole === "super_admin" &&
    nextRole === "admin" &&
    input.activeSuperAdminCount <= 1
  ) {
    throw new AdminAuthError(
      "Je kunt de laatste actieve super_admin niet degraderen. Wijs eerst een tweede super_admin aan.",
    );
  }
}

/**
 * Invited staff who never reached `active` can be hard-removed from Auth on delete
 * so a later invite can use a clean generateLink({ type: "invite" }) flow.
 * Active staff stay soft-blocked for audit retention.
 */
export function shouldHardDeleteStaffOnRemove(
  profile: Pick<StaffUserProfile, "status">,
): boolean {
  return profile.status === "invited";
}

/** Map Supabase Auth generateLink errors to Dutch operator-facing messages. */
export function staffInviteAuthLinkErrorMessage(raw: string | null | undefined): string {
  const msg = raw?.trim() ?? "";
  if (!msg) {
    return "Uitnodigingslink kon niet worden aangemaakt. Probeer het later opnieuw.";
  }
  if (/rate limit/i.test(msg)) {
    return "Te veel uitnodigingspogingen. Wacht even en probeer het opnieuw.";
  }
  if (/redirect|requested path is invalid/i.test(msg)) {
    return "Uitnodigingslink kon niet worden aangemaakt: redirect-URL is ongeldig. Controleer STAFF_INVITE_REDIRECT_URL / VITE_ADMIN_ORIGIN.";
  }
  return `Uitnodigingslink kon niet worden aangemaakt: ${msg}`;
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

/** Map staff_invitations DB/PostgREST failures to Dutch operator-facing messages. */
export function staffInvitationDbErrorMessage(
  raw: string,
  context: "invite" | "recovery" = "invite",
): string {
  const privateHint = messageIfPrivateSchemaMissing(raw);
  if (privateHint) return privateHint;

  if (
    /staff_invitation_purpose|\bpurpose\b/i.test(raw) &&
    /(does not exist|schema cache|could not find|unknown column)/i.test(raw)
  ) {
    return "Database-migratie voor uitnodigingsdoel ontbreekt. Voer `supabase db push` (migratie 20260802170000_staff_invitation_purpose.sql) uit en herlaad het API-schema in Supabase voordat je MFA-accountherstel gebruikt.";
  }

  if (/staff_invitations_one_active_email_uq|duplicate key.*staff_invitations/i.test(raw)) {
    return "Er staat al een openstaande uitnodiging voor dit e-mailadres. Probeer het opnieuw; als het probleem blijft, controleer private.staff_invitations of neem contact op met support.";
  }

  if (/violates foreign key.*invited_by/i.test(raw)) {
    return "Uitnodiging kon niet worden gekoppeld aan je account. Log opnieuw in en probeer het opnieuw.";
  }

  const prefix =
    context === "recovery"
      ? "Herstellink kon niet worden aangemaakt"
      : "Uitnodiging kon niet worden aangemaakt";

  const technical = raw.replace(/^(createStaffInvitation|getActiveStaffInvitationByEmail|revokeActiveStaffInvitationsForEmail) failed:\s*/i, "").trim();
  if (technical && technical.length <= 240) {
    return `${prefix}: ${technical}`;
  }

  return `${prefix}. Probeer het later opnieuw.`;
}
