/**
 * Storefront crawl / indexing policy.
 *
 * Production (Vercel production deployments) may be indexed.
 * Preview, staging, local, and unknown hosts must stay noindex unless
 * explicitly overridden with MCCOY_ALLOW_INDEXING.
 *
 * Staging Vercel projects that use VERCEL_ENV=production must set
 * MCCOY_ALLOW_INDEXING=0 so they are never crawled.
 */

export type IndexingEnv = {
  /** Vercel: "production" | "preview" | "development" */
  vercelEnv?: string | undefined;
  nodeEnv?: string | undefined;
  /** Explicit override: "1"/"true" allow, "0"/"false" deny */
  allowIndexing?: string | undefined;
};

function normalizeFlag(value: string | undefined): "allow" | "deny" | "unset" {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "unset";
  if (v === "1" || v === "true" || v === "yes" || v === "on") return "allow";
  if (v === "0" || v === "false" || v === "no" || v === "off") return "deny";
  return "unset";
}

/**
 * Whether public storefront HTML / robots.txt should allow indexing.
 * Pure — pass an env bag in tests; production callers use {@link readIndexingEnv}.
 */
export function isStorefrontIndexable(env: IndexingEnv): boolean {
  const flag = normalizeFlag(env.allowIndexing);
  if (flag === "deny") return false;
  if (flag === "allow") return true;

  const vercel = (env.vercelEnv ?? "").trim().toLowerCase();
  if (vercel === "preview" || vercel === "development") return false;
  if (vercel === "production") return true;

  // Non-Vercel (local vite, CI, unknown): deny by default.
  return false;
}

export function storefrontRobotsMetaContent(env: IndexingEnv): "index, follow" | "noindex, nofollow" {
  return isStorefrontIndexable(env) ? "index, follow" : "noindex, nofollow";
}

/**
 * robots.txt body for the storefront.
 *
 * Production: Allow `/` (CSS/JS/assets stay crawlable — never blanket-Disallow
 * extensions or `/assets`), Disallow CMS preview surfaces, list Sitemap.
 * Non-production: Disallow `/` and omit Sitemap.
 *
 * @param sitemapUrl Absolute www sitemap URL when indexing is allowed (optional).
 */
export function storefrontRobotsTxt(env: IndexingEnv, sitemapUrl?: string): string {
  if (!isStorefrontIndexable(env)) {
    return [
      "# Non-production / preview — do not index",
      "User-agent: *",
      "Disallow: /",
      "",
    ].join("\n");
  }

  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /cms-preview",
    "Disallow: /cms-sync",
  ];
  if (sitemapUrl) {
    lines.push(`Sitemap: ${sitemapUrl}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function readIndexingEnv(): IndexingEnv {
  return {
    vercelEnv: typeof process !== "undefined" ? process.env.VERCEL_ENV : undefined,
    nodeEnv: typeof process !== "undefined" ? process.env.NODE_ENV : undefined,
    allowIndexing:
      typeof process !== "undefined" ? process.env.MCCOY_ALLOW_INDEXING : undefined,
  };
}
