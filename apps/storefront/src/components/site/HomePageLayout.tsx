import type { BuiltinCmsPage } from "@mccoy/cms-schema";
import { BlocksView } from "@/components/site/BlockView";
import {
  PageLayoutRenderer,
  type SectionRenderMode,
} from "@/components/site/PageLayoutRenderer";
import { homeSectionRenderers } from "@/components/site/homeSectionRenderers";

/**
 * Home's persisted Hero is a reusable block and is LCP-critical. Render the
 * block graph eagerly so SSR and hydration contain Hero before Partners.
 */
export function HomePageLayout({
  page,
  mode,
  respectHidden,
}: {
  page: BuiltinCmsPage;
  mode: SectionRenderMode;
  respectHidden: boolean;
}) {
  return (
    <PageLayoutRenderer
      page={page}
      pageKey="home"
      renderers={homeSectionRenderers}
      blocksRenderer={BlocksView}
      mode={mode}
      respectHidden={respectHidden}
    />
  );
}
