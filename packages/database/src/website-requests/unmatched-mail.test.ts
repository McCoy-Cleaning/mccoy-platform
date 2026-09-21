import { describe, expect, it } from "vitest";
import { AdminAuthError } from "@mccoy/security";

import {
  assertUnmatchedMailStaffAccess,
  countOpenUnmatchedInboundMail,
  listUnmatchedInboundMail,
} from "./unmatched-mail";

describe("unmatched mail review access", () => {
  it("allows staff and denies everyone else", () => {
    expect(() => assertUnmatchedMailStaffAccess("staff")).not.toThrow();
    expect(() => assertUnmatchedMailStaffAccess("customer")).toThrow(AdminAuthError);
    expect(() => assertUnmatchedMailStaffAccess("anonymous")).toThrow(AdminAuthError);
  });

  it("refuses a non-staff read before touching the database", async () => {
    await expect(listUnmatchedInboundMail({}, "customer")).rejects.toBeInstanceOf(AdminAuthError);
    await expect(countOpenUnmatchedInboundMail("anonymous")).rejects.toBeInstanceOf(
      AdminAuthError,
    );
  });
});
