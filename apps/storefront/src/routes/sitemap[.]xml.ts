import { createFileRoute } from "@tanstack/react-router";
import { getPublishedSitemapXml } from "@/lib/api/cms-published.functions";

/**
 * Phase C5 — dynamic sitemap (published locales only).
 * Served at /sitemap.xml via server handler.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const result = await getPublishedSitemapXml();
        const xml =
          result.ok
            ? result.xml
            : `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
