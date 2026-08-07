import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";

export const Route = createFileRoute("/contact")({
  loader: () => loadMarketingPublishedPage("/contact"),
  head: () => ({
    meta: [
      { title: "Contact — Schoonmaak Twente | McCoy Cleaning" },
      {
        name: "description",
        content:
          "Neem contact op met McCoy Cleaning voor algemene vragen of aanvragen voor professionele schoonmaak in Twente. Persoonlijk antwoord binnen één werkdag.",
      },
      { property: "og:title", content: "Contact — McCoy Cleaning Twente" },
      {
        property: "og:description",
        content: "Neem contact op met McCoy Cleaning in Oldenzaal.",
      },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <ContactPageBody />
    </RoutePublishedPageProvider>
  );
}

function ContactPageBody() {
  const { snapshot } = Route.useLoaderData();
  const page = useCmsPageForView("page_contact") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main className="pt-24">
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="contact"
          renderers={pageSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
