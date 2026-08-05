import { createFileCmsStore } from "./file-store";
import { builtinCmsSeedPages } from "./seeds";
import { buildPublishedSitemapEntries } from "./resolve";
import {
  getPublishedLocaleAlternates,
  resolveEnglishPathAccess,
} from "@mccoy/cms-schema";
import { describe, expect, it } from "vitest";

describe("crawler/sitemap conformance fixtures", () => {
  it("sitemap excludes unpublished EN", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const entries = await buildPublishedSitemapEntries({ store });
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.alternates.some((a) => a.locale === "nl")).toBe(true);
      expect(entry.alternates.some((a) => a.locale === "en")).toBe(false);
    }
  });

  it("alternates match getPublishedLocaleAlternates", () => {
    const alts = getPublishedLocaleAlternates(
      { nl: "/services", en: "/services" },
      {
        nl: { publicationState: "published" },
        en: { publicationState: "draft" },
      },
      { origin: "https://www.mccoy.nl" },
    );
    expect(alts.map((a) => a.locale)).toEqual(["nl", "x-default"]);
  });

  it("pending EN is 302 not 301", () => {
    const action = resolveEnglishPathAccess({
      knownPage: true,
      englishPublished: false,
      dutchPath: "/services",
      requestPath: "/en/services",
      redirects: [],
    });
    expect(action).toEqual({
      action: "redirect_pending",
      statusCode: 302,
      toPath: "/services",
    });
  });
});

describe("public path aliases", () => {
  it("redirects /en/producten and /en/jobs to canonical EN paths", async () => {
    const { resolvePublicCmsRequest } = await import("./resolve");
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());

    const producten = await resolvePublicCmsRequest({ pathname: "/en/producten", store });
    expect(producten).toEqual({
      kind: "redirect",
      statusCode: 301,
      toPath: "/en/products",
    });

    const jobs = await resolvePublicCmsRequest({ pathname: "/en/jobs", store });
    expect(jobs).toEqual({
      kind: "redirect",
      statusCode: 301,
      toPath: "/en/vacatures",
    });
  });
});
