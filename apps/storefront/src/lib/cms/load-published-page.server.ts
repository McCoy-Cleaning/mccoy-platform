import {
  buildCmsHeadFromSnapshot,
  normalizeCmsPage,
  resolvePublishedCmsPage,
  type ResolvedPublishedCmsPage,
  type SiteUrlConfig,
} from "@mccoy/cms-schema";
import {
  resolvePublicCmsRequest,
  builtinCmsSeedPages,
  getCmsStore,
  getFileCmsStore,
} from "@mccoy/database/server";

export type LoadPublishedPageResult =
  | {
      kind: "snapshot";
      snapshot: ResolvedPublishedCmsPage;
      head: ReturnType<typeof buildCmsHeadFromSnapshot>;
    }
  | {
      kind: "redirect";
      statusCode: 301 | 302 | 308;
      toPath: string;
    }
  | {
      kind: "not_found";
    };

function isHomePathname(pathname: string): boolean {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed === "/" || trimmed === "/en";
}

function homeLocale(pathname: string): "nl" | "en" {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed === "/en" || trimmed.startsWith("/en/") ? "en" : "nl";
}

/**
 * Builtin home snapshot when publish/sync is broken or missing.
 * Never depends on cms-published.json having an active revision.
 */
function buildBuiltinHomeFallback(pathname: string): Extract<LoadPublishedPageResult, { kind: "snapshot" }> {
  const locale = homeLocale(pathname);
  const seed = builtinCmsSeedPages().find((p) => p.id === "page_home");
  if (!seed) {
    throw new Error("cms: missing page_home seed");
  }

  const normalized = normalizeCmsPage(seed);
  const nlContent = normalized.localeContent!.nl;
  const page = {
    ...normalized,
    localeStates: {
      nl: { publicationState: "published" as const, freshness: "current" as const },
      en: { publicationState: "published" as const, freshness: "current" as const },
    },
    localeContent: {
      nl: nlContent,
      // EN body still uses React section defaults; SEO bag must exist for resolve.
      en: normalized.localeContent?.en ?? {
        ...nlContent,
        navigationLabel: "Home",
        pageTitle: "Home",
        seo: {
          title: "McCoy Cleaning",
          description: nlContent.seo.description,
        },
      },
    },
  };

  const site: SiteUrlConfig = { origin: "https://www.mccoy.nl" };
  const resolved = resolvePublishedCmsPage({
    page,
    revisionId: "builtin-fallback",
    publishedAt: new Date(0).toISOString(),
    locale,
    site,
    siteConfigVersion: 1,
  });
  if (!resolved.ok) {
    throw new Error(`cms: builtin home fallback failed (${resolved.reason})`);
  }
  return {
    kind: "snapshot",
    snapshot: resolved.snapshot,
    head: buildCmsHeadFromSnapshot(resolved.snapshot, site),
  };
}

function resolveStore() {
  try {
    return getCmsStore();
  } catch {
    return getFileCmsStore();
  }
}

/** Short-lived SSR cache — avoids re-resolving the same pathname on every request. */
const SNAPSHOT_CACHE_TTL_MS = 10_000;
const snapshotCache = new Map<
  string,
  { expiresAt: number; result: LoadPublishedPageResult }
>();

function readSnapshotCache(pathname: string): LoadPublishedPageResult | null {
  const hit = snapshotCache.get(pathname);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    snapshotCache.delete(pathname);
    return null;
  }
  return hit.result;
}

function writeSnapshotCache(pathname: string, result: LoadPublishedPageResult): void {
  if (result.kind === "snapshot" || result.kind === "redirect") {
    snapshotCache.set(pathname, {
      expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
      result,
    });
  }
}

/**
 * Server-only published page loader (must stay `.server.ts` so Node fs/DB
 * never enter the browser bundle).
 *
 * Home (`/` and `/en`) never returns `not_found` — builtin content always wins
 * when CMS publish/sync is incomplete or unavailable.
 */
export async function loadPublishedPageSnapshot(
  pathname: string,
): Promise<LoadPublishedPageResult> {
  const cached = readSnapshotCache(pathname);
  if (cached) return cached;

  try {
    const store = resolveStore();
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const result = await resolvePublicCmsRequest({ pathname, store });
    if (result.kind === "snapshot") {
      const loaded = {
        kind: "snapshot" as const,
        snapshot: result.snapshot,
        head: buildCmsHeadFromSnapshot(result.snapshot, result.site),
      };
      writeSnapshotCache(pathname, loaded);
      return loaded;
    }
    if (result.kind === "redirect") {
      writeSnapshotCache(pathname, result);
      return result;
    }
    if (isHomePathname(pathname)) {
      const fallback = buildBuiltinHomeFallback(pathname);
      writeSnapshotCache(pathname, fallback);
      return fallback;
    }
    return { kind: "not_found" };
  } catch (error) {
    console.error("[cms] loadPublishedPageSnapshot failed", error);
    if (isHomePathname(pathname)) {
      const fallback = buildBuiltinHomeFallback(pathname);
      writeSnapshotCache(pathname, fallback);
      return fallback;
    }
    return { kind: "not_found" };
  }
}
