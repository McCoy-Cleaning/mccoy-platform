import { describe, expect, it } from "vitest";
import {
  DEFAULT_SERVICE_CARD_CTA_LABEL,
  DEFAULT_SERVICE_CARD_QUOTE_CTA_LABEL,
  STOLEN_SERVICE_CARD_LEES_MEER_LABEL,
  defaultSectionContent,
  migrateServiceCardsCta,
  servicesCardsContentSchema,
  type ServicesCardsContent,
} from "./content";

const placeholderImage = {
  assetId: "local:x",
  src: "/images/cms/work-horeca.jpg",
  alt: "x",
  decorative: false,
};

describe("services.cards contact CTA model", () => {
  it("defaults include per-card contact cta (not Lees meer)", () => {
    const content = defaultSectionContent("services.cards") as ServicesCardsContent;
    expect(content.cards.length).toBeGreaterThan(0);
    for (const card of content.cards) {
      expect(card.cta?.label).not.toBe(STOLEN_SERVICE_CARD_LEES_MEER_LABEL);
      expect(card.cta?.link.type).not.toBe("none");
      expect(card.link).toBeUndefined();
    }
    expect(content.cards.find((c) => c.id === "svc_regular")?.cta).toEqual({
      label: DEFAULT_SERVICE_CARD_CTA_LABEL,
      action: "link",
      link: { type: "internal_route", route: "contact" },
    });
    expect(content.cards.find((c) => c.id === "svc_glass")?.cta).toEqual({
      label: DEFAULT_SERVICE_CARD_QUOTE_CTA_LABEL,
      action: "link",
      link: { type: "internal_route", route: "offerte" },
    });
  });

  it("schema accepts cta + legacy link", () => {
    const parsed = servicesCardsContentSchema.safeParse({
      cards: [
        {
          id: "svc_x",
          title: "X",
          description: "Y",
          image: placeholderImage,
          link: { type: "internal_route", route: "contact" },
          cta: {
            label: "Meer info",
            action: "link",
            link: { type: "external", url: "https://example.com", openInNewTab: true },
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("migrates legacy link to contact cta and drops link", () => {
    const migrated = migrateServiceCardsCta({
      cards: [
        {
          id: "svc_legacy",
          title: "Legacy",
          description: "Desc",
          image: placeholderImage,
          link: { type: "internal_route", route: "offerte" },
        },
      ],
    });
    expect(migrated.cards[0]?.cta).toEqual({
      label: DEFAULT_SERVICE_CARD_QUOTE_CTA_LABEL,
      action: "link",
      link: { type: "internal_route", route: "offerte" },
    });
    expect(migrated.cards[0]?.link).toBeUndefined();
  });

  it("repairs stolen Lees meer CTA label while keeping destination", () => {
    const migrated = migrateServiceCardsCta({
      cards: [
        {
          id: "svc_stolen",
          title: "Stolen",
          description: "Desc",
          image: placeholderImage,
          cta: {
            label: STOLEN_SERVICE_CARD_LEES_MEER_LABEL,
            action: "link",
            link: { type: "internal_route", route: "contact" },
          },
        },
      ],
    });
    expect(migrated.cards[0]?.cta).toEqual({
      label: DEFAULT_SERVICE_CARD_CTA_LABEL,
      action: "link",
      link: { type: "internal_route", route: "contact" },
    });
  });

  it("seeds geen-link contact CTA when card has neither cta nor link", () => {
    const migrated = migrateServiceCardsCta({
      cards: [
        {
          id: "svc_empty",
          title: "Empty",
          description: "Desc",
          image: placeholderImage,
        },
      ],
    });
    expect(migrated.cards[0]?.cta).toEqual({
      label: DEFAULT_SERVICE_CARD_CTA_LABEL,
      action: "link",
      link: { type: "none" },
    });
  });

  it("prefers existing custom cta over legacy link", () => {
    const migrated = migrateServiceCardsCta({
      cards: [
        {
          id: "svc_both",
          title: "Both",
          description: "Desc",
          image: placeholderImage,
          link: { type: "internal_route", route: "contact" },
          cta: {
            label: "Custom",
            action: "popup",
            link: { type: "none" },
            popup: { type: "richText", data: { title: "T", body: "B" } },
          },
        },
      ],
    });
    expect(migrated.cards[0]?.cta?.label).toBe("Custom");
    expect(migrated.cards[0]?.cta?.action).toBe("popup");
    expect(migrated.cards[0]?.link).toBeUndefined();
  });
});
