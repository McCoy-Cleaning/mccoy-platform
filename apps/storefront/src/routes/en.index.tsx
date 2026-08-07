import { createFileRoute } from "@tanstack/react-router";
import {
  resolveHomeHeroBlocksLayout,
  type BuiltinCmsPage,
} from "@mccoy/cms-schema";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { homeSectionRenderers } from "@/components/site/homeSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";
import { homeHeroPreloadLink } from "@/lib/image-delivery";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { resolveHomeHeroImageSrc } from "@/lib/cms/home-hero-src";

export const Route = createFileRoute("/en/")({
  loader: () => loadMarketingPublishedPage("/en"),
  head: ({ loaderData }) => {
    if (!loaderData?.head) return { meta: [{ name: "robots", content: "noindex" }] };
    const base = tanstackHeadFromCms(loaderData.head);
    const page = loaderData.snapshot.page;
    const heroSrc = resolveHomeHeroImageSrc(page);
    return {
      ...base,
      links: [...(base.links ?? []), homeHeroPreloadLink(heroSrc)],
    };
  },
  component: EnglishHome,
});

function EnglishHome() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <EnglishHomePage />
    </RoutePublishedPageProvider>
  );
}

function EnglishHomePage() {
  const { snapshot } = Route.useLoaderData();
  const raw = useCmsPageForView("page_home") ?? snapshot.page;
  const page =
    raw.kind === "builtin" && raw.pageKey === "home"
      ? resolveHomeHeroBlocksLayout(raw as BuiltinCmsPage).page
      : raw;

  return (
    <main lang="en">
      {page.kind === "builtin" && page.pageKey === "home" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="home"
          renderers={homeSectionRenderers}
          mode="public"
          respectHidden
        />
      ) : null}
    </main>
  );
}
