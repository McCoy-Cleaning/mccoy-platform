/** Phase 1 staff identity — domain vocabulary (no passwords / MFA secrets). */

export const ACCOUNT_KINDS = ["staff", "customer"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const STAFF_ROLES = ["super_admin", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const USER_STATUSES = ["invited", "active", "blocked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const STAFF_INVITATION_STATUSES = [
  "pending",
  "sent",
  "accepted",
  "failed",
  "revoked",
  "expired",
] as const;
export type StaffInvitationStatus = (typeof STAFF_INVITATION_STATUSES)[number];

/** Audit action codes written by trusted server use cases. */
export const STAFF_AUDIT_ACTIONS = [
  "staff.bootstrap_super_admin",
  "staff.invitation_created",
  "staff.invitation_sent",
  "staff.invitation_resent",
  "staff.invitation_revoked",
  "staff.invitation_accepted",
  "staff.invite_password_set",
  "staff.activated",
  "staff.blocked",
  "staff.unblocked",
  "staff.role_changed",
  "staff.mfa_reset",
  "staff.profile_changed",
  "staff.email_changed",
  "staff.password_changed",
  "staff.mfa_onboarding_completed",
  "cms.media.uploaded",
  "cms.media.metadata_updated",
  "cms.media.archived",
  "cms.media.restored",
  "cms.media.deleted",
  "cms.media.legacy_migrated",
  "customer.invited",
  "customer.blocked",
  "customer.unblocked",
  "customer.profile_updated",
  "customer.company_updated",
  "guest.conversion_invited",
  "guest.linked_existing",
  "order.imported",
  "commerce.fixtures_seeded",
] as const;
export type StaffAuditAction = (typeof STAFF_AUDIT_ACTIONS)[number];

export type StaffUserProfile = {
  id: string;
  accountKind: AccountKind;
  staffRole: StaffRole | null;
  status: UserStatus;
  email: string;
  fullName: string | null;
  blockedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
