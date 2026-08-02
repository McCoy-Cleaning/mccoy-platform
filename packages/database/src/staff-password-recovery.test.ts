import { describe, expect, it } from "vitest";

import { assertStaffPasswordRecoveryTotpInput } from "./staff-account";

describe("assertStaffPasswordRecoveryTotpInput", () => {
  it("does not require a code when no verified TOTP factors exist", () => {
    expect(assertStaffPasswordRecoveryTotpInput(0, undefined)).toBeNull();
    expect(assertStaffPasswordRecoveryTotpInput(0, "")).toBeNull();
    expect(assertStaffPasswordRecoveryTotpInput(0, "123456")).toBeNull();
  });

  it("requires a 6-digit code when verified TOTP factors exist", () => {
    expect(assertStaffPasswordRecoveryTotpInput(1, undefined)).toMatch(/6-cijferige/i);
    expect(assertStaffPasswordRecoveryTotpInput(1, "")).toMatch(/6-cijferige/i);
    expect(assertStaffPasswordRecoveryTotpInput(2, "   ")).toMatch(/6-cijferige/i);
  });

  it("rejects invalid TOTP formats when MFA is enrolled", () => {
    expect(assertStaffPasswordRecoveryTotpInput(1, "12345")).toMatch(/6-cijferige/i);
    expect(assertStaffPasswordRecoveryTotpInput(1, "1234567")).toMatch(/6-cijferige/i);
    expect(assertStaffPasswordRecoveryTotpInput(1, "abcdef")).toMatch(/6-cijferige/i);
  });

  it("accepts a valid 6-digit code when MFA is enrolled", () => {
    expect(assertStaffPasswordRecoveryTotpInput(1, "123456")).toBeNull();
    expect(assertStaffPasswordRecoveryTotpInput(1, " 654321 ")).toBeNull();
  });
});
