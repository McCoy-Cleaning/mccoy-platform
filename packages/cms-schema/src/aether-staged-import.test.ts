import { describe, expect, it } from "vitest";
import { applyAetherLocalePatch, mapKindToLocalePatch, normalizeAetherPageUrl, parseAetherStagedFixesDump, resolveCmsPageFromUrl } from "./aether-staged-import";
import type { CmsPage } from "./types";
import { ensurePageLocaleFields } from "./migrate-locale";

function samplePage(): CmsPage {
  return ensurePageLocaleFields({
    kind: "builtin", isCustom: false, pageKey: "services", id: "page_services", slug: "/services", title: "Diensten", description: "Aanbod",
    inNav: true, blocks: [], layout: [], layoutVersion: 0, sectionContent: {}, updatedAt: 1, version: 8,
    localeContent: { nl: { navigationLabel: "Diensten", pageTitle: "Diensten", seo: { title: "Diensten | McCoy", description: "Aanbod" } } },
    paths: { nl: "/services", en: "/services" },
  } as CmsPage);
}

describe("resolveCmsPageFromUrl", () => {
  it("maps /services and /contact", () => {
    expect(resolveCmsPageFromUrl("https://www.mccoy.nl/services")).toMatchObject({ pageId: "page_services", locale: "nl", path: "/services" });
    expect(resolveCmsPageFromUrl("https://mccoy.nl/contact/")).toMatchObject({ pageId: "page_contact", locale: "nl", path: "/contact" });
  });
  it("maps /en paths to the English locale", () => {
    expect(resolveCmsPageFromUrl("https://www.mccoy.nl/en/services")).toMatchObject({ pageId: "page_services", locale: "en", path: "/en/services" });
    expect(resolveCmsPageFromUrl("https://www.mccoy.nl/en")).toMatchObject({ pageId: "page_home", locale: "en", path: "/en" });
  });
  it("maps identity aliases", () => {
    expect(resolveCmsPageFromUrl("https://www.mccoy.nl/producten")).toMatchObject({ pageId: "page_products", identityPath: "/products" });
  });
});

describe("mapKindToLocalePatch", () => {
  it("maps title/meta/h1 onto locale SEO fields", () => {
    expect(mapKindToLocalePatch("title", "T")).toMatchObject({ cmsField: "seo.title", localePatch: { seo: { title: "T" } }, frozenLiveTitle: true });
    expect(mapKindToLocalePatch("meta_description", "M")).toMatchObject({ cmsField: "seo.description", localePatch: { seo: { description: "M" } } });
    expect(mapKindToLocalePatch("h1", "H")).toMatchObject({ cmsField: "pageTitle", localePatch: { pageTitle: "H" } });
  });
  it("skips canonical/schema/internal_link", () => {
    expect(mapKindToLocalePatch("canonical", "https://x").skipReason).toBe("canonical_not_in_mccoy_cms");
    expect(mapKindToLocalePatch("schema_jsonld", "{}").skipReason).toBe("schema_not_in_mccoy_cms");
    expect(mapKindToLocalePatch("internal_link", "/a").skipReason).toBe("internal_link_not_in_mccoy_cms");
  });
});

describe("applyAetherLocalePatch", () => {
  it("writes title/meta/h1 onto a fixture page without inventing other fields", () => {
    const next = applyAetherLocalePatch(samplePage(), "nl", { seo: { title: "New title" }, pageTitle: "New H1" });
    expect(next.localeContent?.nl?.seo?.title).toBe("New title");
    expect(next.localeContent?.nl?.seo?.description).toBe("Aanbod");
    expect(next.localeContent?.nl?.pageTitle).toBe("New H1");
    expect(next.localeContent?.nl?.navigationLabel).toBe("Diensten");
  });
});

describe("parseAetherStagedFixesDump", () => {
  it("reads a fixture dump and keeps applyable patches", () => {
    const dump = parseAetherStagedFixesDump({ version: 1, patches: [{ pageUrl: "https://www.mccoy.nl/services", kind: "title", proposedValue: "X", status: "approved" }, { pageUrl: "https://www.mccoy.nl/services", kind: "canonical", proposedValue: "https://x" }] });
    expect(dump.patches).toHaveLength(2);
    expect(resolveCmsPageFromUrl(dump.patches[0]!.pageUrl)?.pageId).toBe("page_services");
    expect(mapKindToLocalePatch(dump.patches[1]!.kind, dump.patches[1]!.proposedValue).skipReason).toBe("canonical_not_in_mccoy_cms");
  });
});
