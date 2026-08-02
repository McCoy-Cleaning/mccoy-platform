import { describe, expect, it } from "vitest";

import {
  buildStaffAuthAppLink,
  normalizeStaffAuthAppLinkType,
  resolveStaffAuthEmailLink,
  withInviteRedirectTo,
} from "./staff-auth-app-link";

describe("buildStaffAuthAppLink", () => {
  it("builds a direct /admin/invite URL with token_hash and type", () => {
    const url = buildStaffAuthAppLink({
      redirectTo: "https://admin.example.com/admin/invite",
      hashedToken: "abc123",
      type: "invite",
    });
    expect(url).toBe("https://admin.example.com/admin/invite?token_hash=abc123&type=invite");
  });

  it("preserves existing query params on redirectTo", () => {
    const url = buildStaffAuthAppLink({
      redirectTo: "https://admin.example.com/admin/invite?lang=nl",
      hashedToken: "tok",
      type: "recovery",
    });
    expect(url).toContain("lang=nl");
    expect(url).toContain("token_hash=tok");
    expect(url).toContain("type=recovery");
  });
});

describe("resolveStaffAuthEmailLink", () => {
  it("prefers app link over Supabase action_link", () => {
    const link = resolveStaffAuthEmailLink({
      redirectTo: "https://admin.example.com/admin/invite",
      properties: {
        action_link:
          "https://xxx.supabase.co/auth/v1/verify?token=legacy&type=invite&redirect_to=https%3A%2F%2Fwrong.example",
        hashed_token: "hashed",
        verification_type: "invite",
      },
    });
    expect(link).toBe("https://admin.example.com/admin/invite?token_hash=hashed&type=invite");
    expect(link).not.toContain("supabase.co");
  });

  it("falls back to action_link with redirect_to when hashed_token is missing", () => {
    const link = resolveStaffAuthEmailLink({
      redirectTo: "https://admin.example.com/admin/invite",
      properties: {
        action_link: "https://xxx.supabase.co/auth/v1/verify?token=legacy&type=recovery",
        hashed_token: null,
        verification_type: "recovery",
      },
    });
    expect(link).toBe(
      "https://xxx.supabase.co/auth/v1/verify?token=legacy&type=recovery&redirect_to=https%3A%2F%2Fadmin.example.com%2Fadmin%2Finvite",
    );
  });

  it("returns null when no link material is present", () => {
    expect(
      resolveStaffAuthEmailLink({
        redirectTo: "https://admin.example.com/admin/invite",
        properties: {},
      }),
    ).toBeNull();
  });
});

describe("normalizeStaffAuthAppLinkType", () => {
  it("accepts known verification types", () => {
    expect(normalizeStaffAuthAppLinkType("invite")).toBe("invite");
    expect(normalizeStaffAuthAppLinkType("RECOVERY")).toBe("recovery");
  });

  it("rejects unknown types", () => {
    expect(normalizeStaffAuthAppLinkType("email_change_new")).toBeNull();
  });
});

describe("withInviteRedirectTo", () => {
  it("sets redirect_to on action links", () => {
    const out = withInviteRedirectTo(
      "https://xxx.supabase.co/auth/v1/verify?token=t&type=invite",
      "https://admin.example.com/admin/invite",
    );
    expect(out).toContain("redirect_to=https%3A%2F%2Fadmin.example.com%2Fadmin%2Finvite");
  });
});
