import { describe, expect, it } from "vitest";

import { STAFF_AUDIT_ACTIONS, staffPasswordStrengthError } from "@mccoy/domain";

describe("staff settings audit vocabulary", () => {
  it("includes account-change and unblock audit actions", () => {
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.profile_changed");
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.email_changed");
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.password_changed");
    expect(STAFF_AUDIT_ACTIONS).toContain("staff.unblocked");
  });
});

describe("changeOwnStaffPassword strength gate", () => {
  it("rejects weak passwords with Dutch messages", () => {
    expect(staffPasswordStrengthError("short")).toMatch(/minimaal 10/i);
    expect(staffPasswordStrengthError("alllowercase1")).toMatch(/hoofdletter/i);
  });
});
