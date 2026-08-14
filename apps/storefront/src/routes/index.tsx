import { createFileRoute } from "@tanstack/react-router";
import {
  resolveHomeHeroBlocksLayout,
  type BuiltinCmsPage,
} from "@mccoy/cms-schema";
import { HomePageLayout } from "@/components/site/HomePageLayout";
import { HomePageLoadingShell } from "@/components/site/HomePageLoadingShell";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";
import { homeHeroPreloadLink } from "@/lib/image-delivery";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { resolveHomeHeroImageSrc } from "@/lib/cms/home-hero-src";

export const Route = createFileRoute("/")({
  loader: () => loadMarketingPublishedPage("/"),
  pendingComponent: HomePageLoadingShell,
  head: ({ loaderData }) => {
    if (!loaderData?.head) {
      return {
                meta: [{ title: "McCoy Cleaning — Schoonmaakbedrijf Twente | Oldenzaal" }],
      };
    }
    const base = tanstackHeadFromCms(loaderData.head);
    const page = loaderData.snapshot.page;
    const heroSrc = resolveHomeHeroImageSrc(page);
    return {
      ...base,
      links: [...(base.links ?? []), homeHeroPreloadLink(heroSrc)],
    };
  },
  component: Index,
});

function Index() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <HomePage />
    </RoutePublishedPageProvider>
  );
}

function HomePage() {
  const { snapshot } = Route.useLoaderData();
  const raw = useCmsPageForView("page_home") ?? snapshot.page;
  const page =
    raw?.kind === "builtin" && raw.pageKey === "home"
      ? resolveHomeHeroBlocksLayout(raw as BuiltinCmsPage).page
      : raw;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main>
      {page?.kind === "builtin" ? (
        <HomePageLayout
          page={page}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
