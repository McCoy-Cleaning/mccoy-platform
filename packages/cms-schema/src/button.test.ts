import { describe, expect, it } from "vitest";
import {
  cmsButtonSchema,
  createDefaultBlock,
  isCmsButtonInteractive,
  isPopupContentBlockType,
  normalizeCmsButton,
  parseBlockData,
  POPUP_CONTENT_EXCLUDED_BLOCK_TYPES,
  resolveCmsButtonUiMode,
  resolveLegacyLinkAsCmsButton,
  validateCmsButtonForPublish,
} from "./index";

describe("normalizeCmsButton", () => {
  it("keeps legacy link-only buttons as link action", () => {
    const btn = normalizeCmsButton({
      label: "Contact",
      link: { type: "internal_route", route: "contact" },
    });
    expect(btn).toEqual({
      label: "Contact",
      link: { type: "internal_route", route: "contact" },
    });
    expect(resolveCmsButtonUiMode(btn!)).toBe("page");
  });

  it("normalizes popup action with default richText content", () => {
    const btn = normalizeCmsButton({
      label: "Meer info",
      action: "popup",
      link: { type: "none" },
    });
    expect(btn?.action).toBe("popup");
    expect(btn?.popup?.type).toBe("richText");
    expect(resolveCmsButtonUiMode(btn!)).toBe("popup");
    expect(isCmsButtonInteractive(btn)).toBe(true);
  });

  it("treats none link as non-interactive", () => {
    const btn = normalizeCmsButton({
      label: "Geen klik",
      link: { type: "none" },
    });
    expect(resolveCmsButtonUiMode(btn!)).toBe("none");
    expect(isCmsButtonInteractive(btn)).toBe(false);
  });

  it("keeps incomplete external URL drafts so editor mode stays Externe link", () => {
    const btn = normalizeCmsButton({
      label: "Naar site",
      link: { type: "external", url: "https://", openInNewTab: true },
    });
    expect(btn?.link).toEqual({ type: "external", url: "https://", openInNewTab: true });
    expect(resolveCmsButtonUiMode(btn!)).toBe("external");
  });

  it("returns undefined without label", () => {
    expect(normalizeCmsButton({ label: "  ", link: { type: "none" } })).toBeUndefined();
  });
});

describe("resolveLegacyLinkAsCmsButton", () => {
  it("prefers cta over legacy link", () => {
    const btn = resolveLegacyLinkAsCmsButton(
      { label: "CTA", link: { type: "internal_route", route: "offerte" } },
      { type: "internal_route", route: "contact" },
      "Fallback",
    );
    expect(btn?.label).toBe("CTA");
    expect(btn?.link).toEqual({ type: "internal_route", route: "offerte" });
  });

  it("wraps legacy link with default label", () => {
    const btn = resolveLegacyLinkAsCmsButton(
      undefined,
      { type: "internal_route", route: "contact" },
      "Productofferte aanvragen",
    );
    expect(btn).toEqual({
      label: "Productofferte aanvragen",
      action: "link",
      link: { type: "internal_route", route: "contact" },
    });
  });
});

describe("featureGrid productsAssortment CTA normalize", () => {
  it("migrates feature.link to feature.cta", () => {
    const parsed = parseBlockData("featureGrid", {
      title: "Assortiment",
      presentation: "productsAssortment",
      features: [
        {
          id: "prod_hygiene",
          icon: "sparkles",
          title: "Hygiëne",
          body: "Tekst",
          link: { type: "internal_route", route: "contact" },
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const data = parsed.data as {
      features: Array<{ cta?: { label: string; link: unknown } }>;
    };
    expect(data.features[0]?.cta?.label).toBe("Productofferte aanvragen");
    expect(data.features[0]?.cta?.link).toEqual({ type: "internal_route", route: "contact" });
  });
});

describe("popup content block types", () => {
  it("rejects CTA and popup as inner content", () => {
    for (const type of POPUP_CONTENT_EXCLUDED_BLOCK_TYPES) {
      expect(isPopupContentBlockType(type)).toBe(false);
    }
    expect(isPopupContentBlockType("video")).toBe(true);
    expect(isPopupContentBlockType("contactForm")).toBe(true);

    const ctaPopup = cmsButtonSchema.safeParse({
      label: "Open",
      action: "popup",
      link: { type: "none" },
      popup: { type: "cta", data: {} },
    });
    expect(ctaPopup.success).toBe(false);

    const nestedPopup = cmsButtonSchema.safeParse({
      label: "Open",
      action: "popup",
      link: { type: "none" },
      popup: { type: "popup", data: {} },
    });
    expect(nestedPopup.success).toBe(false);
  });

  it("drops excluded popup types during normalize", () => {
    const btn = normalizeCmsButton({
      label: "Open",
      action: "popup",
      link: { type: "none" },
      popup: { type: "cta", data: { title: "x" } },
    });
    expect(btn?.popup?.type).toBe("richText");
  });
});

describe("validateCmsButtonForPublish popup", () => {
  it("requires popup content when action is popup", () => {
    const issues = validateCmsButtonForPublish(
      { label: "Open", action: "popup", link: { type: "none" }, popup: undefined },
      ["cta"],
      () => ({ ok: true }),
    );
    // normalize fills default richText popup — so publish needs valid parse
    expect(cmsButtonSchema.safeParse({
      label: "Open",
      action: "popup",
      link: { type: "none" },
      popup: { type: "richText", data: createDefaultBlock("richText").data },
    }).success).toBe(true);

    const okIssues = validateCmsButtonForPublish(
      {
        label: "Open",
        action: "popup",
        link: { type: "none" },
        popup: { type: "richText", data: createDefaultBlock("richText").data },
      },
      ["cta"],
      (type, data) => {
        const parsed = parseBlockData(type, data);
        return parsed.ok ? { ok: true } : { ok: false, message: parsed.error };
      },
    );
    expect(okIssues).toEqual([]);
    void issues;
  });
});
