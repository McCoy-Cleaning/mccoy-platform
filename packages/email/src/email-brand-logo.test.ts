import { describe, expect, it } from "vitest";

import {
  EMAIL_BRAND_LOGO_CID,
  embedBrandLogoCidInHtml,
  loadEmailBrandLogoAttachment,
  prepareStaffEmailHtmlForDelivery,
  resolveStaffEmailRecipientName,
  staffEmailGreeting,
} from "./email-brand-logo";
import { EMAIL_BRAND_LOGO_PRODUCTION_URL } from "./transactional-layout";

describe("resolveStaffEmailRecipientName", () => {
  it("returns trimmed name when provided", () => {
    expect(resolveStaffEmailRecipientName("  Maria  ")).toBe("Maria");
  });

  it("ignores common test placeholders", () => {
    expect(resolveStaffEmailRecipientName("Test invitee")).toBeNull();
    expect(resolveStaffEmailRecipientName("test user")).toBeNull();
  });

  it("returns null for empty values", () => {
    expect(resolveStaffEmailRecipientName("")).toBeNull();
    expect(resolveStaffEmailRecipientName(null)).toBeNull();
  });
});

describe("staffEmailGreeting", () => {
  it("uses Dutch uitgenodigde when name is missing", () => {
    expect(staffEmailGreeting(null)).toBe("Beste uitgenodigde,");
  });

  it("uses provided name in greeting", () => {
    expect(staffEmailGreeting("Jan")).toBe("Beste Jan,");
  });

  it("falls back to uitgenodigde for test placeholder names", () => {
    expect(staffEmailGreeting("Test invitee")).toBe("Beste uitgenodigde,");
  });
});

describe("prepareStaffEmailHtmlForDelivery", () => {
  it("embeds cid logo when repo asset is available", () => {
    const logo = loadEmailBrandLogoAttachment();
    if (!logo) {
      expect(logo).toBeTruthy();
      return;
    }

    const html = `<img src="${EMAIL_BRAND_LOGO_PRODUCTION_URL}" alt="McCoy" />`;
    const prepared = prepareStaffEmailHtmlForDelivery(html, EMAIL_BRAND_LOGO_PRODUCTION_URL);

    expect(prepared.inlineLogo?.contentId).toBe(EMAIL_BRAND_LOGO_CID);
    expect(prepared.html).toContain(`src="cid:${EMAIL_BRAND_LOGO_CID}"`);
    expect(prepared.html).not.toContain(EMAIL_BRAND_LOGO_PRODUCTION_URL);
  });

  it("replaces localhost logo URLs with cid when embedding", () => {
    const logo = loadEmailBrandLogoAttachment();
    if (!logo) return;

    const localhostUrl = "http://localhost:5173/images/cms/logo-mccoy.png";
    const html = embedBrandLogoCidInHtml(`<img src="${localhostUrl}" />`, localhostUrl);
    expect(html).toContain(`src="cid:${EMAIL_BRAND_LOGO_CID}"`);
  });
});
