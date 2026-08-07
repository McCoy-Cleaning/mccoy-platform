import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { homeSectionRenderers } from "@/components/site/homeSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";
import { homeHeroPreloadLink } from "@/lib/image-delivery";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";

export const Route = createFileRoute("/")({
  loader: () => loadMarketingPublishedPage("/"),
  head: ({ loaderData }) => {
    if (!loaderData?.head) {
      return {
        meta: [{ title: "McCoy Cleaning" }],
      };
    }
    const base = tanstackHeadFromCms(loaderData.head);
    const page = loaderData.snapshot.page;
    const heroSrc =
      (page.kind === "builtin"
        ? (page.sectionContent?.["home.hero"] as { image?: { src?: string } } | undefined)?.image?.src
        : undefined) ?? "/images/cms/hero-cleaning.jpg";
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
  const page = useCmsPageForView("page_home") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main>
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="home"
          renderers={homeSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
