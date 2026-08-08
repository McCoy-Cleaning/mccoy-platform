import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";

export const Route = createFileRoute("/contact")({
  loader: () => loadMarketingPublishedPage("/contact"),
  head: ({ loaderData }) => {
    if (!loaderData?.head) {
      return { meta: [{ title: "Contact — McCoy Cleaning" }] };
    }
    return tanstackHeadFromCms(loaderData.head);
  },
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
