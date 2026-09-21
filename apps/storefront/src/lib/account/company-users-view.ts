/**
 * View helpers for the portal "Gebruikers" list.
 *
 * Membership suspend and reactivate are access-control changes, so the UI never
 * renders them optimistically — it shows a pending state and waits for the
 * server. These helpers decide which controls a row may offer, including while a
 * mutation for that row is unsettled, so a control cannot be pressed twice.
 *
 * Hiding a control is presentation only. Authorisation is enforced server-side.
 */

export type TeamMemberRow = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  membershipStatus: string;
};

export type TeamMemberActions = {
  /** A mutation for this member has not settled yet. */
  pending: boolean;
  canSuspend: boolean;
  canReactivate: boolean;
};

export function teamMemberDisplayName(member: TeamMemberRow): string {
  const name = member.fullName?.trim();
  return name ? name : member.email;
}

export function teamMemberRoleLabel(member: TeamMemberRow): string {
  return member.role === "account_admin" ? "Accountbeheerder" : "Gebruiker";
}

export function teamMemberStatusLabel(member: TeamMemberRow): string {
  return member.membershipStatus === "active" ? "Actief" : "Opgeschort";
}

/**
 * The account admin is never suspendable from this screen: removing the last
 * administrator would lock the company out of its own portal.
 */
export function teamMemberActions(
  member: TeamMemberRow,
  pendingUserId: string | null,
): TeamMemberActions {
  const pending = pendingUserId === member.userId;
  const isAccountAdmin = member.role === "account_admin";
  return {
    pending,
    canSuspend: !pending && !isAccountAdmin && member.membershipStatus === "active",
    canReactivate: !pending && member.membershipStatus === "suspended",
  };
}

/** True when the invite form may be submitted. Blocks the duplicate-invite double click. */
export function canSubmitInvite(input: {
  firstName: string;
  lastName: string;
  email: string;
  submitting: boolean;
}): boolean {
  if (input.submitting) return false;
  return (
    input.firstName.trim().length > 0 &&
    input.lastName.trim().length > 0 &&
    input.email.trim().length > 0
  );
}
