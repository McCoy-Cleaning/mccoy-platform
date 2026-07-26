import { localizeCmsPageForLocale, type CmsPage, type PageSectionContent } from "@mccoy/cms-schema";
import { useEditablePage, useCms } from "./store";
import { usePreviewSnapshot } from "./preview-snapshot-context";
import { useRoutePublishedPage } from "./route-published-page-context";
import { useActiveCmsLocale } from "./use-active-cms-locale";
import { useLiveEditApi, useLiveEditDraft } from "./live-edit-api-context";

/**
 * Page used for rendering:
 * - preview iframe: explicit postMessage snapshot
 * - edit mode: live postMessage draft → editable → published
 * - public: loader snapshot localized for the active CMS locale
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

  let page: CmsPage | undefined;
  if (snapshot?.pageId === pageId) {
    page = snapshot.page;
  } else if (isEdit) {
    if (live?.pageId === pageId) return live.page;
    return editable ?? published;
  } else if (routePage?.id === pageId) {
    page = routePage;
  } else {
    page = published;
  }

  if (!page) return undefined;
  return localizeCmsPageForLocale(page, locale);
}

export function useSectionContentMap(pageId: string): PageSectionContent {
  const live = useLiveEditDraft();
  const page = useCmsPageForView(pageId);
  if (live?.pageId === pageId) return live.sectionContent;
  if (page?.kind === "builtin") return page.sectionContent ?? {};
  return {};
}
