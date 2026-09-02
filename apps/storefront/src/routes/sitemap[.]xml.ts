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
        try {
          const result = await getPublishedSitemapXml();
          if (!result.ok || !result.xml?.includes("<loc>")) {
            // Never serve an empty urlset — crawlers treat that as "no URLs".
            return new Response("Sitemap temporarily unavailable", {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
                "Retry-After": "120",
              },
            });
          }
          return new Response(result.xml, {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=300",
            },
          });
        } catch {
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "Retry-After": "120",
            },
          });
        }
      },
    },
  },
});
