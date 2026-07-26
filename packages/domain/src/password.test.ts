import { describe, expect, it } from "vitest";

import {
  isStaffPasswordStrong,
  staffPasswordStrengthError,
  STAFF_PASSWORD_MIN_LENGTH,
} from "./password";

describe("staffPasswordStrengthError", () => {
  it("rejects short passwords with a Dutch message", () => {
    expect(staffPasswordStrengthError("Ab1")).toBe(
      `Wachtwoord moet minimaal ${STAFF_PASSWORD_MIN_LENGTH} tekens zijn.`,
    );
    expect(isStaffPasswordStrong("Ab1cdefgh")).toBe(false);
  });

  it("requires lowercase, uppercase, and digit", () => {
    expect(staffPasswordStrengthError("abcdefghij1")).toBe(
      "Wachtwoord moet minstens één hoofdletter bevatten.",
    );
    expect(staffPasswordStrengthError("ABCDEFGHIJ1")).toBe(
      "Wachtwoord moet minstens één kleine letter bevatten.",
    );
    expect(staffPasswordStrengthError("Abcdefghij")).toBe(
      "Wachtwoord moet minstens één cijfer bevatten.",
    );
  });

  it("accepts a strong password", () => {
    expect(staffPasswordStrengthError("Abcdefghij1")).toBeNull();
    expect(isStaffPasswordStrong("Abcdefghij1")).toBe(true);
  });
});
