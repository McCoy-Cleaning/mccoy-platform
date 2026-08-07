import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";

export const Route = createFileRoute("/offerte")({
  loader: () => loadMarketingPublishedPage("/offerte"),
  head: () => ({
    meta: [
      { title: "Contact & Offerte — Schoonmaak Twente | McCoy Cleaning" },
      {
        name: "description",
        content:
          "Offerte aanvragen voor kantoorschoonmaak, glasbewassing, vloer- en meubelonderhoud in Twente. Persoonlijk antwoord binnen één werkdag — McCoy Cleaning Oldenzaal.",
      },
      { property: "og:title", content: "Contact & Offerte — McCoy Cleaning Twente" },
      {
        property: "og:description",
        content: "Vraag direct een offerte aan voor professionele schoonmaak in Twente.",
      },
      { property: "og:url", content: "/offerte" },
    ],
    links: [{ rel: "canonical", href: "/offerte" }],
  }),
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
  const page = useCmsPageForView("page_offerte") ?? snapshot.page;
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
