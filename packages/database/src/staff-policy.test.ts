import { describe, expect, it } from "vitest";

import { AdminAuthError } from "@mccoy/security";
import { STAFF_AUDIT_ACTIONS } from "@mccoy/domain";

import {
  assertActiveSuperAdminActor,
  assertCanChangeStaffRole,
  assertCanRecoverStaffAccount,
  assertStaffProfileAllowsAdminSession,
  decideStaffInviteForExistingEmail,
  messageIfPrivateSchemaMissing,
  staffInvitationDbErrorMessage,
  shouldAbortSuperAdminBootstrap,
  shouldHardDeleteStaffOnRemove,
  staffInviteAuthLinkErrorMessage,
} from "./staff-policy";

describe("decideStaffInviteForExistingEmail", () => {
  it("allows reinstate for blocked staff", () => {
    expect(
      decideStaffInviteForExistingEmail({ status: "blocked", blockedAt: "2026-01-01T00:00:00Z" }),
    ).toBe("reinstate_blocked");
    expect(decideStaffInviteForExistingEmail({ status: "active", blockedAt: "2026-01-01T00:00:00Z" })).toBe(
      "reinstate_blocked",
    );
  });

  it("rejects active staff for generic reinvite (use account recovery instead)", () => {
    expect(decideStaffInviteForExistingEmail({ status: "active", blockedAt: null })).toBe(
      "reject_duplicate",
    );
  });

  it("resends for invited staff who have not completed onboarding", () => {
    expect(decideStaffInviteForExistingEmail({ status: "invited", blockedAt: null })).toBe(
      "resend_invite",
    );
  });

  it("creates new when no existing profile", () => {
    expect(decideStaffInviteForExistingEmail(null)).toBe("create_new");
  });
});

describe("shouldHardDeleteStaffOnRemove", () => {
  it("hard-deletes invited staff only", () => {
    expect(shouldHardDeleteStaffOnRemove({ status: "invited" })).toBe(true);
    expect(shouldHardDeleteStaffOnRemove({ status: "active" })).toBe(false);
    expect(shouldHardDeleteStaffOnRemove({ status: "blocked" })).toBe(false);
  });
});

describe("staffInviteAuthLinkErrorMessage", () => {
  it("maps rate limits and empty errors to Dutch messages", () => {
    expect(staffInviteAuthLinkErrorMessage(null)).toMatch(/kon niet worden aangemaakt/i);
    expect(staffInviteAuthLinkErrorMessage("Email rate limit exceeded")).toMatch(/Te veel/i);
    expect(staffInviteAuthLinkErrorMessage("requested path is invalid")).toMatch(/redirect/i);
  });
});

describe("assertActiveSuperAdminActor (items 25–26)", () => {
  const activeSuper = {
    accountKind: "staff" as const,
    staffRole: "super_admin" as const,
    status: "active" as const,
    blockedAt: null,
  };

  it("rejects non-super_admin session roles", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "u1",
        sessionStaffRole: "admin",
        actor: { ...activeSuper, staffRole: "admin" },
      }),
    ).toThrow(AdminAuthError);
  });

  it("rejects missing session user (service/anon cannot satisfy this gate)", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: null,
        sessionStaffRole: "super_admin",
        actor: activeSuper,
      }),
    ).toThrow(AdminAuthError);
  });

  it("rejects inactive or blocked super_admin actors", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "u1",
        sessionStaffRole: "super_admin",
        actor: { ...activeSuper, status: "invited" },
      }),
    ).toThrow(AdminAuthError);
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "u1",
        sessionStaffRole: "super_admin",
        actor: { ...activeSuper, blockedAt: "2026-01-01T00:00:00Z" },
      }),
    ).toThrow(AdminAuthError);
  });

  it("allows an active super_admin", () => {
    expect(() =>
      assertActiveSuperAdminActor({
        sessionUserId: "u1",
        sessionStaffRole: "super_admin",
        actor: activeSuper,
      }),
    ).not.toThrow();
  });
});

describe("assertStaffProfileAllowsAdminSession (item 27)", () => {
  it("rejects blocked staff", () => {
    expect(() =>
      assertStaffProfileAllowsAdminSession({
        accountKind: "staff",
        staffRole: "admin",
        status: "blocked",
        blockedAt: "2026-01-01T00:00:00Z",
      }),
    ).toThrow(/geblokkeerd/i);
  });

  it("allows active staff", () => {
    expect(() =>
      assertStaffProfileAllowsAdminSession({
        accountKind: "staff",
        staffRole: "admin",
        status: "active",
        blockedAt: null,
      }),
    ).not.toThrow();
  });
});

describe("shouldAbortSuperAdminBootstrap (item 28)", () => {
  it("aborts when any super_admin already exists", () => {
    expect(shouldAbortSuperAdminBootstrap(0)).toBe(false);
    expect(shouldAbortSuperAdminBootstrap(1)).toBe(true);
    expect(shouldAbortSuperAdminBootstrap(3)).toBe(true);
  });
});

describe("staff.unblocked audit vocabulary", () => {
  it("includes staff.unblocked, staff.invitation_resent, and staff.mfa_reset", () => {
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.unblocked");
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.invitation_resent");
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.mfa_reset");
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.role_changed");
  });
});

describe("assertCanChangeStaffRole", () => {
  const activeSuper = {
    id: "super-1",
    accountKind: "staff" as const,
    staffRole: "super_admin" as const,
    status: "active" as const,
    blockedAt: null,
  };
  const activeAdmin = {
    id: "admin-1",
    accountKind: "staff" as const,
    staffRole: "admin" as const,
    status: "active" as const,
    blockedAt: null,
  };

  it("allows promoting an admin to super_admin when under the cap", () => {
    expect(() =>
      assertCanChangeStaffRole({
        actorUserId: activeSuper.id,
        actor: activeSuper,
        target: activeAdmin,
        nextRole: "super_admin",
        rosterSuperAdminCount: 1,
        activeSuperAdminCount: 1,
      }),
    ).not.toThrow();
  });

  it("blocks promoting a third super_admin", () => {
    expect(() =>
      assertCanChangeStaffRole({
        actorUserId: activeSuper.id,
        actor: activeSuper,
        target: activeAdmin,
        nextRole: "super_admin",
        rosterSuperAdminCount: 2,
        activeSuperAdminCount: 2,
      }),
    ).toThrow(/maximaal 2 super admins/i);
  });

  it("blocks demoting the last active super_admin", () => {
    expect(() =>
      assertCanChangeStaffRole({
        actorUserId: activeSuper.id,
        actor: activeSuper,
        target: activeSuper,
        nextRole: "admin",
        rosterSuperAdminCount: 1,
        activeSuperAdminCount: 1,
      }),
    ).toThrow(/laatste actieve super_admin/i);
  });

  it("allows demoting a super_admin when another remains", () => {
    expect(() =>
      assertCanChangeStaffRole({
        actorUserId: activeSuper.id,
        actor: activeSuper,
        target: { ...activeSuper, id: "super-2" },
        nextRole: "admin",
        rosterSuperAdminCount: 2,
        activeSuperAdminCount: 2,
      }),
    ).not.toThrow();
  });
});

describe("assertCanRecoverStaffAccount", () => {
  const activeSuper = {
    id: "super-1",
    accountKind: "staff" as const,
    staffRole: "super_admin" as const,
    status: "active" as const,
    blockedAt: null,
  };
  const activeAdmin = {
    id: "admin-1",
    accountKind: "staff" as const,
    staffRole: "admin" as const,
    status: "active" as const,
    blockedAt: null,
  };

  it("requires super_admin at aal2 and rejects self-targeting", () => {
    expect(() =>
      assertCanRecoverStaffAccount({
        actorUserId: activeSuper.id,
        actorAal: "aal1",
        actor: activeSuper,
        target: activeAdmin,
      }),
    ).toThrow(/aal2/i);

    expect(() =>
      assertCanRecoverStaffAccount({
        actorUserId: activeSuper.id,
        actorAal: "aal2",
        actor: activeSuper,
        target: activeSuper,
      }),
    ).toThrow(/eigen account/i);
  });

  it("allows recovery for another active staff member", () => {
    expect(() =>
      assertCanRecoverStaffAccount({
        actorUserId: activeSuper.id,
        actorAal: "aal2",
        actor: activeSuper,
        target: activeAdmin,
      }),
    ).not.toThrow();
  });

  it("rejects blocked and invited targets", () => {
    expect(() =>
      assertCanRecoverStaffAccount({
        actorUserId: activeSuper.id,
        actorAal: "aal2",
        actor: activeSuper,
        target: { ...activeAdmin, status: "blocked", blockedAt: "2026-01-01T00:00:00Z" },
      }),
    ).toThrow(/uitnodiging/i);

    expect(() =>
      assertCanRecoverStaffAccount({
        actorUserId: activeSuper.id,
        actorAal: "aal2",
        actor: activeSuper,
        target: { ...activeAdmin, status: "invited" },
      }),
    ).toThrow(/actieve medewerkers/i);
  });
});

describe("messageIfPrivateSchemaMissing", () => {
  it("detects Invalid schema: private", () => {
    const msg = messageIfPrivateSchemaMissing("Invalid schema: private");
    expect(msg).toMatch(/private-schema/i);
    expect(messageIfPrivateSchemaMissing("other")).toBeNull();
  });
});

describe("staffInvitationDbErrorMessage", () => {
  it("maps missing private schema", () => {
    expect(staffInvitationDbErrorMessage("Invalid schema: private")).toMatch(/private-schema/i);
  });

  it("maps missing purpose column to migration guidance", () => {
    expect(
      staffInvitationDbErrorMessage(
        "createStaffInvitation failed: Could not find the 'purpose' column of 'staff_invitations' in the schema cache",
      ),
    ).toMatch(/20260802170000_staff_invitation_purpose/);
  });

  it("maps duplicate active invite constraint", () => {
    expect(
      staffInvitationDbErrorMessage(
        'duplicate key value violates unique constraint "staff_invitations_one_active_email_uq"',
      ),
    ).toMatch(/openstaande uitnodiging/i);
  });

  it("includes short technical detail for unknown errors", () => {
    expect(staffInvitationDbErrorMessage("createStaffInvitation failed: permission denied")).toMatch(
      /permission denied/i,
    );
  });

  it("uses recovery prefix when requested", () => {
    expect(staffInvitationDbErrorMessage("createStaffInvitation failed: boom", "recovery")).toMatch(
      /Herstellink kon niet worden aangemaakt: boom/,
    );
  });
});
