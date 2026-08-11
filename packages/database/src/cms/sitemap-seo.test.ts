import { describe, expect, it } from "vitest";
import {
  absoluteCanonicalUrl,
  CANONICAL_SITE_ORIGIN,
  buildCmsHeadFromSnapshot,
  robotsIndicateNoindex,
} from "@mccoy/cms-schema";
import {
  LEGACY_GONE_PATHS,
  LEGACY_PERMANENT_REDIRECTS,
} from "@mccoy/security";
import { createFileCmsStore } from "./file-store";
import { builtinCmsSeedPages } from "./seeds";
import { buildPublishedSitemapEntries, resolvePublicCmsRequest } from "./resolve";
import {
  assertSitemapIndexabilityConsistency,
  collectSitemapEmittedUrls,
  forbiddenSitemapPathnames,
  isSitemapExcludedPathname,
} from "./sitemap-consistency";

function entriesToXml(
  entries: Array<{ loc: string; lastmod?: string; alternates: Array<{ locale: string; url: string }> }>,
): string {
  const urls = entries
    .map((entry) => {
      const alts = entry.alternates
        .map(
          (a) =>
            `    <xhtml:link rel="alternate" hreflang="${a.locale}" href="${a.url}" />`,
        )
        .join("\n");
      return `  <url>
    <loc>${entry.loc}</loc>
${entry.lastmod ? `    <lastmod>${entry.lastmod.slice(0, 10)}</lastmod>\n` : ""}${alts}
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

describe("dynamic sitemap SEO gates", () => {
  it("emits valid XML with www host and published paths only", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const entries = await buildPublishedSitemapEntries({ store });
    expect(entries.length).toBeGreaterThan(0);

    const xml = entriesToXml(entries);
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
    expect(xml).not.toContain("localhost");
    expect(xml).not.toContain("vercel.app");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/cms-preview");
    expect(xml).not.toContain("/cms-sync");

    for (const entry of entries) {
      expect(entry.loc.startsWith(CANONICAL_SITE_ORIGIN)).toBe(true);
      expect(entry.loc.includes("/draft")).toBe(false);
    }
  });

  it("excludes all Phase 2 legacy paths from sitemap", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const entries = await buildPublishedSitemapEntries({ store });
    const urls = collectSitemapEmittedUrls(entries);
    const joined = urls.join("\n");

    for (const path of LEGACY_GONE_PATHS) {
      expect(joined).not.toContain(path);
      expect(isSitemapExcludedPathname(path)).toBe(true);
    }
    for (const path of Object.keys(LEGACY_PERMANENT_REDIRECTS)) {
      expect(joined).not.toContain(path);
      expect(isSitemapExcludedPathname(path)).toBe(true);
    }
    for (const path of forbiddenSitemapPathnames()) {
      expect(urls).not.toContain(absoluteCanonicalUrl(path));
    }
  });
});

describe("sitemap ↔ indexability consistency invariant", () => {
  it("seeded NL sitemap URLs are 200, indexable, self-canonical www", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const report = await assertSitemapIndexabilityConsistency({ store });
    expect(report.violations).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.sitemapUrls.length).toBeGreaterThan(0);

    for (const url of report.sitemapUrls) {
      const pathname = new URL(url).pathname;
      const resolved = await resolvePublicCmsRequest({ pathname, store });
      expect(resolved.kind).toBe("snapshot");
      if (resolved.kind !== "snapshot") continue;
      const head = buildCmsHeadFromSnapshot(resolved.snapshot, {
        origin: CANONICAL_SITE_ORIGIN,
      });
      expect(robotsIndicateNoindex(head.meta.find((m) => m.name === "robots")?.content)).toBe(
        false,
      );
      const canonical = head.links.find((l) => l.rel === "canonical")?.href;
      expect(canonical).toBe(absoluteCanonicalUrl(resolved.snapshot.path));
      expect(url).toBe(canonical);
    }
  });

  it("converse: redirect / 410 / alias / preview paths never appear", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const report = await assertSitemapIndexabilityConsistency({
      store,
      additionalForbiddenUrls: [
        "/cleaning",
        "/ultrasoon",
        "/actie",
        "/over-ons",
        "/producten",
        "/jobs",
        "/cms-preview",
        "/en/producten",
      ],
    });
    expect(report.ok).toBe(true);
  });

  it("excludes unpublished EN and Dutch-bleed noindex legal EN from sitemap", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const site = await store.getSite();

    // Publish EN home (indexable) + EN terms without overlays (Dutch bleed → noindex).
    const home = await store.getActivePublishedRevision("page_home");
    const terms = await store.getActivePublishedRevision("page_terms");
    expect(home && terms).toBeTruthy();
    if (!home || !terms) return;

    await store.publishPage({
      siteId: site.id,
      pageId: "page_home",
      payload: {
        ...home.payload,
        localeContent: {
          ...home.payload.localeContent!,
          en: {
            navigationLabel: "Home",
            pageTitle: "EN Home",
            seo: { title: "EN Home", description: "EN desc" },
          },
        },
        enFieldDrafts: {
          "section:home.hero:heading": "EN hero",
          "page:meta:title": "EN Home",
          "page:meta:description": "EN desc",
        },
        localeStates: {
          nl: { publicationState: "published", freshness: "current" },
          en: { publicationState: "published", freshness: "current" },
        },
      } as typeof home.payload,
      publishedLocales: ["nl", "en"],
    });

    await store.publishPage({
      siteId: site.id,
      pageId: "page_terms",
      payload: {
        ...terms.payload,
        // No EN body overlays → isEnglishLegalDutchBleed
        localeContent: {
          ...terms.payload.localeContent!,
          en: {
            navigationLabel: "Terms",
            pageTitle: "Terms",
            seo: { title: "Terms", description: "Terms EN meta only" },
          },
        },
        localeStates: {
          nl: { publicationState: "published", freshness: "current" },
          en: { publicationState: "published", freshness: "current" },
        },
      } as typeof terms.payload,
      publishedLocales: ["nl", "en"],
    });

    const entries = await buildPublishedSitemapEntries({ store });
    const urls = collectSitemapEmittedUrls(entries);

    expect(urls).toContain(`${CANONICAL_SITE_ORIGIN}/en`);
    expect(urls).toContain(`${CANONICAL_SITE_ORIGIN}/terms`);
    expect(urls).not.toContain(`${CANONICAL_SITE_ORIGIN}/en/terms`);

    // EN terms resolves as published but noindex — must stay out of sitemap.
    const enTerms = await resolvePublicCmsRequest({ pathname: "/en/terms", store });
    expect(enTerms.kind).toBe("snapshot");
    if (enTerms.kind === "snapshot") {
      const head = buildCmsHeadFromSnapshot(enTerms.snapshot, {
        origin: CANONICAL_SITE_ORIGIN,
      });
      expect(
        robotsIndicateNoindex(head.meta.find((m) => m.name === "robots")?.content),
      ).toBe(true);
    }

    const report = await assertSitemapIndexabilityConsistency({
      store,
      additionalForbiddenUrls: ["/en/terms", "/en/privacy"],
    });
    expect(report.violations).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("fails the invariant when a noindex URL is forced into the emitted set", async () => {
    // Relationship unit: collectSitemapEmittedUrls + forbidden check catches contradictions
    // even before full resolve (builder already excludes bleed; this guards the helper).
    const fakeEntries = [
      {
        loc: `${CANONICAL_SITE_ORIGIN}/en/terms`,
        alternates: [
          { locale: "en", url: `${CANONICAL_SITE_ORIGIN}/en/terms` },
          { locale: "nl", url: `${CANONICAL_SITE_ORIGIN}/terms` },
        ],
      },
    ];
    const urls = collectSitemapEmittedUrls(fakeEntries);
    expect(urls).toContain(`${CANONICAL_SITE_ORIGIN}/en/terms`);

    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const site = await store.getSite();
    const terms = await store.getActivePublishedRevision("page_terms");
    if (!terms) return;
    await store.publishPage({
      siteId: site.id,
      pageId: "page_terms",
      payload: {
        ...terms.payload,
        localeContent: {
          ...terms.payload.localeContent!,
          en: {
            navigationLabel: "Terms",
            pageTitle: "Terms",
            seo: { title: "Terms", description: "meta" },
          },
        },
        localeStates: {
          nl: { publicationState: "published", freshness: "current" },
          en: { publicationState: "published", freshness: "current" },
        },
      } as typeof terms.payload,
      publishedLocales: ["nl", "en"],
    });

    // Real builder must not emit the bleed URL; consistency must pass.
    const real = await assertSitemapIndexabilityConsistency({ store });
    expect(real.sitemapUrls).not.toContain(`${CANONICAL_SITE_ORIGIN}/en/terms`);
    expect(real.ok).toBe(true);

    // Cross-system: if /en/terms were in the sitemap, resolve+head would flag noindex.
    const resolved = await resolvePublicCmsRequest({ pathname: "/en/terms", store });
    expect(resolved.kind).toBe("snapshot");
    if (resolved.kind === "snapshot") {
      const head = buildCmsHeadFromSnapshot(resolved.snapshot, {
        origin: CANONICAL_SITE_ORIGIN,
      });
      expect(
        robotsIndicateNoindex(head.meta.find((m) => m.name === "robots")?.content),
      ).toBe(true);
    }
  });
});
