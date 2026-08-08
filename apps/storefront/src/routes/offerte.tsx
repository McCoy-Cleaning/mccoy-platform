import { createFileRoute } from "@tanstack/react-router";
import {
  resolveOfferteBlocksLayout,
  type BuiltinCmsPage,
} from "@mccoy/cms-schema";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";

export const Route = createFileRoute("/offerte")({
  loader: () => loadMarketingPublishedPage("/offerte"),
  head: ({ loaderData }) => {
    if (!loaderData?.head) {
      return { meta: [{ title: "Contact & Offerte — McCoy Cleaning" }] };
    }
    return tanstackHeadFromCms(loaderData.head);
  },
  component: OffertePage,
});

function OffertePage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <OffertePageBody />
    </RoutePublishedPageProvider>
  );
}

function OffertePageBody() {
  const { snapshot } = Route.useLoaderData();
  const raw = useCmsPageForView("page_offerte") ?? snapshot.page;
  const page =
    raw?.kind === "builtin" && raw.pageKey === "offerte"
      ? resolveOfferteBlocksLayout(raw as BuiltinCmsPage).page
      : raw;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main className="pt-24">
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="offerte"
          renderers={pageSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
