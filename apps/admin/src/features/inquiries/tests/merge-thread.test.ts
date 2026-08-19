import { describe, expect, it } from "vitest";
import type { FormInboxAttachment, FormInboxThreadItem } from "@mccoy/email/contracts";
import { mergeInquiryThreads } from "../lib/merge-thread";

function photo(filename: string): FormInboxAttachment {
  return { filename, contentType: "image/jpeg", size: 80_000, omitted: false };
}

function item(
  partial: Partial<FormInboxThreadItem> &
    Pick<FormInboxThreadItem, "id" | "direction" | "textBody" | "date">,
): FormInboxThreadItem {
  return {
    uid: 1,
    from: "klant@example.com",
    to: "info@mccoy.nl",
    subject: "Re: Aanvraag",
    messageId: null,
    attachments: [],
    ...partial,
  };
}

describe("mergeInquiryThreads", () => {
  it("keeps the hydrated graph bubble and drops the empty req: mail copy", () => {
    const previous = [
      item({
        id: "req:website-requests:abc:mail:row-1",
        direction: "customer",
        textBody: "Hier de foto's",
        date: "2026-08-19T11:00:00.000Z",
        messageId: "<in@yahoo.com>",
        attachments: [],
      }),
    ];
    const incoming = [
      item({
        id: "graph:info%40mccoy.nl:g-in",
        direction: "customer",
        textBody: "Hier de foto's",
        date: "2026-08-19T11:00:00.000Z",
        messageId: "<in@yahoo.com>",
        attachments: [photo("keuken.jpg")],
      }),
    ];

    const merged = mergeInquiryThreads(incoming, previous);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("graph:info%40mccoy.nl:g-in");
    expect(merged[0]?.attachments.map((a) => a.filename)).toEqual(["keuken.jpg"]);
  });

  it("collapses two iPhone reply pairs into the two attached graph bubbles", () => {
    const previous = [
      item({
        id: "req:website-requests:abc",
        direction: "form",
        textBody: "formulier",
        date: "2026-08-19T10:00:00.000Z",
        from: "form",
      }),
      item({
        id: "req:website-requests:abc:mail:row-1",
        direction: "customer",
        textBody: "I'm the one who contacted you\nSent from my iPhone",
        date: "2026-08-19T14:13:00.000Z",
        messageId: "<iphone-1@yahoo.com>",
        attachments: [],
      }),
      item({
        id: "req:website-requests:abc:mail:row-2",
        direction: "customer",
        textBody: "Here are more photos\nSent from my iPhone",
        date: "2026-08-19T14:20:00.000Z",
        messageId: "<iphone-2@yahoo.com>",
        attachments: [],
      }),
    ];
    const incoming = [
      item({
        id: "req:website-requests:abc",
        direction: "form",
        textBody: "formulier",
        date: "2026-08-19T10:00:00.000Z",
        from: "form",
      }),
      item({
        id: "graph:info%40mccoy.nl:g-iphone-1",
        direction: "customer",
        textBody: "I'm the one who contacted you\nSent from my iPhone",
        date: "2026-08-19T14:13:00.000Z",
        messageId: "<iphone-1@yahoo.com>",
        attachments: [photo("keuken.jpg"), photo("badkamer.jpg")],
      }),
      item({
        id: "graph:info%40mccoy.nl:g-iphone-2",
        direction: "customer",
        textBody: "Here are more photos\nSent from my iPhone",
        date: "2026-08-19T14:20:00.000Z",
        messageId: "<iphone-2@yahoo.com>",
        attachments: [photo("hal.jpg")],
      }),
    ];

    const merged = mergeInquiryThreads(incoming, previous);
    expect(merged.map((row) => row.direction)).toEqual(["form", "customer", "customer"]);
    expect(merged[1]?.id).toBe("graph:info%40mccoy.nl:g-iphone-1");
    expect(merged[1]?.attachments.map((a) => a.filename)).toEqual(["keuken.jpg", "badkamer.jpg"]);
    expect(merged[2]?.id).toBe("graph:info%40mccoy.nl:g-iphone-2");
    expect(merged[2]?.attachments.map((a) => a.filename)).toEqual(["hal.jpg"]);
  });

  it("matches a leftover req: copy by body fingerprint and a 3-minute window", () => {
    const previous = [
      item({
        id: "req:website-requests:abc:mail:old",
        direction: "customer",
        textBody: "  Hier   de FOTO's  ",
        date: "2026-08-19T11:01:30.000Z",
        messageId: null,
        attachments: [],
      }),
    ];
    const incoming = [
      item({
        id: "graph:info%40mccoy.nl:g-in",
        direction: "customer",
        textBody: "Hier de foto's",
        date: "2026-08-19T11:00:00.000Z",
        messageId: "<other@id>",
        attachments: [photo("keuken.jpg")],
      }),
    ];

    const merged = mergeInquiryThreads(incoming, previous);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("graph:info%40mccoy.nl:g-in");
  });

  it("keeps an optimistic local-reply until the server has the same admin text", () => {
    const previous = [
      item({
        id: "local-reply:req:website-requests:abc:1",
        direction: "admin",
        textBody: "We komen langs",
        date: "2026-08-19T12:00:00.000Z",
        from: "McCoy",
      }),
    ];
    const incoming = [
      item({
        id: "req:website-requests:abc",
        direction: "form",
        textBody: "formulier",
        date: "2026-08-19T10:00:00.000Z",
        from: "form",
      }),
    ];

    const pending = mergeInquiryThreads(incoming, previous);
    expect(pending.map((row) => row.id)).toEqual([
      "req:website-requests:abc",
      "local-reply:req:website-requests:abc:1",
    ]);

    const confirmed = mergeInquiryThreads(
      [
        ...incoming,
        item({
          id: "graph:info%40mccoy.nl:g-out",
          direction: "admin",
          textBody: "We komen langs",
          date: "2026-08-19T12:00:02.000Z",
          from: "McCoy",
        }),
      ],
      previous,
    );
    expect(confirmed.map((row) => row.direction)).toEqual(["form", "admin"]);
    expect(confirmed.some((row) => row.id.startsWith("local-reply:"))).toBe(false);
  });

  it("never drops a form bubble even when text and time match a customer reply", () => {
    const form = item({
      id: "req:website-requests:abc",
      direction: "form",
      textBody: "Hier de foto's",
      date: "2026-08-19T11:00:00.000Z",
      from: "form",
    });
    const customer = item({
      id: "graph:info%40mccoy.nl:g-in",
      direction: "customer",
      textBody: "Hier de foto's",
      date: "2026-08-19T11:00:10.000Z",
      attachments: [photo("keuken.jpg")],
    });

    const merged = mergeInquiryThreads([customer], [form]);
    expect(merged.map((row) => row.direction).sort()).toEqual(["customer", "form"]);
  });

  it("collapses incoming req: and graph: copies, preferring attachments then graph: id", () => {
    const merged = mergeInquiryThreads(
      [
        item({
          id: "req:website-requests:abc:mail:row-1",
          direction: "customer",
          textBody: "Hier de foto's",
          date: "2026-08-19T11:00:00.000Z",
          attachments: [],
        }),
        item({
          id: "graph:info%40mccoy.nl:g-in",
          direction: "customer",
          textBody: "Hier de foto's",
          date: "2026-08-19T11:00:00.000Z",
          attachments: [photo("keuken.jpg")],
        }),
      ],
      null,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("graph:info%40mccoy.nl:g-in");
    expect(merged[0]?.attachments).toHaveLength(1);
  });
});
