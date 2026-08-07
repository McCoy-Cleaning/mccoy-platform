import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";

export const Route = createFileRoute("/services")({
  loader: () => loadMarketingPublishedPage("/services"),
  head: () => ({
    meta: [
      { title: "Diensten — McCoy Cleaning Twente" },
      {
        name: "description",
        content:
          "Kantoorschoonmaak, horeca-, opleverings- en vloeronderhoud, meubelreiniging en glasbewassing in Twente. Vraag direct een offerte aan bij McCoy Cleaning.",
      },
      { property: "og:title", content: "Diensten — McCoy Cleaning Twente" },
      {
        property: "og:description",
        content: "Een volledig schoonmaakaanbod door één vast eigen team in Twente.",
      },
      { property: "og:url", content: "/services" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <ServicesPageBody />
    </RoutePublishedPageProvider>
  );
}

function ServicesPageBody() {
  const { snapshot } = Route.useLoaderData();
  const page = useCmsPageForView("page_services") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main className="pt-24">
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="services"
          renderers={pageSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
