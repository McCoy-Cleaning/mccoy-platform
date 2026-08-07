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

export const Route = createFileRoute("/about")({
  loader: () => loadMarketingPublishedPage("/about"),
  head: () => ({
    meta: [
      { title: "Over ons — McCoy Cleaning Twente" },
      {
        name: "description",
        content:
          "Sinds 1998 staat McCoy Cleaning voor schoonmaak met karakter. Lees over onze missie, visie en geschiedenis als toonaangevend schoonmaakbedrijf in Twente.",
      },
      { property: "og:title", content: "Over ons — McCoy Cleaning" },
      {
        property: "og:description",
        content: "Missie, visie en geschiedenis van McCoy Cleaning — Oldenzaal, sinds 1998.",
      },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
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
