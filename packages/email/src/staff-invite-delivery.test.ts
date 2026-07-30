import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isStaffInviteEmailConfigured,
  shouldPreferBrandedStaffInviteFirst,
} from "./staff-invite";

const KEYS = [
  "FORM_INBOX_PROVIDER",
  "TENANT_ID",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "GRAPH_MAILBOX",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "FORM_INBOX_HOST",
  "FORM_INBOX_USER",
  "FORM_INBOX_PASS",
  "STAFF_INVITE_BRANDED_FIRST",
] as const;

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function clearEnv(): void {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv(): void {
  for (const key of KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  clearEnv();
});

afterEach(() => {
  restoreEnv();
});

describe("shouldPreferBrandedStaffInviteFirst", () => {
  it("is false when only Graph inbox is configured (Mail.Send often missing)", () => {
    process.env.FORM_INBOX_PROVIDER = "graph";
    process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.CLIENT_SECRET = "test-secret";
    process.env.GRAPH_MAILBOX = "mailbox@example.com";

    expect(isStaffInviteEmailConfigured()).toBe(true);
    expect(shouldPreferBrandedStaffInviteFirst()).toBe(false);
  });

  it("is true for usable non-M365 SMTP", () => {
    process.env.FORM_INBOX_PROVIDER = "imap";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    process.env.SMTP_PASS = "app-password";

    expect(shouldPreferBrandedStaffInviteFirst()).toBe(true);
  });

  it("is false for M365 SMTP hosts", () => {
    process.env.FORM_INBOX_PROVIDER = "imap";
    process.env.SMTP_HOST = "smtp.office365.com";
    process.env.SMTP_USER = "a@mccoy.nl";
    process.env.SMTP_PASS = "x";

    expect(shouldPreferBrandedStaffInviteFirst()).toBe(false);
  });

  it("honours STAFF_INVITE_BRANDED_FIRST=1 when Graph is configured", () => {
    process.env.FORM_INBOX_PROVIDER = "graph";
    process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.CLIENT_SECRET = "test-secret";
    process.env.GRAPH_MAILBOX = "mailbox@example.com";
    process.env.STAFF_INVITE_BRANDED_FIRST = "1";

    expect(shouldPreferBrandedStaffInviteFirst()).toBe(true);
  });
});
