import { describe, expect, it } from "vitest";

import { FormInboxError } from "./form-inbox-contracts";
import {
  classifyGraphThreadDirection,
  isMcCoyWebsiteFormNotificationGraph,
  resolveSubmitterEmailGraph,
} from "./graph-mail";
import {
  decodeInboxMessageId,
  encodeE2eMessageId,
  encodeGraphMessageId,
  encodeImapMessageId,
  graphIdToSyntheticUid,
  INBOX_MESSAGE_ID_PATTERN,
} from "./inbox-message-id";

describe("inbox message ids", () => {
  it("round-trips IMAP ids", () => {
    const id = encodeImapMessageId(42, "INBOX");
    expect(id).toBe("imap:INBOX:42");
    expect(INBOX_MESSAGE_ID_PATTERN.test(id)).toBe(true);
    expect(decodeInboxMessageId(id)).toEqual({
      provider: "imap",
      mailbox: "INBOX",
      uid: 42,
    });
  });

  it("round-trips Graph ids with special characters", () => {
    const graphId = "AAMkAGI2TG93AAA=";
    const id = encodeGraphMessageId(graphId, "sander@mccoy.nl");
    expect(id.startsWith("graph:")).toBe(true);
    expect(INBOX_MESSAGE_ID_PATTERN.test(id)).toBe(true);
    expect(decodeInboxMessageId(id)).toEqual({
      provider: "graph",
      mailbox: "sander@mccoy.nl",
      graphId,
    });
  });

  it("round-trips E2E store ids", () => {
    const requestId = "550e8400-e29b-41d4-a716-446655440000";
    const id = encodeE2eMessageId(requestId);
    expect(INBOX_MESSAGE_ID_PATTERN.test(id)).toBe(true);
    expect(decodeInboxMessageId(id)).toEqual({
      provider: "e2e",
      mailbox: "website-requests",
      requestId,
    });
  });

  it("round-trips request store ids", async () => {
    const { encodeRequestMessageId } = await import("./inbox-message-id");
    const requestId = "550e8400-e29b-41d4-a716-446655440000";
    const id = encodeRequestMessageId(requestId);
    expect(id.startsWith("req:")).toBe(true);
    expect(INBOX_MESSAGE_ID_PATTERN.test(id)).toBe(true);
    expect(decodeInboxMessageId(id)).toEqual({
      provider: "request",
      mailbox: "website-requests",
      requestId,
    });
  });

  it("produces a stable synthetic uid", () => {
    const a = graphIdToSyntheticUid("AAMkAGI2TG93AAA=");
    const b = graphIdToSyntheticUid("AAMkAGI2TG93AAA=");
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it("rejects invalid ids", () => {
    expect(() => decodeInboxMessageId("nope")).toThrow(FormInboxError);
  });
});

describe("graph form notification helpers", () => {
  it("detects McCoy form footer text", () => {
    expect(
      isMcCoyWebsiteFormNotificationGraph({
        fromName: "Other",
        fromAddress: "other@example.com",
        text: "Verstuurd via het McCoy websiteformulier",
        html: "",
      }),
    ).toBe(true);
  });

  it("accepts SMTP auth user when it differs from SMTP_FROM_EMAIL", () => {
    const prevFrom = process.env.SMTP_FROM_EMAIL;
    const prevUser = process.env.SMTP_USER;
    process.env.SMTP_FROM_EMAIL = "info@mccoy.nl";
    process.env.SMTP_USER = "sander@mccoy.nl";
    try {
      expect(
        isMcCoyWebsiteFormNotificationGraph({
          fromName: "Sander de Boer",
          fromAddress: "sander@mccoy.nl",
          text: "Algemene aanvraag body without footer in preview",
          html: "",
        }),
      ).toBe(true);
    } finally {
      if (prevFrom === undefined) delete process.env.SMTP_FROM_EMAIL;
      else process.env.SMTP_FROM_EMAIL = prevFrom;
      if (prevUser === undefined) delete process.env.SMTP_USER;
      else process.env.SMTP_USER = prevUser;
    }
  });

  it("prefers Reply-To for submitter email", () => {
    const email = resolveSubmitterEmailGraph(
      {
        replyTo: [{ emailAddress: { address: "visitor@example.com" } }],
        from: { emailAddress: { address: "info@mccoy.nl", name: "McCoy" } },
      },
      [],
      "",
      "sander@mccoy.nl",
    );
    expect(email).toBe("visitor@example.com");
  });

  it("ignores Reply-To when it is our mailbox", () => {
    const email = resolveSubmitterEmailGraph(
      {
        replyTo: [{ emailAddress: { address: "info@mccoy.nl" } }],
        from: { emailAddress: { address: "info@mccoy.nl", name: "McCoy" } },
      },
      [{ key: "email", label: "E-mail", value: "klant@bedrijf.nl" }],
      "",
      "info@mccoy.nl",
    );
    expect(email).toBe("klant@bedrijf.nl");
  });

  it("prefers X-McCoy-Submitter-Email header", () => {
    const email = resolveSubmitterEmailGraph(
      {
        replyTo: [{ emailAddress: { address: "info@mccoy.nl" } }],
        from: { emailAddress: { address: "info@mccoy.nl", name: "McCoy" } },
      },
      [],
      "",
      "info@mccoy.nl",
      [{ name: "X-McCoy-Submitter-Email", value: "visitor@example.com" }],
    );
    expect(email).toBe("visitor@example.com");
  });

  it("uses form email field when Reply-To is absent", () => {
    const email = resolveSubmitterEmailGraph(
      {
        from: { emailAddress: { address: "info@mccoy.nl", name: "McCoy" } },
      },
      [{ key: "email", label: "E-mail", value: "klant@bedrijf.nl" }],
      "",
      "sander@mccoy.nl",
    );
    expect(email).toBe("klant@bedrijf.nl");
  });

  it("classifies form notifications as form even when From is the mailbox", () => {
    const prevFrom = process.env.SMTP_FROM_EMAIL;
    process.env.SMTP_FROM_EMAIL = "info@mccoy.nl";
    try {
      expect(
        classifyGraphThreadDirection({
          fromAddress: "info@mccoy.nl",
          fromName: "McCoy",
          subject: "Algemene aanvraag — My Name (WR-2826-00009)",
          text: "Verstuurd via het McCoy websiteformulier\nNaam: My Name",
          inboxUser: "info@mccoy.nl",
          submitter: "visitor@example.com",
        }),
      ).toBe("form");
    } finally {
      if (prevFrom === undefined) delete process.env.SMTP_FROM_EMAIL;
      else process.env.SMTP_FROM_EMAIL = prevFrom;
    }
  });

  it("classifies outbound staff replies as admin", () => {
    const prevFrom = process.env.SMTP_FROM_EMAIL;
    process.env.SMTP_FROM_EMAIL = "info@mccoy.nl";
    try {
      expect(
        classifyGraphThreadDirection({
          fromAddress: "info@mccoy.nl",
          fromName: "McCoy",
          subject: "Re: Algemene aanvraag — My Name (WR-2826-00009)",
          text: "Bedankt voor uw bericht.",
          inboxUser: "info@mccoy.nl",
          submitter: "visitor@example.com",
        }),
      ).toBe("admin");
    } finally {
      if (prevFrom === undefined) delete process.env.SMTP_FROM_EMAIL;
      else process.env.SMTP_FROM_EMAIL = prevFrom;
    }
  });
});
