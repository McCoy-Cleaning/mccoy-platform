import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";

export const Route = createFileRoute("/terms")({
  loader: () => loadMarketingPublishedPage("/terms"),
  head: () => ({
    meta: [
      { title: "Algemene Voorwaarden — McCoy Cleaning" },
      {
        name: "description",
        content:
          "Algemene voorwaarden van McCoy Schoonmaak en Reiniging — offertes, uitvoering, aansprakelijkheid en geschillen.",
      },
      { property: "og:title", content: "Algemene Voorwaarden — McCoy Cleaning" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <TermsPageBody />
    </RoutePublishedPageProvider>
  );
}

function TermsPageBody() {
  const { snapshot } = Route.useLoaderData();
  const page = useCmsPageForView("page_terms") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main className="pt-24">
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="terms"
          renderers={pageSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
