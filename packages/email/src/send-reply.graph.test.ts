import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendGraphAdminReply = vi.fn();

vi.mock("./graph-mail", () => ({
  sendGraphAdminReply: (...args: unknown[]) => sendGraphAdminReply(...args),
}));

vi.mock("./form-inbox-provider", () => ({
  shouldAttemptGraphMail: () => true,
}));

vi.mock("./graph-config", () => ({
  isGraphMailConfigured: () => true,
}));

const sendSmtpMail = vi.fn();

vi.mock("./smtp", () => ({
  defaultTransactionalFrom: () => "McCoy <info@mccoy.nl>",
  isSmtpConfigured: () => true,
  sendSmtpMail: (...args: unknown[]) => sendSmtpMail(...args),
}));

import { sendAdminReplyEmail } from "./send-reply";

const KEYS = ["MCCOY_E2E", "FORM_TO_EMAIL", "GRAPH_MAILBOX", "SMTP_REPLY_TO"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.FORM_TO_EMAIL = "info@mccoy.nl";
  process.env.GRAPH_MAILBOX = "info@mccoy.nl";
  vi.clearAllMocks();
});

afterEach(() => {
  for (const key of KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("sendAdminReplyEmail Graph reply path", () => {
  it("uses Graph createReply parent id instead of standalone sendMail for inquiry replies", async () => {
    sendGraphAdminReply.mockResolvedValue({
      ok: true,
      internetMessageId: "<out@mccoy.nl>",
      graphMessageId: "sent-1",
      conversationId: "conv-1",
      sentAt: "2026-08-06T12:00:00.000Z",
    });

    const result = await sendAdminReplyEmail({
      to: "anna@example.com",
      subject: "Re: Algemene aanvraag — Anna (WR-2026-00001)",
      body: "Dank voor uw bericht.",
      requestNumber: "WR-2026-00001",
      inReplyTo: "<form-root@mccoy.nl>",
      inboxMessageId: "graph:info%40mccoy.nl:parent-graph-id",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedGraphReply).toBe(true);
    expect(result.internetMessageId).toBe("<out@mccoy.nl>");
    expect(result.conversationId).toBe("conv-1");
    expect(sendGraphAdminReply).toHaveBeenCalledTimes(1);
    const args = sendGraphAdminReply.mock.calls[0]?.[0] as {
      inReplyToGraphId?: string;
      to: string;
    };
    expect(args.inReplyToGraphId).toBe("parent-graph-id");
    expect(args.to).toBe("anna@example.com");
  });

  it("does not pass a Graph parent for request-only ids (no silent wrong reply target)", async () => {
    sendGraphAdminReply.mockResolvedValue({ ok: true });

    await sendAdminReplyEmail({
      to: "anna@example.com",
      subject: "Re: Algemene aanvraag",
      body: "Hallo",
      requestNumber: "WR-2026-00001",
      inboxMessageId: "req:website-requests:11111111-1111-1111-1111-111111111111",
    });

    const args = sendGraphAdminReply.mock.calls[0]?.[0] as {
      inReplyToGraphId?: string;
    };
    expect(args.inReplyToGraphId).toBeUndefined();
  });

  it("does not fall back to SMTP when Graph is configured (avoids M365 535 masking)", async () => {
    sendGraphAdminReply.mockResolvedValue({
      ok: false,
      error: "Microsoft Graph-fout (ErrorInvalidPropertySet). Set action is invalid for property.",
    });

    const result = await sendAdminReplyEmail({
      to: "anna@example.com",
      subject: "Re: test",
      body: "Hallo",
      requestNumber: "WR-2026-00001",
      inboxMessageId: "graph:info%40mccoy.nl:parent-id",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/ErrorInvalidPropertySet/);
    expect(sendSmtpMail).not.toHaveBeenCalled();
  });
});
