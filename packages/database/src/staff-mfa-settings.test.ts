import { describe, expect, it } from "vitest";

import { staffFinalizeAuthenticatorReplaceSchema } from "@mccoy/validation";

describe("staffFinalizeAuthenticatorReplaceSchema", () => {
  it("requires a UUID keepFactorId", () => {
    const valid = staffFinalizeAuthenticatorReplaceSchema.safeParse({
      keepFactorId: "11111111-1111-1111-1111-111111111111",
    });
    expect(valid.success).toBe(true);

    const invalid = staffFinalizeAuthenticatorReplaceSchema.safeParse({
      keepFactorId: "not-a-uuid",
    });
    expect(invalid.success).toBe(false);
  });
});
