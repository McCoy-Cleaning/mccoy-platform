import * as React from "react";
import type { PageSectionRenderers } from "./PageLayoutRenderer";
import { Hero } from "./sections/HomeSections";

/**
 * Below-fold home sections: separate chunks so the hero LCP path does not wait
 * on gallery JPEG/PNG fallbacks or the partners marquee module.
 */
const PartnersSlider = React.lazy(() =>
  import("./PartnersSlider").then((m) => ({ default: m.PartnersSlider })),
);
const Stats = React.lazy(() =>
  import("./sections/HomeStats").then((m) => ({ default: m.Stats })),
);
const WorkGallery = React.lazy(() =>
  import("./sections/HomeWorkGallery").then((m) => ({ default: m.WorkGallery })),
);

function DeferredSection({
  children,
  minHeightClass,
}: {
  children: React.ReactNode;
  minHeightClass: string;
}) {
  return (
    <React.Suspense fallback={<div className={minHeightClass} aria-hidden />}>
      {children}
    </React.Suspense>
  );
}

function HomePartners() {
  return (
    <DeferredSection minHeightClass="min-h-[14rem]">
      <PartnersSlider />
    </DeferredSection>
  );
}

function HomeStatsSection() {
  return (
    <DeferredSection minHeightClass="min-h-[20rem]">
      <Stats />
    </DeferredSection>
  );
}

function HomeWorkGallerySection() {
  return (
    <DeferredSection minHeightClass="min-h-[36rem]">
      <WorkGallery />
    </DeferredSection>
  );
}

/**
 * Homepage renderer map. Keeps About/Services/Products image modules out of `/`.
 * `home.hero` is suppressed once migrated to the reusable `hero` block
 * ({@link resolveHomeHeroBlocksLayout}); the fixed renderer remains only as a
 * dual-read fallback for unmigrated snapshots.
 */
export const homeSectionRenderers: PageSectionRenderers = {
  home: {
    "home.hero": Hero,
    "home.partners": HomePartners,
    "home.stats": HomeStatsSection,
    "home.workGallery": HomeWorkGallerySection,
  },
};
