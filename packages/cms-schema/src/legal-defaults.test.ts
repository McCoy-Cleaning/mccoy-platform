import { describe, expect, it } from "vitest";
import {
  defaultPrivacyMainContent,
  defaultTermsMainContent,
  legalMainContentSchema,
  parseSectionContent,
} from "./index";

describe("legal page section content", () => {
  it("parses default privacy content", () => {
    const def = defaultPrivacyMainContent();
    expect(legalMainContentSchema.safeParse(def).success).toBe(true);
    expect(parseSectionContent("privacy.main", def)?.heading).toBe("Privacyverklaring");
    expect(def.articles.length).toBeGreaterThan(5);
  });

  it("parses default terms content", () => {
    const def = defaultTermsMainContent();
    expect(legalMainContentSchema.safeParse(def).success).toBe(true);
    expect(parseSectionContent("terms.main", def)?.heading).toBe("Algemene Voorwaarden");
    expect(def.articles.some((a) => a.title.includes("Artikel 1"))).toBe(true);
  });
});
