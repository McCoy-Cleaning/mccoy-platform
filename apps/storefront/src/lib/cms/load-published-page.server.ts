import {
  buildCmsHeadFromSnapshot,
  canonicalizePublicIdentityPath,
  normalizeCmsPage,
  resolvePublishedCmsPage,
  stripLocalePrefix,
  type ResolvedPublishedCmsPage,
  type SiteUrlConfig,
} from "@mccoy/cms-schema";
import {
  resolvePublicCmsRequest,
  builtinCmsSeedPages,
  getCmsStore,
  getFileCmsStore,
  isSupabaseConnectivityError,
  markSupabaseCmsUnreachable,
  type CmsStore,
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

function pathnameLocale(pathname: string): "nl" | "en" {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed === "/en" || trimmed.startsWith("/en/") ? "en" : "nl";
}

function isHomePathname(pathname: string): boolean {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed === "/" || trimmed === "/en";
}

/** Map public identity path → builtin seed page id. */
function builtinPageIdForPathname(pathname: string): string | null {
  const identity = canonicalizePublicIdentityPath(
    stripLocalePrefix(pathname).path.replace(/\/+$/, "") || "/",
  );
  const byPath: Record<string, string> = {
    "/": "page_home",
    "/about": "page_about",
    "/services": "page_services",
    "/products": "page_products",
    "/contact": "page_contact",
    "/vacatures": "page_vacatures",
    "/offerte": "page_offerte",
    "/privacy": "page_privacy",
    "/terms": "page_terms",
  };
  return byPath[identity] ?? null;
}

/**
 * Builtin snapshot when the primary CMS store has no published revision
 * (e.g. Supabase lag vs file seed, or incomplete remote publish).
 */
function buildBuiltinSeedFallback(
  pathname: string,
  pageId: string,
): Extract<LoadPublishedPageResult, { kind: "snapshot" }> | null {
  const locale = pathnameLocale(pathname);
  const seed = builtinCmsSeedPages().find((p) => p.id === pageId);
  if (!seed) return null;

  const normalized = normalizeCmsPage(seed);
  const nlContent = normalized.localeContent?.nl;
  if (!nlContent) return null;

  const page = {
    ...normalized,
    localeStates: {
      nl: { publicationState: "published" as const, freshness: "current" as const },
      en: { publicationState: "published" as const, freshness: "current" as const },
    },
    localeContent: {
      nl: nlContent,
      en: normalized.localeContent?.en ?? {
        ...nlContent,
        navigationLabel: nlContent.navigationLabel,
        pageTitle: nlContent.pageTitle,
        seo: {
          title: nlContent.seo.title,
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
  if (!resolved.ok) return null;
  return {
    kind: "snapshot",
    snapshot: resolved.snapshot,
    head: buildCmsHeadFromSnapshot(resolved.snapshot, site),
  };
}

function buildBuiltinHomeFallback(pathname: string): Extract<LoadPublishedPageResult, { kind: "snapshot" }> {
  const fallback = buildBuiltinSeedFallback(pathname, "page_home");
  if (!fallback) throw new Error("cms: missing page_home seed");
  return fallback;
}

function resolveStore(): CmsStore {
  try {
    return getCmsStore();
  } catch {
    return getFileCmsStore();
  }
}

function storesAreSameInstance(a: CmsStore, b: CmsStore): boolean {
  return a === b;
}

function formatCmsError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause =
    error.cause instanceof Error
      ? error.cause.message
      : error.cause != null
        ? String(error.cause)
        : "";
  return cause ? `${error.message} (${cause})` : error.message;
}

function notePrimaryStoreFailure(error: unknown): void {
  const detail = formatCmsError(error);
  console.error("[cms] primary CMS store failed", detail);
  if (isSupabaseConnectivityError(error)) {
    markSupabaseCmsUnreachable(detail);
  }
}

function fallbackSnapshotOrNotFound(pathname: string): LoadPublishedPageResult {
  const builtinId = builtinPageIdForPathname(pathname);
  if (builtinId) {
    const seedFallback = buildBuiltinSeedFallback(pathname, builtinId);
    if (seedFallback) return seedFallback;
  }
  if (isHomePathname(pathname)) {
    return buildBuiltinHomeFallback(pathname);
  }
  return { kind: "not_found" };
}

/**
 * Short-lived SSR cache keyed by site configVersion.
 * Admin publish (separate Node process) bumps configVersion on the shared store;
 * without that key, a 10s pathname-only cache kept serving pre-publish snapshots.
 */
const SNAPSHOT_CACHE_TTL_MS = 10_000;
const snapshotCache = new Map<
  string,
  { expiresAt: number; configVersion: number; result: LoadPublishedPageResult }
>();
let lastSeenConfigVersion: number | null = null;

function cacheKey(pathname: string, configVersion: number): string {
  return `${configVersion}::${pathname}`;
}

function readSnapshotCache(
  pathname: string,
  configVersion: number,
): LoadPublishedPageResult | null {
  if (lastSeenConfigVersion !== null && lastSeenConfigVersion !== configVersion) {
    snapshotCache.clear();
  }
  lastSeenConfigVersion = configVersion;
  const hit = snapshotCache.get(cacheKey(pathname, configVersion));
  if (!hit) return null;
  if (hit.configVersion !== configVersion || Date.now() > hit.expiresAt) {
    snapshotCache.delete(cacheKey(pathname, configVersion));
    return null;
  }
  return hit.result;
}

function writeSnapshotCache(
  pathname: string,
  configVersion: number,
  result: LoadPublishedPageResult,
): void {
  if (result.kind === "snapshot" || result.kind === "redirect") {
    snapshotCache.set(cacheKey(pathname, configVersion), {
      expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
      configVersion,
      result,
    });
  }
}

function toLoadedSnapshot(
  result: Extract<Awaited<ReturnType<typeof resolvePublicCmsRequest>>, { kind: "snapshot" }>,
): Extract<LoadPublishedPageResult, { kind: "snapshot" }> {
  return {
    kind: "snapshot",
    snapshot: result.snapshot,
    head: buildCmsHeadFromSnapshot(result.snapshot, result.site),
  };
}

/**
 * When the primary store (often Supabase) has no published path, try the shared
 * file store — local admin publish always writes there even if remote lags.
 */
async function resolveFromFileStoreFallback(
  pathname: string,
  primary: CmsStore,
): Promise<LoadPublishedPageResult | null> {
  const fileStore = getFileCmsStore();
  if (storesAreSameInstance(primary, fileStore)) return null;
  try {
    await fileStore.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const result = await resolvePublicCmsRequest({ pathname, store: fileStore });
    if (result.kind === "snapshot") return toLoadedSnapshot(result);
    if (result.kind === "redirect") return result;
    return null;
  } catch (error) {
    console.error("[cms] file-store fallback failed", formatCmsError(error));
    return null;
  }
}

async function ensureStoreReady(): Promise<CmsStore> {
  let store = resolveStore();
  try {
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    return store;
  } catch (error) {
    notePrimaryStoreFailure(error);
    store = getFileCmsStore();
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    return store;
  }
}

/**
 * Server-only published page loader (must stay `.server.ts` so Node fs/DB
 * never enter the browser bundle).
 *
 * Builtin routes never hard-fail when the primary store is incomplete: file
 * store then seed fallback (same resilience home already had).
 */
export async function loadPublishedPageSnapshot(
  pathname: string,
): Promise<LoadPublishedPageResult> {
  try {
    const store = await ensureStoreReady();
    const site = await store.getSite();
    const configVersion = site.configVersion;

    const cached = readSnapshotCache(pathname, configVersion);
    if (cached) return cached;

    const result = await resolvePublicCmsRequest({ pathname, store });
    if (result.kind === "snapshot") {
      const loaded = toLoadedSnapshot(result);
      writeSnapshotCache(pathname, configVersion, loaded);
      return loaded;
    }
    if (result.kind === "redirect") {
      writeSnapshotCache(pathname, configVersion, result);
      return result;
    }

    // Primary returned not_found — try shared file store (admin publish target).
    const fromFile = await resolveFromFileStoreFallback(pathname, store);
    if (fromFile) {
      writeSnapshotCache(pathname, configVersion, fromFile);
      return fromFile;
    }

    const seedOrMissing = fallbackSnapshotOrNotFound(pathname);
    if (seedOrMissing.kind !== "not_found") {
      writeSnapshotCache(pathname, configVersion, seedOrMissing);
    }
    return seedOrMissing;
  } catch (error) {
    notePrimaryStoreFailure(error);

    try {
      const fromFile = await resolveFromFileStoreFallback(pathname, resolveStore());
      if (fromFile) return fromFile;
    } catch {
      /* ignore secondary failure */
    }

    return fallbackSnapshotOrNotFound(pathname);
  }
}
