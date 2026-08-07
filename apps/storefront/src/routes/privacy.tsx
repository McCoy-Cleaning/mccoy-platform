import { createFileRoute } from "@tanstack/react-router";
import {
  resolveLegalBlocksLayout,
  type BuiltinCmsPage,
} from "@mccoy/cms-schema";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";

export const Route = createFileRoute("/privacy")({
  loader: () => loadMarketingPublishedPage("/privacy"),
  head: () => ({
    meta: [
      { title: "Privacyverklaring — McCoy Cleaning" },
      {
        name: "description",
        content:
          "Privacyverklaring van McCoy Cleaning B.V.: hoe wij persoonsgegevens verwerken, bewaren en beveiligen.",
      },
      { property: "og:title", content: "Privacyverklaring — McCoy Cleaning" },
      { property: "og:description", content: "Privacyverklaring van McCoy Cleaning B.V." },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <PrivacyPageBody />
    </RoutePublishedPageProvider>
  );
}

function PrivacyPageBody() {
  const { snapshot } = Route.useLoaderData();
  const raw = useCmsPageForView("page_privacy") ?? snapshot.page;
  const page =
    raw?.kind === "builtin" && raw.pageKey === "privacy"
      ? resolveLegalBlocksLayout(raw as BuiltinCmsPage).page
      : raw;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main className="pt-24">
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="privacy"
          renderers={pageSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
