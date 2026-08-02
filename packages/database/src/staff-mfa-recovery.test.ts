import { describe, expect, it } from "vitest";

import {
  isStaffInvitationAcceptable,
  isStaffMfaRecoveryInvitation,
  isStaffMfaRecoveryProfileEligible,
  shouldDeferStaffActivationForMfaRecovery,
  type StaffInvitationRow,
} from "./staff";

function invitation(overrides: Partial<StaffInvitationRow> = {}): StaffInvitationRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: "admin@example.com",
    email_normalized: "admin@example.com",
    intended_role: "admin",
    purpose: "onboard",
    status: "sent",
    auth_user_id: "22222222-2222-2222-2222-222222222222",
    invited_by: "33333333-3333-3333-3333-333333333333",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    accepted_at: null,
    last_error_code: null,
    attempt_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("isStaffMfaRecoveryInvitation", () => {
  it("identifies MFA recovery invitations", () => {
    expect(isStaffMfaRecoveryInvitation(invitation({ purpose: "mfa_recovery" }))).toBe(true);
    expect(isStaffMfaRecoveryInvitation(invitation({ purpose: "onboard" }))).toBe(false);
  });
});

describe("staff invitation purpose distinction", () => {
  it("accepts pending mfa_recovery invites for enrollment", () => {
    expect(isStaffInvitationAcceptable(invitation({ purpose: "mfa_recovery", status: "sent" }))).toEqual({
      ok: true,
    });
  });

  it("accepts pending onboard invites for password registration", () => {
    expect(isStaffInvitationAcceptable(invitation({ purpose: "onboard", status: "pending" }))).toEqual({
      ok: true,
    });
  });
});

describe("shouldDeferStaffActivationForMfaRecovery", () => {
  it("defers activation while mfa_recovery invite is pending", () => {
    expect(
      shouldDeferStaffActivationForMfaRecovery(
        invitation({ purpose: "mfa_recovery", status: "sent" }),
      ),
    ).toBe(true);
  });

  it("does not defer for onboard invites", () => {
    expect(
      shouldDeferStaffActivationForMfaRecovery(invitation({ purpose: "onboard", status: "sent" })),
    ).toBe(false);
  });

  it("does not defer after mfa_recovery invite is accepted", () => {
    expect(
      shouldDeferStaffActivationForMfaRecovery(
        invitation({ purpose: "mfa_recovery", status: "accepted" }),
      ),
    ).toBe(false);
  });
});

describe("isStaffMfaRecoveryProfileEligible", () => {
  it("allows invited users with pending mfa_recovery invite", () => {
    expect(
      isStaffMfaRecoveryProfileEligible(
        { status: "invited" },
        invitation({ purpose: "mfa_recovery", status: "sent" }),
      ),
    ).toBe(true);
  });

  it("allows active users when recovery invite is not yet accepted", () => {
    expect(
      isStaffMfaRecoveryProfileEligible(
        { status: "active" },
        invitation({ purpose: "mfa_recovery", status: "sent" }),
      ),
    ).toBe(true);
  });

  it("rejects active users after recovery invite was accepted", () => {
    expect(
      isStaffMfaRecoveryProfileEligible(
        { status: "active" },
        invitation({ purpose: "mfa_recovery", status: "accepted" }),
      ),
    ).toBe(false);
  });

  it("rejects onboard invitations", () => {
    expect(
      isStaffMfaRecoveryProfileEligible(
        { status: "invited" },
        invitation({ purpose: "onboard", status: "sent" }),
      ),
    ).toBe(false);
  });
});
