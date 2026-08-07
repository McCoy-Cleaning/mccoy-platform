import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Dienstkaarten: edge-to-edge media + dual controls.
 * - Lees meer → fixed detail modal (section content), not CmsButton popup-block
 * - Contact CTA → CmsButtonView (geen link hides only that button)
 */
describe("ServicesCards media + dual CTAs", () => {
  it("uses object-cover, Lees meer modal, and separate contact CmsButton", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "SitePageSections.tsx"), "utf8");
    const cardsFn = src.indexOf("export function ServicesCards()");
    const afterCards = src.indexOf("/** @deprecated Prefer ServicesMain + ServicesCards", cardsFn);
    expect(cardsFn).toBeGreaterThanOrEqual(0);
    expect(afterCards).toBeGreaterThan(cardsFn);

    const servicesCardsBody = src.slice(cardsFn, afterCards);
    expect(servicesCardsBody).toContain("object-cover");
    expect(servicesCardsBody).not.toContain("object-contain");
    expect(servicesCardsBody.match(/object-cover/g)?.length).toBeGreaterThanOrEqual(2);

    expect(servicesCardsBody).toContain("createPortal");
    expect(servicesCardsBody).toContain("service-modal-panel");
    expect(servicesCardsBody).toContain("service-modal-title");
    expect(servicesCardsBody).toContain("t.services.readMore");
    expect(servicesCardsBody).toContain("setOpen(i)");
    expect(servicesCardsBody).toContain("card.full.map");

    expect(servicesCardsBody).toContain("CmsButtonView");
    // Lees meer must not be wired through the shared popup/link CTA model
    expect(servicesCardsBody).not.toMatch(/CmsButtonView[\s\S]{0,200}readMore/);
    expect(servicesCardsBody).not.toMatch(/DEFAULT_SERVICE_CARD_CTA_LABEL[\s\S]{0,80}Lees meer/);

    // Actions pinned to card bottom: Lees meer left, contact CTA right
    expect(servicesCardsBody).toContain("items-stretch");
    expect(servicesCardsBody).toContain("flex h-full flex-col");
    expect(servicesCardsBody).toContain("mt-auto flex w-full items-center justify-between gap-3");

    // Above-the-fold first row: eager + shared sizes; below-fold stays lazy.
    expect(servicesCardsBody).toContain('loading={i < 3 ? "eager" : "lazy"}');
    expect(servicesCardsBody).toContain("SERVICES_CARD_IMAGE_SIZES");

    // Fallbacks must use public CMS paths so DeliveryImage can serve WebP siblings.
    expect(src).toContain("SERVICE_CARD_FALLBACK_SRCS");
    expect(src).toContain("/images/cms/work-regular-sander.png");
    expect(src).not.toContain("@/assets/mccoy-regular-sander");
    expect(src).not.toContain("@/assets/mccoy-service-glass-van");
  });
});
