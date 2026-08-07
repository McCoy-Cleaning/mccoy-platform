import { describe, expect, it } from "vitest";
import {
  applyEnFieldDraftsToPage,
  ensureEnglishLocaleContentFromDrafts,
  enFieldDraftPath,
  localizeCmsPageForLocale,
  mergeEnFieldDrafts,
  parseEnFieldDraftPath,
  setValueAtDotPath,
} from "./en-field-drafts";
import type { BuiltinCmsPage, CustomCmsPage } from "./types";

describe("enFieldDraftPath", () => {
  it("builds and parses stable paths", () => {
    const path = enFieldDraftPath("section", "home.hero", "heading");
    expect(path).toBe("section:home.hero:heading");
    expect(parseEnFieldDraftPath(path)).toEqual({
      scope: "section",
      id: "home.hero",
      field: "heading",
    });
  });

  it("merges and clears drafts", () => {
    const merged = mergeEnFieldDrafts({ a: "1" }, { a: "", b: "two" });
    expect(merged).toEqual({ b: "two" });
  });
});

describe("setValueAtDotPath", () => {
  it("sets nested object paths", () => {
    const root: Record<string, unknown> = { primaryCta: { label: "NL" } };
    setValueAtDotPath(root, "primaryCta.label", "EN");
    expect(root).toEqual({ primaryCta: { label: "EN" } });
  });

  it("sets array index paths", () => {
    const root: Record<string, unknown> = {
      cards: [{ title: "A" }, { title: "B" }],
    };
    setValueAtDotPath(root, "cards.1.title", "EN B");
    expect((root.cards as Array<{ title: string }>)[1]?.title).toBe("EN B");
  });

  it("sets assortment feature paths by item id (colon and dotted)", () => {
    const root: Record<string, unknown> = {
      features: [
        { id: "prod_hygiene", title: "NL", body: "NL body" },
        { id: "prod_soaps", title: "NL2", body: "NL2 body" },
      ],
    };
    setValueAtDotPath(root, "features:prod_hygiene:title", "Hygiene paper");
    setValueAtDotPath(root, "features.prod_soaps.body", "Soaps EN");
    const features = root.features as Array<{ id: string; title: string; body: string }>;
    expect(features[0]).toMatchObject({ title: "Hygiene paper", body: "NL body" });
    expect(features[1]).toMatchObject({ title: "NL2", body: "Soaps EN" });
  });
});

describe("localizeCmsPageForLocale", () => {
  const builtin = (): BuiltinCmsPage =>
    ({
      id: "page_home",
      kind: "builtin",
      isCustom: false,
      pageKey: "home",
      slug: "/",
      title: "Home",
      description: "NL",
      inNav: true,
      blocks: [
        {
          id: "blk_1",
          type: "richText",
          data: { heading: "NL heading", body: "NL body" },
        },
        {
          id: "blk_assort",
          type: "featureGrid",
          data: {
            presentation: "productsAssortment",
            title: "McCoy Cleaning Products",
            features: [
              { id: "prod_hygiene", icon: "sparkles", title: "Hygiëne papier", body: "NL desc" },
            ],
          },
        },
      ],
      layout: [],
      layoutVersion: 1,
      sectionContent: {
        "home.hero": {
          heading: "NL hero",
          body: "NL body",
          primaryCta: { label: "Offerte", link: { type: "internal_route", route: "offerte" } },
        },
      },
      enFieldDrafts: {
        "section:home.hero:heading": "EN hero",
        "section:home.hero:primaryCta.label": "Request a quote",
        "block:blk_1:heading": "EN heading",
        "block:blk_assort:features:prod_hygiene:title": "Hygiene paper",
        "block:blk_assort:features:prod_hygiene:body": "EN desc",
        "page:meta:title": "Home EN",
      },
      updatedAt: 1,
      version: 1,
    }) as unknown as BuiltinCmsPage;

  it("builds localeContent.en from meta drafts when missing", () => {
    const page = builtin();
    page.enFieldDrafts = {
      "page:meta:title": "EN Title",
      "page:meta:description": "EN Description",
    };
    delete (page as { localeContent?: unknown }).localeContent;
    const next = ensureEnglishLocaleContentFromDrafts(page);
    expect(next.localeContent?.en?.seo.title).toBe("EN Title");
    expect(next.localeContent?.en?.seo.description).toBe("EN Description");
  });

  it("leaves NL page body unchanged", () => {
    const page = builtin();
    const localized = localizeCmsPageForLocale(page, "nl");
    expect(localized).toBe(page);
    expect(localized.kind === "builtin" && localized.sectionContent["home.hero"]).toMatchObject({
      heading: "NL hero",
    });
  });

  it("overlays EN drafts onto section and block fields", () => {
    const localized = localizeCmsPageForLocale(builtin(), "en");
    expect(localized.kind === "builtin" && localized.sectionContent["home.hero"]).toMatchObject({
      heading: "EN hero",
      body: "NL body",
      primaryCta: { label: "Request a quote" },
    });
    expect(localized.blocks[0]?.data).toMatchObject({
      heading: "EN heading",
      body: "NL body",
    });
    expect(localized.localeContent?.en?.seo.title).toBe("Home EN");
  });

  it("overlays remapped assortment feature drafts by card id", () => {
    const localized = localizeCmsPageForLocale(builtin(), "en");
    const assort = localized.blocks.find((b) => b.id === "blk_assort");
    expect(assort?.data).toMatchObject({
      features: [{ id: "prod_hygiene", title: "Hygiene paper", body: "EN desc" }],
    });
  });

  it("does not invent EN when drafts are missing", () => {
    const page = builtin();
    delete page.enFieldDrafts;
    const localized = applyEnFieldDraftsToPage(page);
    expect(localized.kind === "builtin" && localized.sectionContent["home.hero"]).toMatchObject({
      heading: "NL hero",
    });
  });

  it("overlays contact form labels/placeholders even when leaf is email|phone", () => {
    const page = builtin();
    page.sectionContent = {
      ...page.sectionContent,
      "contact.form": {
        labels: { name: "Naam", email: "E-mail", phone: "Telefoon" },
        placeholders: { email: "naam@bedrijf.nl", phone: "06 …" },
        submitLabel: "Verstuur aanvraag",
      },
    };
    page.enFieldDrafts = {
      ...(page.enFieldDrafts ?? {}),
      "section:contact.form:labels.email": "Email",
      "section:contact.form:labels.phone": "Phone",
      "section:contact.form:placeholders.email": "name@company.com",
      "section:contact.form:submitLabel": "Send request",
    };
    const localized = localizeCmsPageForLocale(page, "en");
    expect(localized.kind === "builtin" && localized.sectionContent?.["contact.form"]).toMatchObject({
      labels: { name: "Naam", email: "Email", phone: "Phone" },
      placeholders: { email: "name@company.com", phone: "06 …" },
      submitLabel: "Send request",
    });
  });

  it("mirrors NL blank-line paragraph structure onto EN drafts", () => {
    const page = builtin();
    page.sectionContent = {
      ...page.sectionContent,
      "products.main": {
        eyebrow: "Ons assortiment",
        heading: "McCoy Cleaning Products",
        intro: "Eerste alinea.\n\n\nTweede alinea.\n\nDerde alinea.",
        body: "",
      },
    };
    page.enFieldDrafts = {
      ...(page.enFieldDrafts ?? {}),
      "section:products.main:intro": "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
    };
    const localized = localizeCmsPageForLocale(page, "en");
    expect(localized.kind === "builtin" && localized.sectionContent?.["products.main"]).toMatchObject({
      intro: "First paragraph.\n\n\nSecond paragraph.\n\nThird paragraph.",
    });
  });

  it("localizes custom page blocks", () => {
    const page = {
      id: "page_custom",
      kind: "custom",
      isCustom: true,
      slug: "/custom",
      title: "Custom",
      description: "",
      inNav: false,
      blocks: [{ id: "b1", type: "richText", data: { html: "<p>NL</p>" } }],
      layout: [],
      layoutVersion: 1,
      enFieldDrafts: { "block:b1:html": "<p>EN</p>" },
      updatedAt: 1,
      version: 1,
    } as unknown as CustomCmsPage;
    const localized = localizeCmsPageForLocale(page, "en");
    expect(localized.blocks[0]?.data.html).toBe("<p>EN</p>");
  });

  it("overlays block:X:body EN draft when NL body is present", () => {
    const page = {
      ...builtin(),
      id: "page_products",
      pageKey: "products",
      blocks: [
        {
          id: "b_cv7xo09j",
          type: "gallery",
          data: {
            title: "NL title",
            body: "NL gallery intro",
            images: [
              {
                id: "img_q4fpvnop",
                image: { src: "/x.jpg", alt: "x", decorative: false },
                body: "NL image body",
              },
            ],
          },
        },
        {
          id: "b_ha9mlx32",
          type: "featureGrid",
          data: {
            presentation: "productsAssortment",
            title: "Assortiment",
            features: [
              { id: "prod_hygiene", title: "Hygiëne", body: "NL feature body" },
            ],
          },
        },
      ],
      enFieldDrafts: {
        "block:b_cv7xo09j:body": "Quality starts with the right products",
        "block:b_cv7xo09j:images.img_q4fpvnop.body": "EN image body",
        "block:b_ha9mlx32:features.prod_hygiene.body": "EN feature body",
      },
    } as unknown as BuiltinCmsPage;
    const localized = localizeCmsPageForLocale(page, "en");
    const gallery = localized.blocks.find((b) => b.id === "b_cv7xo09j");
    const features = localized.blocks.find((b) => b.id === "b_ha9mlx32");
    expect(gallery?.data).toMatchObject({
      body: "Quality starts with the right products",
      images: [{ id: "img_q4fpvnop", body: "EN image body" }],
    });
    expect(features?.data).toMatchObject({
      features: [{ id: "prod_hygiene", body: "EN feature body" }],
    });
  });

  it("does not overlay structural presentation/contentMode EN drafts", () => {
    const page = {
      ...builtin(),
      id: "page_products",
      pageKey: "products",
      blocks: [
        {
          id: "blk_assort",
          type: "featureGrid",
          data: {
            presentation: "productsAssortment",
            title: "Assortiment",
            features: [{ id: "prod_hygiene", title: "Hygiëne", body: "NL" }],
          },
        },
        {
          id: "b_ha9mlx32",
          type: "gallery",
          data: {
            title: "Een blik op wat wij doen",
            contentMode: "textAndImage",
            images: [],
          },
        },
      ],
      enFieldDrafts: {
        "block:blk_assort:presentation": "Product Assortment",
        "block:blk_assort:features.prod_hygiene.body": "EN feature",
        "block:b_ha9mlx32:contentMode": "Text and image",
        "block:b_ha9mlx32:title": "A look at what we do",
      },
    } as unknown as BuiltinCmsPage;
    const localized = localizeCmsPageForLocale(page, "en");
    const assortment = localized.blocks.find((b) => b.id === "blk_assort");
    const gallery = localized.blocks.find((b) => b.id === "b_ha9mlx32");
    expect(assortment?.data).toMatchObject({
      presentation: "productsAssortment",
      features: [{ id: "prod_hygiene", body: "EN feature" }],
    });
    expect(gallery?.data).toMatchObject({
      contentMode: "textAndImage",
      title: "A look at what we do",
    });
  });

  it("overlays block:X:body EN draft even when NL body is null/empty", () => {
    const page = {
      ...builtin(),
      id: "page_products",
      pageKey: "products",
      blocks: [
        {
          id: "b_cv7xo09j",
          type: "gallery",
          data: { title: "NL title", body: null, images: [] },
        },
      ],
      enFieldDrafts: {
        "block:b_cv7xo09j:body": "Quality starts with the right products",
      },
    } as unknown as BuiltinCmsPage;
    const localized = localizeCmsPageForLocale(page, "en");
    expect(localized.blocks.find((b) => b.id === "b_cv7xo09j")?.data).toMatchObject({
      body: "Quality starts with the right products",
    });
  });
});
