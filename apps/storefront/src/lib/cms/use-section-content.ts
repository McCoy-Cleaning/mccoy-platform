import {
  defaultSectionContent,
  ensureBuiltinSectionContent,
  getSectionContent,
  type FixedSectionKey,
  type HomeHeroContent,
  type PageSectionContent,
  type SectionContentMap,
} from "@mccoy/cms-schema";
import { useCmsPageForView } from "./use-cms-page-for-view";
import { useLiveEditDraft } from "./live-edit-api-context";

export function useTypedSectionContent<K extends FixedSectionKey>(
  pageId: string,
  key: K,
): SectionContentMap[K] {
  const live = useLiveEditDraft();
  const page = useCmsPageForView(pageId);

  // Always run ensure/migrations (e.g. empty partners → default logos) so
  // live-edit drafts and published pages with empty lists still render.
  let map: PageSectionContent = {};
  if (live?.pageId === pageId && live.page.kind === "builtin") {
    const mergedPage = {
      ...live.page,
      sectionContent: {
        ...(live.page.sectionContent ?? {}),
        ...live.sectionContent,
      },
    };
    map = ensureBuiltinSectionContent(mergedPage);
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
