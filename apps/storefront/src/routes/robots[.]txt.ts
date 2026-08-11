import { createFileRoute } from "@tanstack/react-router";
import {
  readIndexingEnv,
  storefrontRobotsTxt,
} from "@mccoy/security/indexing";
import { CANONICAL_PUBLIC_HOST } from "@mccoy/security/host";

/**
 * Env-gated robots.txt — production allows crawl; preview/staging disallow.
 * Sitemap line always uses the www canonical host (never preview/localhost).
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const env = readIndexingEnv();
        const sitemapUrl = `https://${CANONICAL_PUBLIC_HOST}/sitemap.xml`;
        const body = storefrontRobotsTxt(env, sitemapUrl);
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
