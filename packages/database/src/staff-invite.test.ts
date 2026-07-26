import { describe, expect, it } from "vitest";

import { isStaffInvitationAcceptable, type StaffInvitationRow } from "./staff";

function invitation(overrides: Partial<StaffInvitationRow> = {}): StaffInvitationRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: "admin@example.com",
    email_normalized: "admin@example.com",
    intended_role: "admin",
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

describe("isStaffInvitationAcceptable", () => {
  it("accepts pending and sent invites that are not expired", () => {
    expect(isStaffInvitationAcceptable(invitation({ status: "pending" })).ok).toBe(true);
    expect(isStaffInvitationAcceptable(invitation({ status: "sent" })).ok).toBe(true);
  });

  it("rejects revoked, failed, expired, and already accepted", () => {
    expect(isStaffInvitationAcceptable(invitation({ status: "revoked" }))).toEqual({
      ok: false,
      reason: "revoked",
    });
    expect(isStaffInvitationAcceptable(invitation({ status: "failed" }))).toEqual({
      ok: false,
      reason: "failed",
    });
    expect(isStaffInvitationAcceptable(invitation({ status: "accepted" }))).toEqual({
      ok: false,
      reason: "already_accepted",
    });
    expect(isStaffInvitationAcceptable(invitation({ status: "expired" }))).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects when expires_at is in the past", () => {
    const result = isStaffInvitationAcceptable(
      invitation({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    );
    expect(result).toEqual({ ok: false, reason: "expired" });
  });
});
