/**
 * SEO-5 — IndexNow notify after successful CMS publish (fail-open).
 *
 * Only https://www.mccoy.nl URLs are submitted. Never localhost/dev/preview/admin/draft.
 * Publish success must not depend on IndexNow success.
 */

import type { CmsPagePublishedEvent } from "@mccoy/cms-schema";

import { registerCmsPublishHook } from "./outbox";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_CANONICAL_ORIGIN = "https://www.mccoy.nl";

const MAX_BATCH = 100;
const MAX_ATTEMPTS = 3;

export type IndexNowSubmitResult = {
  ok: boolean;
  submitted: string[];
  skipped: string[];
  attempts: number;
  error?: string;
};

function readIndexNowKey(): string {
  try {
    return (typeof process !== "undefined" ? process.env.INDEXNOW_KEY : undefined)?.trim() || "";
  } catch {
    return "";
  }
}

function isProductionIndexNowEnabled(): boolean {
  try {
    const vercel = (process.env.VERCEL_ENV ?? "").toLowerCase();
    const allow = (process.env.MCCOY_ALLOW_INDEXING ?? "").trim();
    if (allow === "0" || allow === "false") return false;
    return vercel === "production" || allow === "1" || allow === "true";
  } catch {
    return false;
  }
}

/** Validate + normalize a single URL for IndexNow. */
export function validateIndexNowUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname.toLowerCase() !== "www.mccoy.nl") return null;
  const path = url.pathname.toLowerCase();
  if (
    path.startsWith("/admin") ||
    path.startsWith("/cms-preview") ||
    path.startsWith("/cms-sync") ||
    path.includes("/draft")
  ) {
    return null;
  }
  // Drop fragment; keep path+search normalized without trailing slash (except /).
  const pathname =
    url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "") || "/";
  return `${INDEXNOW_CANONICAL_ORIGIN}${pathname}${url.search}`;
}

export function urlsFromPublishEvent(event: CmsPagePublishedEvent): string[] {
  const out: string[] = [];
  for (const path of event.changedPaths ?? []) {
    const absolute = path.startsWith("http")
      ? path
      : `${INDEXNOW_CANONICAL_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
    const valid = validateIndexNowUrl(absolute);
    if (valid) out.push(valid);
  }
  return [...new Set(out)];
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export type IndexNowFetch = typeof fetch;

/**
 * Submit URLs to IndexNow. Failures are returned — callers must not roll back publish.
 */
export async function submitIndexNowUrls(
  urls: string[],
  options?: { fetchImpl?: IndexNowFetch; key?: string },
): Promise<IndexNowSubmitResult> {
  const key = options?.key ?? readIndexNowKey();
  const skipped: string[] = [];
  const validated: string[] = [];
  for (const u of urls) {
    const v = validateIndexNowUrl(u);
    if (v) validated.push(v);
    else skipped.push(u);
  }
  const submitted = [...new Set(validated)].slice(0, MAX_BATCH);
  if (!key) {
    return { ok: false, submitted: [], skipped: [...skipped, ...submitted], attempts: 0, error: "missing_key" };
  }
  if (submitted.length === 0) {
    return { ok: true, submitted: [], skipped, attempts: 0 };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const body = {
    host: "www.mccoy.nl",
    key,
    keyLocation: `${INDEXNOW_CANONICAL_ORIGIN}/${key}.txt`,
    urlList: submitted,
  };

  let attempts = 0;
  let lastError = "";
  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const res = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      if (res.ok || res.status === 200 || res.status === 202) {
        console.info(
          JSON.stringify({
            type: "seo.indexnow.submitted",
            count: submitted.length,
            attempts,
          }),
        );
        return { ok: true, submitted, skipped, attempts };
      }
      lastError = `http_${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "fetch_failed";
    }
    if (attempts < MAX_ATTEMPTS) {
      await sleep(100 * 2 ** (attempts - 1));
    }
  }

  console.error(
    JSON.stringify({
      type: "seo.indexnow.failed",
      error: lastError,
      attempts,
      count: submitted.length,
    }),
  );
  return { ok: false, submitted, skipped, attempts, error: lastError };
}

/** Hook body — never throws to outbox consumer in a way that implies publish rollback. */
export async function notifyIndexNowForPublishEvent(
  event: CmsPagePublishedEvent,
  options?: { fetchImpl?: IndexNowFetch; key?: string; force?: boolean },
): Promise<IndexNowSubmitResult> {
  if (!options?.force && !isProductionIndexNowEnabled()) {
    return { ok: true, submitted: [], skipped: urlsFromPublishEvent(event), attempts: 0, error: "disabled_non_production" };
  }
  try {
    return await submitIndexNowUrls(urlsFromPublishEvent(event), options);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error(JSON.stringify({ type: "seo.indexnow.exception", error: message }));
    return { ok: false, submitted: [], skipped: [], attempts: 0, error: message };
  }
}

let registered = false;

/** Idempotent registration for CMS outbox drain. */
export function ensureIndexNowPublishHookRegistered(): void {
  if (registered) return;
  registered = true;
  registerCmsPublishHook(async (event) => {
    // Fail-open: log only — do not throw (would mark outbox failed / retry storm).
    await notifyIndexNowForPublishEvent(event);
  });
}
