import { createFileRoute } from "@tanstack/react-router";
import {
  resolveAboutBlocksLayout,
  type BuiltinCmsPage,
} from "@mccoy/cms-schema";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";

export const Route = createFileRoute("/about")({
  loader: () => loadMarketingPublishedPage("/about"),
  head: ({ loaderData }) => {
    if (!loaderData?.head) {
      return { meta: [{ title: "Over ons — McCoy Cleaning Twente" }] };
    }
    return tanstackHeadFromCms(loaderData.head);
  },
  component: AboutPage,
});

function AboutPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <AboutPageBody />
    </RoutePublishedPageProvider>
  );
}

function AboutPageBody() {
  const { snapshot } = Route.useLoaderData();
  const raw = useCmsPageForView("page_about") ?? snapshot.page;
  const page =
    raw?.kind === "builtin" && raw.pageKey === "about"
      ? resolveAboutBlocksLayout(raw as BuiltinCmsPage).page
      : raw;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main className="pt-24">
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="about"
          renderers={pageSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
