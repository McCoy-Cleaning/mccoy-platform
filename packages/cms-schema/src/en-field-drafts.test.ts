import { describe, expect, it } from "vitest";
import {
  applyEnFieldDraftsToPage,
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
        "page:meta:title": "Home EN",
      },
      updatedAt: 1,
      version: 1,
    }) as unknown as BuiltinCmsPage;

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

  it("does not invent EN when drafts are missing", () => {
    const page = builtin();
    delete page.enFieldDrafts;
    const localized = applyEnFieldDraftsToPage(page);
    expect(localized.kind === "builtin" && localized.sectionContent["home.hero"]).toMatchObject({
      heading: "NL hero",
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
});
