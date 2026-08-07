import { localizeCmsPageForLocale, type CmsPage, type PageSectionContent } from "@mccoy/cms-schema";
import { useEditablePage, useCms, isPublishedCmsBundleHydrated } from "./store";
import { usePreviewSnapshot } from "./preview-snapshot-context";
import { useRoutePublishedPage } from "./route-published-page-context";
import { useActiveCmsLocale } from "./use-active-cms-locale";
import { useLiveEditApi, useLiveEditDraft } from "./live-edit-api-context";

function pageFreshness(page: CmsPage): number {
  return typeof page.updatedAt === "number" ? page.updatedAt : 0;
}

/**
 * Page used for rendering:
 * - preview iframe: explicit postMessage snapshot
 * - edit mode: live postMessage draft → editable → published
 * - public: loader snapshot localized for the active CMS locale
 *
 * Hydration rule (all public routes): while a route loader page is provided,
 * always use it for the first paint so SSR HTML matches the client. Only after
 * {@link hydratePublishedCmsState} may a newer published bundle page win —
 * never the in-memory SEED_PAGES (their `updatedAt` is Date.now() at module load
 * and caused contact.info / layout hydration mismatches).
 */
export function useCmsPageForView(pageId: string): CmsPage | undefined {
  const snapshot = usePreviewSnapshot();
  const routePage = useRoutePublishedPage();
  const state = useCms();
  const { isEdit } = useLiveEditApi();
  const live = useLiveEditDraft();
  const editable = useEditablePage(pageId);
  const published = state.pages.find((p) => p.id === pageId);
  const locale = useActiveCmsLocale();
  const bundleHydrated = isPublishedCmsBundleHydrated();

  let page: CmsPage | undefined;
  if (snapshot?.pageId === pageId) {
    page = snapshot.page;
  } else if (isEdit) {
    // Still localize — Admin preview chrome `?_cmsLocale=` must show EN overlays
    // in the edit iframe (LanguageToggle is blocked by EditInteractionGuard).
    page = live?.pageId === pageId ? live.page : (editable ?? published);
  } else if (routePage?.id === pageId) {
    if (
      bundleHydrated &&
      published &&
      pageFreshness(published) > pageFreshness(routePage)
    ) {
      page = published;
    } else {
      page = routePage;
    }
  } else {
    page = published;
  }

  if (!page) return undefined;
  return localizeCmsPageForLocale(page, locale);
}

export function useSectionContentMap(pageId: string): PageSectionContent {
  const page = useCmsPageForView(pageId);
  if (page?.kind === "builtin") return page.sectionContent ?? {};
  return {};
}
