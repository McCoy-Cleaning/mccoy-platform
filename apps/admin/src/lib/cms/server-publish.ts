import type { CmsPage, SiteFooterContent, SiteNavigationContent } from "@mccoy/cms-schema";
import {
  adminDeleteCmsPage,
  adminPublishCmsPage,
  adminPublishCmsSiteChrome,
  adminSaveCmsDraft,
  adminGetCmsPageStatus,
} from "@/lib/api/cms-publish.functions";

export type ServerPublishResult = { ok: true } | { ok: false; error: string };
export type ServerDeleteResult = { ok: true } | { ok: false; error: string };
export type ServerDraftResult =
  | { ok: true; draftRevisionNumber: number }
  | { ok: false; error: string };
export type ServerChromePublishResult = { ok: true } | { ok: false; error: string };

/**
 * Persist a saved CMS page into the shared server published store so storefront
 * hydrate (B5) still shows it after a full refresh.
 *
 * Writes to monorepo-root `.data/cms-published.json` (via fixed findMonorepoRoot),
 * which both admin and storefront server processes share.
 *
 * Publishing a page whose layout/blocks no longer include a deleted CMS section
 * creates a new revision without that block (orphaned prior revisions remain
 * historical only).
 */
export async function publishSavedPageToServer(
  page: CmsPage,
  publishedLocales: Array<"nl" | "en"> = ["nl"],
): Promise<ServerPublishResult> {
  try {
    const result = await adminPublishCmsPage({
      data: {
        pageId: page.id,
        payload: page as unknown as Record<string, unknown>,
        publishedLocales,
      },
    });
    if (!result.ok) {
      console.warn("[cms] server publish after Opslaan failed:", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server-publicatie mislukt.";
    console.warn("[cms] server publish after Opslaan failed:", error);
    return { ok: false, error: message };
  }
}

/**
 * Persist a soft draft (concept) without publishing.
 * Does not run publish validation — incomplete work is allowed.
 */
export async function saveConceptPageToServer(page: CmsPage): Promise<ServerDraftResult> {
  try {
    const status = await adminGetCmsPageStatus({ data: { pageId: page.id } });
    const expected =
      status.ok && typeof status.draftRevisionNumber === "number"
        ? status.draftRevisionNumber
        : null;
    const result = await adminSaveCmsDraft({
      data: {
        pageId: page.id,
        payload: page as unknown as Record<string, unknown>,
        expectedDraftRevision: expected,
      },
    });
    if (!result.ok) {
      console.warn("[cms] server concept save failed:", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true, draftRevisionNumber: result.draftRevisionNumber };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Concept opslaan op de server mislukte.";
    console.warn("[cms] server concept save failed:", error);
    return { ok: false, error: message };
  }
}

/**
 * Persist navigation and/or footer chrome so storefront cold loads keep logo
 * heights and other chrome (not only ephemeral BroadcastChannel / iframe sync).
 */
export async function publishSiteChromeToServer(input: {
  navigation?: SiteNavigationContent;
  footer?: SiteFooterContent;
}): Promise<ServerChromePublishResult> {
  try {
    if (input.navigation === undefined && input.footer === undefined) {
      return { ok: false, error: "Navigatie of footer ontbreekt." };
    }
    const result = await adminPublishCmsSiteChrome({
      data: {
        ...(input.navigation !== undefined
          ? { navigation: input.navigation as unknown as Record<string, unknown> }
          : {}),
        ...(input.footer !== undefined
          ? { footer: input.footer as unknown as Record<string, unknown> }
          : {}),
      },
    });
    if (!result.ok) {
      console.warn("[cms] server chrome publish after Opslaan failed:", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Server-publicatie van navigatie/footer mislukt.";
    console.warn("[cms] server chrome publish after Opslaan failed:", error);
    return { ok: false, error: message };
  }
}

/**
 * Remove a custom page from the shared published store (revisions, locale states,
 * redirects, outbox) so storefront hydrate cannot resurrect nav/SEO after delete.
 *
 * The storefront’s durable nav signal is published pages with `inNav: true`
 * (`getPublishedCmsBundle` → `resolveStorefrontNavLinks`). Chrome postMessage alone
 * is not enough — this server delete is required.
 */
export async function deleteSavedPageFromServer(pageId: string): Promise<ServerDeleteResult> {
  try {
    const result = await adminDeleteCmsPage({ data: { pageId } });
    if (!result.ok) {
      console.warn("[cms] server delete after Verwijderen failed:", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Server-verwijdering van pagina mislukt.";
    console.warn("[cms] server delete after Verwijderen failed:", error);
    return { ok: false, error: message };
  }
}
