import { createFileRoute } from "@tanstack/react-router";
import {
  readIndexingEnv,
  storefrontRobotsTxt,
} from "@mccoy/security/indexing";
import { readServerEnv } from "@mccoy/security/env";

/**
 * Env-gated robots.txt — production allows crawl; preview/staging disallow.
 * Prefer this over static public/robots.txt (removed).
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const env = readIndexingEnv();
        const publicHost =
          (readServerEnv("PUBLIC_HOST") || "www.mccoy.nl,mccoy.nl")
            .split(",")[0]
            ?.trim() || "www.mccoy.nl";
        const sitemapUrl = `https://${publicHost}/sitemap.xml`;
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
