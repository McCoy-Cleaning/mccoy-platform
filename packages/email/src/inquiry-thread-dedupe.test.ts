import { describe, expect, it } from "vitest";
import {
  dedupeInquiryThreadItems,
  extractSimpleReplyBody,
  isTemplatedWrapOf,
  looksLikeMcCoyAdminEmailTemplate,
  normaliseThreadMessageBody,
  outboundMailDuplicatesStaffReply,
  stripQuotedReplyBody,
} from "./inquiry-thread-dedupe";

const TEMPLATE = `McCoy Cleaning
Re: Algemene aanvraag — My Name (WR-2026-00020)
Referentie: WR-2026-00020

nice tro hear that

Dit bericht is verstuurd vanuit het McCoy admin panel. Antwoord op deze e-mail bereikt het McCoy team.`;

const CUSTOMER_REPLY_WITH_QUOTE = `Thanks, that works for me.

McCoy Cleaning
Re: Algemene aanvraag — My Name (WR-2026-00020)
Referentie: WR-2026-00020

nice tro hear that

Dit bericht is verstuurd vanuit het McCoy admin panel. Antwoord op deze e-mail bereikt het McCoy team.`;

const IPHONE_REPLY_WITH_QUOTE = `I'm the one who contacted you
Sent from my iPhone
On 6 Aug 2026, at 16:13, Info | McCoy Schoonmaak en Reiniging <info@mccoy.nl> wrote:
\uFEFF McCoy Cleaning
Re: Algemene aanvraag — My Name (WR-2026-00020)
Referentie: WR-2026-00020
nice tro hear that
Dit bericht is verstuurd vanuit het McCoy admin panel. Antwoord op deze e-mail bereikt het McCoy team.`;

const IPHONE_REPLY_ENTITY_BOM = `I'm the one who contacted you Sent from my iPhone
On 6 Aug 2026, at 16:13, Info | McCoy Schoonmaak en Reiniging <info@mccoy.nl> wrote:
&#65279; McCoy Cleaning
Re: Algemene aanvraag — My Name (WR-2026-00020)
Referentie: WR-2026-00020
nice tro hear that
Dit bericht is verstuurd vanuit het McCoy admin panel. Antwoord op deze e-mail bereikt het McCoy team.`;

const IPHONE_REPLY_CR_ONLY = [
  "I'm the one who contacted you",
  "Sent from my iPhone",
  "On 6 Aug 2026, at 16:13, Info | McCoy Schoonmaak en Reiniging <info@mccoy.nl> wrote:",
  "McCoy Cleaning",
  "Referentie: WR-2026-00020",
  "nice tro hear that",
].join("\r");

describe("inquiry thread dedupe", () => {
  it("detects McCoy admin email templates", () => {
    expect(looksLikeMcCoyAdminEmailTemplate(TEMPLATE)).toBe(true);
    expect(looksLikeMcCoyAdminEmailTemplate("nice tro hear that")).toBe(false);
  });

  it("extracts the plain staff body from the HTML mail template text", () => {
    expect(extractSimpleReplyBody(TEMPLATE)).toBe("nice tro hear that");
  });

  it("strips quoted McCoy template from customer replies", () => {
    expect(stripQuotedReplyBody(CUSTOMER_REPLY_WITH_QUOTE)).toBe(
      "Thanks, that works for me.",
    );
  });

  it("strips iPhone On…wrote: quotes including BOM / entity prefixes", () => {
    expect(stripQuotedReplyBody(IPHONE_REPLY_WITH_QUOTE)).toBe(
      "I'm the one who contacted you\nSent from my iPhone",
    );
    expect(stripQuotedReplyBody(IPHONE_REPLY_ENTITY_BOM)).toBe(
      "I'm the one who contacted you Sent from my iPhone",
    );
    expect(stripQuotedReplyBody(IPHONE_REPLY_CR_ONLY)).toBe(
      "I'm the one who contacted you\nSent from my iPhone",
    );
  });

  it("strips quote when attribution is flattened onto one line", () => {
    const flat =
      "I'm the one who contacted you Sent from my iPhone On 6 Aug 2026, at 16:13, Info | McCoy Schoonmaak en Reiniging <info@mccoy.nl> wrote: McCoy Cleaning Referentie: WR-2026-00020 nice tro hear that";
    expect(stripQuotedReplyBody(flat)).toBe(
      "I'm the one who contacted you Sent from my iPhone",
    );
  });

  it("does not treat quoted admin text as the customer body", () => {
    expect(normaliseThreadMessageBody(CUSTOMER_REPLY_WITH_QUOTE, "inbound")).toBe(
      "Thanks, that works for me.",
    );
    expect(normaliseThreadMessageBody(CUSTOMER_REPLY_WITH_QUOTE, "customer")).toBe(
      "Thanks, that works for me.",
    );
    // Admin extractor must not run on customer mail (would return staff text).
    expect(normaliseThreadMessageBody(CUSTOMER_REPLY_WITH_QUOTE, "admin")).not.toBe(
      "Thanks, that works for me.",
    );
  });

  it("recognises template wraps of a simple reply", () => {
    expect(isTemplatedWrapOf("nice tro hear that", TEMPLATE)).toBe(true);
  });

  it("keeps the simple staff reply and drops the templated Graph copy", () => {
    const items = dedupeInquiryThreadItems([
      {
        id: "mail",
        direction: "admin" as const,
        textBody: TEMPLATE,
        date: "2026-08-06T14:13:00.000Z",
        messageId: "<a@mccoy.nl>",
        to: "oana@example.com",
      },
      {
        id: "reply",
        direction: "admin" as const,
        textBody: "nice tro hear that",
        date: "2026-08-06T14:13:05.000Z",
        messageId: "<a@mccoy.nl>",
        to: "oana@example.com",
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.textBody).toBe("nice tro hear that");
  });

  it("does not collapse admin and customer into one bubble", () => {
    const items = dedupeInquiryThreadItems([
      {
        id: "admin",
        direction: "admin" as const,
        textBody: "nice tro hear that",
        date: "2026-08-06T14:13:00.000Z",
      },
      {
        id: "customer",
        direction: "customer" as const,
        textBody: CUSTOMER_REPLY_WITH_QUOTE,
        date: "2026-08-06T14:16:00.000Z",
      },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]?.textBody).toBe("nice tro hear that");
    expect(items[1]?.textBody).toBe("Thanks, that works for me.");
  });

  it("marks outbound mail as duplicate of a staff reply without matching Message-ID", () => {
    expect(
      outboundMailDuplicatesStaffReply(
        {
          internet_message_id: null,
          body_text: TEMPLATE,
          occurred_at: "2026-08-06T14:13:00.000Z",
          recipient_addresses: ["oana@example.com"],
        },
        [
          {
            body: "nice tro hear that",
            sentAt: "2026-08-06T14:13:02.000Z",
            toEmail: "oana@example.com",
          },
        ],
      ),
    ).toBe(true);
  });

  it("keeps the customer copy with attachments when body and time match", () => {
    const items = dedupeInquiryThreadItems([
      {
        id: "req:website-requests:abc:mail:row-1",
        direction: "customer" as const,
        textBody: "Hier de foto's",
        date: "2026-08-19T11:00:00.000Z",
        messageId: "<in@yahoo.com>",
        attachments: [],
      },
      {
        id: "graph:info@mccoy.nl:g-in",
        direction: "customer" as const,
        textBody: "Hier de foto's",
        date: "2026-08-19T11:00:05.000Z",
        messageId: "<in@yahoo.com>",
        attachments: [{ filename: "keuken.jpg" }],
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("graph:info@mccoy.nl:g-in");
    expect(items[0]?.attachments).toHaveLength(1);
  });
});
