import {
  BUILTIN_ROUTE_PATHS,
  type CmsLink,
  type HomeHeroContent,
  type FormPageChromeContent,
} from "@mccoy/cms-schema";
import { CmsButtonView, CmsImageView, type LinkResolverPages } from "./blocks/primitives";

export type { LinkResolverPages };
export { CmsImageView, CmsButtonView };
export { RegisteredBlockView, CmsBlockView } from "./blocks/RegisteredBlockView";
export type { RegisteredBlockViewProps } from "./blocks/RegisteredBlockView";
export { WorkMosaicGallery, workMosaicTileClass } from "./blocks/WorkMosaicGallery";
export type { WorkMosaicGalleryItem, WorkMosaicGalleryProps } from "./blocks/WorkMosaicGallery";
export { JobsSectionView } from "./blocks/JobsSectionView";
export type { JobsSectionViewProps, JobsRenderMode } from "./blocks/JobsSectionView";
export { blockViewRegistry } from "./blocks/blockViewRegistry";
export {
  CmsFormAdaptersProvider,
  CmsPageIdProvider,
  useCmsFormAdapters,
  useCmsPageId,
} from "./blocks/form-adapters";
export type {
  CmsFormAdapters,
  NewsletterSubmitInput,
  ContactFormSubmitInput,
} from "./blocks/form-adapters";
export {
  NewsletterSectionView,
  ContactFormSectionView,
  PopupSectionView,
} from "./blocks/ConversionSectionViews";
export {
  SECTION_GRID,
  SECTION_HEADER_TO_CONTENT,
  SECTION_INNER,
  SECTION_INNER_BASE,
  SECTION_PAGE_RAIL,
  SECTION_SHELL_Y,
  SECTION_SHELL_Y_COMPACT,
  SECTION_SHELL_Y_HERO,
  SECTION_STACK,
  SECTION_TITLE,
  SECTION_TITLE_TIGHT,
  contentAlignJustifyClass,
  sectionInnerAlignRowClass,
  sectionInnerClass,
  sectionInnerColumnClass,
} from "./sectionLayout";
export type { SectionInnerMaxWidth } from "./sectionLayout";
export { ContentAlignProvider, useContentAlign } from "./contentAlign";
export { SectionInner } from "./SectionInner";

export function HomeHeroView({
  content,
  pages = [],
  onNavigate,
}: {
  content: HomeHeroContent;
  pages?: LinkResolverPages;
  onNavigate?: (link: CmsLink) => void;
}) {
  return (
    <section className="cms-home-hero space-y-4 py-8" data-cms-section="home.hero">
      {content.eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{content.eyebrow}</p>
      ) : null}
      <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
        {content.heading}
        {content.headingAccent ? (
          <span className="text-primary"> {content.headingAccent}</span>
        ) : null}
      </h1>
      <p className="max-w-2xl text-lg text-white/70">{content.body}</p>
      <div className="flex flex-wrap gap-3">
        {content.primaryCta ? (
          <CmsButtonView
            button={content.primaryCta}
            pages={pages}
            onNavigate={onNavigate}
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          />
        ) : null}
        {content.secondaryCta ? (
          <CmsButtonView
            button={content.secondaryCta}
            pages={pages}
            onNavigate={onNavigate}
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white"
          />
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        {content.image ? (
          <CmsImageView image={content.image} className="h-64 w-full object-cover md:h-80" />
        ) : (
          <div className="grid h-64 place-items-center bg-white/[0.03] text-sm text-white/40 md:h-80">
            Geen hero-afbeelding
          </div>
        )}
      </div>
    </section>
  );
}

export function FormPageChromeView({
  content,
  sectionKey,
}: {
  content: FormPageChromeContent;
  sectionKey: string;
}) {
  return (
    <header className="space-y-3 py-8" data-cms-section={sectionKey}>
      {content.eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{content.eyebrow}</p>
      ) : null}
      <h1 className="text-4xl font-bold text-white">{content.heading}</h1>
      {content.body ? <p className="max-w-2xl text-white/70">{content.body}</p> : null}
      {content.image ? (
        <CmsImageView image={content.image} className="mt-4 max-h-64 rounded-xl object-cover" />
      ) : null}
    </header>
  );
}

export function defaultRouteHref(route: keyof typeof BUILTIN_ROUTE_PATHS): string {
  return BUILTIN_ROUTE_PATHS[route];
}
