/**
 * Process-local published CMS read cache + circuit breaker.
 *
 * Production was hammered by repeated getPublishedCmsBundle-style walks
 * (listPages + per-page findPageRow + revision). Warm Vercel isolates reuse
 * this cache; a soft circuit serves stale data under fetch storms.
 */
import { normalizeCmsPage, type CmsPage } from "@mccoy/cms-schema";

import type {
  CmsLocaleStateRecord,
  CmsRevisionRecord,
  CmsSiteRecord,
  CmsStore,
} from "./types";
import { DEFAULT_CMS_SITE_ID } from "./types";

export type PublishedCmsBundleSnapshot = {
  site: Pick<CmsSiteRecord, "id" | "origin" | "configVersion">;
  pages: CmsPage[];
  navigation: CmsSiteRecord["navigation"];
  footer: CmsSiteRecord["footer"];
  localeStates: CmsLocaleStateRecord[];
  revisions: CmsRevisionRecord[];
};

const BUNDLE_TTL_MS = 60_000;
/** Allow serving expired cache this long when the circuit is open. */
const STALE_GRACE_MS = 5 * 60_000;
/** Max cache-miss DB loads per isolate per rolling minute. */
const MAX_DB_LOADS_PER_MINUTE = 30;

type CacheEntry = {
  freshUntil: number;
  staleUntil: number;
  configVersion: number;
  snapshot: PublishedCmsBundleSnapshot;
};

let bundleCache: CacheEntry | null = null;
let inflight: Promise<PublishedCmsBundleSnapshot> | null = null;
const dbLoadAt: number[] = [];

export function invalidatePublishedCmsReadCache(): void {
  bundleCache = null;
  inflight = null;
}

function pruneLoadWindow(now: number): void {
  while (dbLoadAt.length > 0 && now - dbLoadAt[0]! > 60_000) {
    dbLoadAt.shift();
  }
}

function circuitOpen(now: number): boolean {
  pruneLoadWindow(now);
  return dbLoadAt.length >= MAX_DB_LOADS_PER_MINUTE;
}

function noteDbLoad(now: number): void {
  pruneLoadWindow(now);
  dbLoadAt.push(now);
}

export async function loadPublishedPagesBatched(
  store: CmsStore,
  siteId: string = DEFAULT_CMS_SITE_ID,
): Promise<CmsPage[]> {
  const revisions = await store.listActivePublishedRevisions(siteId);
  const pages: CmsPage[] = [];
  for (const rev of revisions) {
    try {
      if (rev.payload && typeof rev.payload === "object") {
        pages.push(normalizeCmsPage(rev.payload));
      }
    } catch {
      /* skip corrupt payload */
    }
  }
  return pages;
}

async function fetchPublishedBundleSnapshot(
  store: CmsStore,
  siteId: string,
): Promise<PublishedCmsBundleSnapshot> {
  const site = await store.getSite(siteId);
  const [revisions, localeStates] = await Promise.all([
    store.listActivePublishedRevisions(siteId),
    store.listPublishedLocaleStates(siteId),
  ]);
  const pages: CmsPage[] = [];
  for (const rev of revisions) {
    try {
      if (rev.payload && typeof rev.payload === "object") {
        pages.push(normalizeCmsPage(rev.payload));
      }
    } catch {
      /* skip */
    }
  }
  return {
    site: {
      id: site.id,
      origin: site.origin,
      configVersion: site.configVersion,
    },
    pages,
    navigation: site.navigation,
    footer: site.footer,
    localeStates,
    revisions,
  };
}

/**
 * Cached published bundle for storefront hydrate / admin editor mirrors.
 * Single-flight per isolate; under storm serves stale rather than more DB load.
 */
export async function getCachedPublishedCmsBundle(
  store: CmsStore,
  siteId: string = DEFAULT_CMS_SITE_ID,
): Promise<PublishedCmsBundleSnapshot> {
  const now = Date.now();

  if (bundleCache && now < bundleCache.freshUntil) {
    return bundleCache.snapshot;
  }

  if (bundleCache && circuitOpen(now) && now < bundleCache.staleUntil) {
    console.warn(
      "[cms] published-read circuit open — serving stale published bundle",
      { loadsInWindow: dbLoadAt.length, configVersion: bundleCache.configVersion },
    );
    return bundleCache.snapshot;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    const loadNow = Date.now();
    if (circuitOpen(loadNow) && bundleCache && loadNow < bundleCache.staleUntil) {
      return bundleCache.snapshot;
    }
    noteDbLoad(loadNow);
    try {
      const snapshot = await fetchPublishedBundleSnapshot(store, siteId);
      const t = Date.now();
      bundleCache = {
        freshUntil: t + BUNDLE_TTL_MS,
        staleUntil: t + STALE_GRACE_MS,
        configVersion: snapshot.site.configVersion,
        snapshot,
      };
      return snapshot;
    } catch (error) {
      if (bundleCache && Date.now() < bundleCache.staleUntil) {
        console.error("[cms] published bundle fetch failed — serving stale", error);
        return bundleCache.snapshot;
      }
      throw error;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Test helper */
export function __resetPublishedCmsReadCacheForTests(): void {
  bundleCache = null;
  inflight = null;
  dbLoadAt.length = 0;
}
