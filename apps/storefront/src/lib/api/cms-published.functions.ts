import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  buildCmsHeadFromSnapshot,
  type Locale,
  type ResolvedPublishedCmsPage,
} from "@mccoy/cms-schema";

/**
 * Database imports stay inside handlers so the client stub for these
 * server functions does not evaluate node:fs file-store modules.
 *
 * Public reads must NOT call seedBuiltinsIfEmpty on every request — that was
 * an N× cms_pages findPageRow walk and the dominant production CPU amplifier.
 */
async function getStoreForRead() {
  const db = await import("@mccoy/database/server");
  try {
    return db.getCmsStore();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cms] getStoreForRead: primary store failed", message);
    if (db.isSupabaseConnectivityError(error)) {
      db.markSupabaseCmsUnreachable(message);
    }
    return db.getFileCmsStore();
  }
}

async function ensureSeeded() {
  const db = await import("@mccoy/database/server");
  try {
    const store = db.getCmsStore();
    await store.seedBuiltinsIfEmpty(db.builtinCmsSeedPages());
    return store;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cms] ensureSeeded: primary store failed", message);
    if (db.isSupabaseConnectivityError(error)) {
      db.markSupabaseCmsUnreachable(message);
    }
    const store = db.getFileCmsStore();
    await store.seedBuiltinsIfEmpty(db.builtinCmsSeedPages());
    return store;
  }
}

export const ensurePublishedCmsSeeded = createServerFn({ method: "POST" }).handler(async () => {
  await ensureSeeded();
  return { ok: true as const };
});

/**
 * Returns JSON string payloads so TanStack Start serializability accepts CMS pages
 * (block.data is Record&lt;string, unknown&gt;).
 */
export const getPublishedCmsBundle = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const store = await getStoreForRead();
    const { getCachedPublishedCmsBundle } = await import("@mccoy/database/server");
    const bundle = await getCachedPublishedCmsBundle(store);
    return {
      ok: true as const,
      site: {
        id: bundle.site.id,
        origin: bundle.site.origin,
        configVersion: bundle.site.configVersion,
      },
      pagesJson: JSON.stringify(bundle.pages),
      /** Null until Navigatie Opslaan writes durable chrome. */
      navigationJson: bundle.navigation ? JSON.stringify(bundle.navigation) : null,
      /** Null until Footer Opslaan writes durable chrome. */
      footerJson: bundle.footer ? JSON.stringify(bundle.footer) : null,
      publishedLocaleStatesJson: JSON.stringify(bundle.localeStates),
    };
  } catch (error) {
    console.error("[cms] getPublishedCmsBundle failed", error);
    // Soft-fail: optional client hydrate must not surface as h3 HTTPError 500.
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

const resolveSchema = z.object({
  pathname: z.string().min(1).max(500),
  previewLocale: z.enum(["nl", "en"]).nullable().optional(),
  authenticatedPreview: z.boolean().optional(),
});

export const resolvePublishedCmsPath = createServerFn({ method: "POST" })
  .validator(resolveSchema)
  .handler(async ({ data }) => {
    const { resolvePublicCmsRequest, DEFAULT_CMS_SITE_ID } = await import("@mccoy/database/server");
    const store = await getStoreForRead();
    const result = await resolvePublicCmsRequest({
      pathname: data.pathname,
      authenticatedPreview: data.authenticatedPreview ?? false,
      previewLocale: data.previewLocale ?? null,
      siteId: DEFAULT_CMS_SITE_ID,
      store,
    });
    return {
      ok: true as const,
      resultJson: JSON.stringify(result),
    };
  });

export const getPublishedSitemapXml = createServerFn({ method: "POST" }).handler(async () => {
  const { buildPublishedSitemapEntries } = await import("@mccoy/database/server");
  const store = await getStoreForRead();
  const entries = await buildPublishedSitemapEntries({ store });
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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
  return { ok: true as const, xml };
});

export const processCmsPublishOutbox = createServerFn({ method: "POST" }).handler(async () => {
  const { processCmsOutbox } = await import("@mccoy/database/server");
  const result = await processCmsOutbox();
  return { ok: true as const, ...result };
});

/**
 * Trusted published-page loader for route SSR/navigation.
 * Keeps `@/lib/cms/load-published-page.server` out of the client graph.
 */
export const loadPublishedPageForPath = createServerFn({ method: "POST" })
  .validator(z.object({ pathname: z.string().min(1).max(500) }))
  .handler(async ({ data }) => {
    const { loadPublishedPageSnapshot } = await import("../cms/load-published-page.server");
    const result = await loadPublishedPageSnapshot(data.pathname);
    return { resultJson: JSON.stringify(result) };
  });

export type { ResolvedPublishedCmsPage, Locale };

export function headFromSnapshot(snapshot: ResolvedPublishedCmsPage, origin: string) {
  return buildCmsHeadFromSnapshot(snapshot, { origin });
}
