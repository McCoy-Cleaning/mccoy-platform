/**
 * Load a CMS page for website form submit with the same resilience as
 * public page rendering: primary store → file store → builtin seed.
 *
 * Always normalizes the page so required fixed form sections
 * (`contact.form`, `offerte.form`) are present when the published payload
 * was saved incomplete — otherwise the storefront shows the form (from
 * seed/fallback UI) while submit returns "Formulier niet gevonden."
 */
import { normalizeCmsPage, type CmsPage } from "@mccoy/cms-schema";

import { builtinCmsSeedPages } from "./seeds";
import { getFileCmsStore } from "./file-store";
import { getCmsStore } from "./supabase-store";
import { resolvePublicCmsRequest } from "./resolve";
import type { CmsStore } from "./types";

/** Builtin pages with fixed website forms — resolve like public routes. */
const BUILTIN_FORM_PAGE_PATHS: Record<string, string> = {
  page_contact: "/contact",
  page_offerte: "/offerte",
  page_vacatures: "/vacatures",
};

async function revisionPageFromStore(
  store: CmsStore,
  pageId: string,
): Promise<CmsPage | null> {
  try {
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
  } catch {
    /* seed best-effort */
  }
  try {
    const revision = await store.getActivePublishedRevision(pageId);
    const payload = revision?.payload;
    if (!payload || typeof payload !== "object") return null;
    return normalizeCmsPage(payload as CmsPage);
  } catch (error) {
    console.error(
      "[cms] getActivePublishedRevision failed for form submit",
      pageId,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function seedPage(pageId: string): CmsPage | null {
  const seed = builtinCmsSeedPages().find((page) => page.id === pageId);
  return seed ? normalizeCmsPage(seed) : null;
}

function storesAreSameInstance(a: CmsStore, b: CmsStore): boolean {
  return a === b;
}

async function loadBuiltinFormPageViaPublicResolver(pageId: string): Promise<CmsPage | null> {
  const pathname = BUILTIN_FORM_PAGE_PATHS[pageId];
  if (!pathname) return null;

  const tryStore = async (store: CmsStore): Promise<CmsPage | null> => {
    try {
      await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
      const result = await resolvePublicCmsRequest({ pathname, store });
      if (result.kind === "snapshot") {
        return normalizeCmsPage(result.snapshot.page);
      }
      return null;
    } catch (error) {
      console.error(
        "[cms] resolvePublicCmsRequest failed for form submit",
        pageId,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  };

  let primary: CmsStore | null = null;
  try {
    primary = getCmsStore();
    const fromPrimary = await tryStore(primary);
    if (fromPrimary) return fromPrimary;
  } catch (error) {
    console.error(
      "[cms] primary store unavailable for form submit",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const fileStore = getFileCmsStore();
    if (!primary || !storesAreSameInstance(primary, fileStore)) {
      const fromFile = await tryStore(fileStore);
      if (fromFile) return fromFile;
    }
  } catch (error) {
    console.error(
      "[cms] file store unavailable for form submit",
      error instanceof Error ? error.message : error,
    );
  }

  return seedPage(pageId);
}

export async function loadCmsPageForWebsiteForm(pageId: string): Promise<CmsPage | null> {
  const id = pageId.trim();
  if (!id) return null;

  if (BUILTIN_FORM_PAGE_PATHS[id]) {
    return loadBuiltinFormPageViaPublicResolver(id);
  }

  try {
    const primary = getCmsStore();
    const fromPrimary = await revisionPageFromStore(primary, id);
    if (fromPrimary) return fromPrimary;
  } catch (error) {
    console.error(
      "[cms] primary store unavailable for form submit",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const fileStore = getFileCmsStore();
    const fromFile = await revisionPageFromStore(fileStore, id);
    if (fromFile) return fromFile;
  } catch (error) {
    console.error(
      "[cms] file store unavailable for form submit",
      error instanceof Error ? error.message : error,
    );
  }

  return seedPage(id);
}
