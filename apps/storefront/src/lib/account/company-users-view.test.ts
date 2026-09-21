import { describe, expect, it } from "vitest";

import {
  canSubmitInvite,
  teamMemberActions,
  teamMemberDisplayName,
  teamMemberRoleLabel,
  teamMemberStatusLabel,
  type TeamMemberRow,
} from "./company-users-view";

function member(overrides: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    userId: "user-1",
    email: "anna@example.nl",
    fullName: "Anna de Vries",
    role: "user",
    membershipStatus: "active",
    ...overrides,
  };
}

describe("teamMemberDisplayName", () => {
  it("falls back to the email when no name is recorded", () => {
    expect(teamMemberDisplayName(member())).toBe("Anna de Vries");
    expect(teamMemberDisplayName(member({ fullName: null }))).toBe("anna@example.nl");
    expect(teamMemberDisplayName(member({ fullName: "   " }))).toBe("anna@example.nl");
  });
});

describe("teamMemberRoleLabel / teamMemberStatusLabel", () => {
  it("labels roles and membership states in Dutch", () => {
    expect(teamMemberRoleLabel(member({ role: "account_admin" }))).toBe("Accountbeheerder");
    expect(teamMemberRoleLabel(member())).toBe("Gebruiker");
    expect(teamMemberStatusLabel(member())).toBe("Actief");
    expect(teamMemberStatusLabel(member({ membershipStatus: "suspended" }))).toBe("Opgeschort");
  });
});

describe("teamMemberActions", () => {
  it("offers suspend for an active ordinary member", () => {
    expect(teamMemberActions(member(), null)).toEqual({
      pending: false,
      canSuspend: true,
      canReactivate: false,
    });
  });

  it("offers reactivate for a suspended member", () => {
    expect(teamMemberActions(member({ membershipStatus: "suspended" }), null)).toEqual({
      pending: false,
      canSuspend: false,
      canReactivate: true,
    });
  });

  it("never offers suspend for the account admin", () => {
    const actions = teamMemberActions(member({ role: "account_admin" }), null);
    expect(actions.canSuspend).toBe(false);
  });

  it("withdraws both controls while that member's mutation is unsettled", () => {
    // Prevents a second suspend request from the same row before the first settles.
    const actions = teamMemberActions(member(), "user-1");
    expect(actions).toEqual({ pending: true, canSuspend: false, canReactivate: false });
  });

  it("leaves other rows operable while one row is pending", () => {
    const other = teamMemberActions(member({ userId: "user-2" }), "user-1");
    expect(other.pending).toBe(false);
    expect(other.canSuspend).toBe(true);
  });

  it("still offers reactivate to a suspended admin", () => {
    const actions = teamMemberActions(
      member({ role: "account_admin", membershipStatus: "suspended" }),
      null,
    );
    expect(actions.canReactivate).toBe(true);
  });
});

describe("canSubmitInvite", () => {
  const complete = { firstName: "Anna", lastName: "de Vries", email: "anna@example.nl" };

  it("allows submission once the required fields are filled", () => {
    expect(canSubmitInvite({ ...complete, submitting: false })).toBe(true);
  });

  it("blocks a second submission while the invite is in flight", () => {
    // Without this the same invite email can be sent twice on a double click.
    expect(canSubmitInvite({ ...complete, submitting: true })).toBe(false);
  });

  it("blocks submission when a required field is blank or whitespace", () => {
    expect(canSubmitInvite({ ...complete, firstName: "", submitting: false })).toBe(false);
    expect(canSubmitInvite({ ...complete, lastName: "  ", submitting: false })).toBe(false);
    expect(canSubmitInvite({ ...complete, email: "", submitting: false })).toBe(false);
  });
});
