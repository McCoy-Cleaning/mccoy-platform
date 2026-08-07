import {
  defaultSectionContent,
  ensureBuiltinSectionContent,
  getSectionContent,
  localizeCmsPageForLocale,
  type FixedSectionKey,
  type HomeHeroContent,
  type PageSectionContent,
  type SectionContentMap,
} from "@mccoy/cms-schema";
import { useCmsPageForView } from "./use-cms-page-for-view";
import { useLiveEditDraft } from "./live-edit-api-context";
import { useActiveCmsLocale } from "./use-active-cms-locale";

export function useTypedSectionContent<K extends FixedSectionKey>(
  pageId: string,
  key: K,
): SectionContentMap[K] {
  const live = useLiveEditDraft();
  const page = useCmsPageForView(pageId);
  const locale = useActiveCmsLocale();

  // Always run ensure/migrations (e.g. empty partners → default logos) so
  // live-edit drafts and published pages with empty lists still render.
  let map: PageSectionContent = {};
  if (live?.pageId === pageId && live.page.kind === "builtin") {
    const mergedPage = localizeCmsPageForLocale(
      {
        ...live.page,
        sectionContent: {
          ...(live.page.sectionContent ?? {}),
          ...live.sectionContent,
        },
      },
      locale,
    );
    // localizeCmsPageForLocale preserves kind but returns CmsPage; re-narrow for ensureBuiltin.
    if (mergedPage.kind === "builtin") {
      map = ensureBuiltinSectionContent(mergedPage);
    }
  } else if (page?.kind === "builtin") {
    map = ensureBuiltinSectionContent(page);
  }

  const value = map[key];
  const resolved =
    value ??
    (page?.kind === "builtin"
      ? getSectionContent(page, key)
      : (defaultSectionContent(key) as SectionContentMap[K]));

  return resolved as SectionContentMap[K];
}

export function useHomeHeroContent(): HomeHeroContent {
  return useTypedSectionContent("page_home", "home.hero");
}
