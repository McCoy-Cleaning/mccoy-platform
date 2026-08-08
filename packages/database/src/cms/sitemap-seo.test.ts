import { describe, expect, it } from "vitest";
import { buildPublishedSitemapEntries } from "./resolve";
import { createFileCmsStore } from "./file-store";
import { builtinCmsSeedPages } from "./seeds";

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
      expect(entry.loc.startsWith("https://www.mccoy.nl")).toBe(true);
      expect(entry.loc.includes("/draft")).toBe(false);
    }
  });
});
