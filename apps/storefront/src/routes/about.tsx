import { createFileRoute, redirect } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";

export const Route = createFileRoute("/about")({
  loader: async () => {
    const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
    const { resultJson } = await loadPublishedPageForPath({ data: { pathname: "/about" } });
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof import("@/lib/cms/load-published-page.server").loadPublishedPageSnapshot>
    >;
    if (result.kind === "redirect") {
      throw redirect({ href: result.toPath, statusCode: result.statusCode });
    }
    // Builtin page — always seeded + published; a missing snapshot means the CMS
    // store is broken, not that the page is legitimately absent.
    if (result.kind !== "snapshot") {
      throw new Error("cms: about loader must return a snapshot");
    }
    return { snapshot: result.snapshot };
  },
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
  // Prefer the SSR-resolved loader snapshot over the client-only CMS seed store so
  // the first client render matches the server HTML (avoids hydration mismatch).
  const page = useCmsPageForView("page_about") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
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
      <Footer />
    </div>
  );
}
