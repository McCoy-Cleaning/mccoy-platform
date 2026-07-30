import { createFileRoute, redirect } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";

export const Route = createFileRoute("/offerte")({
  loader: async () => {
    const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
    const { resultJson } = await loadPublishedPageForPath({ data: { pathname: "/offerte" } });
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof import("@/lib/cms/load-published-page.server").loadPublishedPageSnapshot>
    >;
    if (result.kind === "redirect") {
      throw redirect({ href: result.toPath, statusCode: result.statusCode });
    }
    // Builtin page — always seeded + published; a missing snapshot means the CMS
    // store is broken, not that the page is legitimately absent.
    if (result.kind !== "snapshot") {
      throw new Error("cms: offerte loader must return a snapshot");
    }
    return { snapshot: result.snapshot };
  },
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
  // Prefer the SSR-resolved loader snapshot over the client-only CMS seed store so
  // the first client render matches the server HTML (avoids hydration mismatch).
  const page = useCmsPageForView("page_offerte") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32">
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
      <Footer />
    </div>
  );
}
