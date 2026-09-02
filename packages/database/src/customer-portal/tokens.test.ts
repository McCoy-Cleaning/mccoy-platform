import { describe, expect, it } from "vitest";

import { generateInvitationToken, hashInvitationToken } from "./tokens";

describe("customer invitation tokens", () => {
  it("generates unique high-entropy tokens", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(40);
  });

  it("hashes deterministically without storing raw token", () => {
    const raw = generateInvitationToken();
    const hash = hashInvitationToken(raw);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashInvitationToken(raw));
    expect(hash).not.toContain(raw);
  });
});
