import { describe, expect, it } from "vitest";
import {
  encodeWebsiteRequestInboxId,
  resolveAdminNotificationDestination,
  resolveInquiryNotificationHref,
} from "./destinations";

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
      `/admin/inquiries?id=${encodeURIComponent(encodeWebsiteRequestInboxId(requestId))}`,
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

  it("falls back to allowlisted path", () => {
    expect(resolveAdminNotificationDestination("/admin/inquiries")).toBe("/admin/inquiries");
    expect(resolveAdminNotificationDestination("/evil")).toBe("/admin");
  });
});
