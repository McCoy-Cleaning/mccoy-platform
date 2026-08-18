import { describe, expect, it } from "vitest";
import {
  encodeWebsiteRequestInboxId,
  resolveAdminNotificationDestination,
  resolveInquiryNotificationHref,
  rewriteLegacyAdminDestination,
} from "./destinations";

describe("rewriteLegacyAdminDestination", () => {
  it("drops the /admin prefix from stored destinations", () => {
    expect(rewriteLegacyAdminDestination("/admin")).toBe("/");
    expect(rewriteLegacyAdminDestination("/admin/inquiries")).toBe("/inquiries");
    expect(rewriteLegacyAdminDestination("/admin/inquiries?id=x")).toBe("/inquiries?id=x");
    expect(rewriteLegacyAdminDestination("/inquiries")).toBe("/inquiries");
  });
});

describe("resolveInquiryNotificationHref", () => {
  const requestId = "11111111-1111-4111-8111-111111111111";

  it("builds deep link from website_request.received metadata", () => {
    const href = resolveInquiryNotificationHref({
      type: "website_request.received",
      destinationPath: "/admin/inquiries",
      entityType: "website_request",
      entityId: requestId,
      metadata: { requestId, requestNumber: "WR-1", kind: "contact" },
      encodeRequestMessageId: encodeWebsiteRequestInboxId,
    });
    expect(href).toBe(
      `/inquiries?id=${encodeURIComponent(encodeWebsiteRequestInboxId(requestId))}`,
    );
  });

  it("prefers inboxMessageId when present", () => {
    const inboxMessageId = encodeWebsiteRequestInboxId(requestId);
    const href = resolveInquiryNotificationHref({
      type: "website_request.applicant_replied",
      destinationPath: "/admin/inquiries",
      metadata: { requestId, inboxMessageId },
      encodeRequestMessageId: encodeWebsiteRequestInboxId,
    });
    expect(href).toContain("id=");
    expect(href).toContain(encodeURIComponent(inboxMessageId));
  });

  it("allowlists current paths and rewrites legacy /admin destinations", () => {
    expect(resolveAdminNotificationDestination("/inquiries")).toBe("/inquiries");
    expect(resolveAdminNotificationDestination("/admin/inquiries")).toBe("/inquiries");
    expect(resolveAdminNotificationDestination("/admin")).toBe("/");
    expect(resolveAdminNotificationDestination("/evil")).toBe("/");
  });
});
