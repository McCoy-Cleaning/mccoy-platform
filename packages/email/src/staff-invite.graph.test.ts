import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendGraphAdminReply = vi.fn();
const sendSmtpMail = vi.fn();

vi.mock("./graph-mail", () => ({
  sendGraphAdminReply: (...args: unknown[]) => sendGraphAdminReply(...args),
}));

vi.mock("./smtp", () => ({
  defaultTransactionalFrom: () => "McCoy Admin <info@mccoy.nl>",
  isSmtpConfigured: () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  isSmtpUsableForOutbound: () => {
    const host = (process.env.SMTP_HOST || "").toLowerCase();
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS) && !host.includes("office365");
  },
  sendSmtpMail: (...args: unknown[]) => sendSmtpMail(...args),
}));

vi.mock("./graph-config", () => ({
  isGraphMailConfigured: () =>
    Boolean(
      process.env.TENANT_ID &&
        process.env.CLIENT_ID &&
        process.env.CLIENT_SECRET &&
        process.env.GRAPH_MAILBOX,
    ),
}));

vi.mock("./form-inbox-provider", () => ({
  shouldAttemptGraphMail: () => process.env.FORM_INBOX_PROVIDER !== "imap",
}));

const KEYS = [
  "MCCOY_E2E",
  "FORM_INBOX_PROVIDER",
  "FORM_REPLY_FORCE_TO",
  "TENANT_ID",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "GRAPH_MAILBOX",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_HOST",
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
  vi.clearAllMocks();
  sendGraphAdminReply.mockResolvedValue({ ok: true });
  sendSmtpMail.mockResolvedValue({ ok: true, messageId: "smtp-1" });
});

afterEach(() => {
  restoreEnv();
});

describe("sendStaffInviteEmail Graph delivery", () => {
  it("uses Graph with saveToSentItems true and staff mail header", async () => {
    process.env.FORM_INBOX_PROVIDER = "graph";
    process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.CLIENT_SECRET = "secret";
    process.env.GRAPH_MAILBOX = "info@mccoy.nl";

    const { sendStaffInviteEmail } = await import("./staff-invite");
    const result = await sendStaffInviteEmail({
      to: "colleague@example.com",
      inviteUrl: "https://admin.example.com/invite?token=abc",
      invitedByName: "Admin",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery).toBe("graph");
    expect(sendGraphAdminReply).toHaveBeenCalledTimes(1);
    expect(sendSmtpMail).not.toHaveBeenCalled();

    const graphArgs = sendGraphAdminReply.mock.calls[0]?.[0] as {
      to: string;
      saveToSentItems: boolean;
      headers: Record<string, string>;
      html: string;
      attachments?: Array<{ contentId?: string; isInline?: boolean }>;
    };
    expect(graphArgs.to).toBe("colleague@example.com");
    expect(graphArgs.saveToSentItems).toBe(true);
    expect(graphArgs.headers["x-mccoy-staff-mail"]).toBe("invite");
    if (graphArgs.attachments?.length) {
      expect(graphArgs.attachments[0]?.isInline).toBe(true);
      expect(graphArgs.attachments[0]?.contentId).toBe("mccoy-brand-logo");
      expect(graphArgs.html).toContain('src="cid:mccoy-brand-logo"');
    }
  });

  it("ignores FORM_REPLY_FORCE_TO and sends to the invitee email", async () => {
    process.env.FORM_INBOX_PROVIDER = "graph";
    process.env.FORM_REPLY_FORCE_TO = "maria@rekp.ai";
    process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.CLIENT_SECRET = "secret";
    process.env.GRAPH_MAILBOX = "info@mccoy.nl";

    const { sendStaffInviteEmail } = await import("./staff-invite");
    await sendStaffInviteEmail({
      to: "new.colleague@example.com",
      inviteUrl: "https://admin.example.com/invite?token=abc",
    });

    const graphArgs = sendGraphAdminReply.mock.calls[0]?.[0] as { to: string; subject: string };
    expect(graphArgs.to).toBe("new.colleague@example.com");
    expect(graphArgs.subject).not.toMatch(/\[TEST/);
  });

  it("returns Dutch Graph error without false success when Graph fails on M365", async () => {
    process.env.FORM_INBOX_PROVIDER = "graph";
    process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.CLIENT_SECRET = "secret";
    process.env.GRAPH_MAILBOX = "info@mccoy.nl";
    process.env.SMTP_HOST = "smtp.office365.com";
    process.env.SMTP_USER = "sander@mccoy.nl";
    process.env.SMTP_PASS = "secret";
    sendGraphAdminReply.mockResolvedValue({
      ok: false,
      error: "Microsoft Graph toegang geweigerd (ErrorAccessDenied).",
    });

    const { sendStaffInviteEmail } = await import("./staff-invite");
    const result = await sendStaffInviteEmail({
      to: "colleague@example.com",
      inviteUrl: "https://admin.example.com/invite?token=abc",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Graph|Mail\.Send|GRAPH_MAILBOX/i);
    }
    expect(sendSmtpMail).not.toHaveBeenCalled();
  });

  it("falls back to SMTP when Graph fails and SMTP is usable", async () => {
    process.env.FORM_INBOX_PROVIDER = "graph";
    process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.CLIENT_SECRET = "secret";
    process.env.GRAPH_MAILBOX = "info@mccoy.nl";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "a@gmail.com";
    process.env.SMTP_PASS = "app-password";
    sendGraphAdminReply.mockResolvedValue({ ok: false, error: "Graph down" });

    const { sendStaffInviteEmail } = await import("./staff-invite");
    const result = await sendStaffInviteEmail({
      to: "colleague@example.com",
      inviteUrl: "https://admin.example.com/invite?token=abc",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery).toBe("smtp");
    expect(sendGraphAdminReply).toHaveBeenCalledTimes(1);
    expect(sendSmtpMail).toHaveBeenCalledTimes(1);
  });
});
