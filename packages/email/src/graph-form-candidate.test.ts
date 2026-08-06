import { describe, expect, it } from "vitest";

import {
  formKindFromInternetHeaders,
  hasMcCoyFormMarkerHeaders,
  isMcCoyWebsiteFormNotificationGraph,
  isReplyOrForwardSubject,
  looksLikeFormCandidate,
} from "./graph-mail";

describe("website form inbox filtering", () => {
  it("detects X-McCoy-Form marker headers for current and future custom forms", () => {
    const headers = [
      { name: "X-McCoy-Form-Kind", value: "glass_washing" },
      { name: "X-McCoy-Form-Id", value: "page_custom:block_abc" },
    ];
    expect(hasMcCoyFormMarkerHeaders(headers)).toBe(true);
    expect(formKindFromInternetHeaders(headers)).toBe("glass_washing");
  });

  it("maps unknown custom form kinds to inquiry (Algemeen tab)", () => {
    const headers = [
      { name: "X-McCoy-Form-Kind", value: "custom_event_booking" },
      { name: "X-McCoy-Form-Id", value: "page_events:form_1" },
    ];
    expect(hasMcCoyFormMarkerHeaders(headers)).toBe(true);
    expect(formKindFromInternetHeaders(headers)).toBe("inquiry");
  });

  it("treats Form-Id alone as a form marker (future custom forms)", () => {
    const headers = [{ name: "X-McCoy-Form-Id", value: "page_x:source_y" }];
    expect(hasMcCoyFormMarkerHeaders(headers)).toBe(true);
    expect(formKindFromInternetHeaders(headers)).toBe("inquiry");
  });

  it("rejects reply/forward subjects without form headers", () => {
    expect(isReplyOrForwardSubject("Re: Algemene aanvraag — Anna")).toBe(true);
    expect(
      looksLikeFormCandidate({
        subject: "Re: Algemene aanvraag — Anna",
        bodyPreview: "Hallo",
        from: { emailAddress: { name: "McCoy Website", address: "info@mccoy.nl" } },
      }),
    ).toBe(false);
  });

  it("rejects Dutch/German Outlook reply prefixes (AW/WG) as form candidates", () => {
    expect(isReplyOrForwardSubject("AW: Algemene aanvraag — Anna (WR-2026-00001)")).toBe(true);
    expect(isReplyOrForwardSubject("WG: Algemene aanvraag — Anna")).toBe(true);
    expect(
      looksLikeFormCandidate({
        subject: "AW: Algemene aanvraag — Anna (WR-2026-00001)",
        bodyPreview:
          "Dank u.\n\n> Verstuurd via het McCoy websiteformulier\n> Algemene aanvraag",
        from: { emailAddress: { name: "Anna", address: "anna@example.com" } },
      }),
    ).toBe(false);
  });

  it("does not treat an applicant reply with a quoted form footer as a new form", () => {
    expect(
      looksLikeFormCandidate({
        subject: "Algemene aanvraag — Anna (WR-2026-00001)",
        bodyPreview:
          "Hier mijn antwoord.\n\nVerstuurd via het McCoy websiteformulier",
        from: { emailAddress: { name: "Anna", address: "anna@example.com" } },
      }),
    ).toBe(false);
  });

  it("keeps original form subjects from the configured sender", () => {
    expect(
      looksLikeFormCandidate({
        subject: "Algemene aanvraag — Anna",
        bodyPreview: "Verstuurd via het McCoy websiteformulier",
        from: { emailAddress: { name: "McCoy Website", address: "info@mccoy.nl" } },
      }),
    ).toBe(true);
  });

  it("does not treat arbitrary mailbox mail as a form candidate", () => {
    expect(
      looksLikeFormCandidate({
        subject: "Factuur Q2",
        bodyPreview: "Zie bijlage",
        from: { emailAddress: { name: "Boekhouding", address: "admin@example.com" } },
      }),
    ).toBe(false);
  });

  it("recognizes the form footer without treating bare @mccoy.nl as enough alone", () => {
    expect(
      isMcCoyWebsiteFormNotificationGraph({
        fromName: "Someone",
        fromAddress: "random@mccoy.nl",
        text: "",
        html: "",
      }),
    ).toBe(false);

    expect(
      isMcCoyWebsiteFormNotificationGraph({
        fromName: "Someone",
        fromAddress: "random@mccoy.nl",
        text: "Verstuurd via het McCoy websiteformulier",
        html: "",
      }),
    ).toBe(true);
  });
});
