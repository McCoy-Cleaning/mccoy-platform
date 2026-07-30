import { createFileRoute, redirect } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
    const { resultJson } = await loadPublishedPageForPath({ data: { pathname: "/contact" } });
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof import("@/lib/cms/load-published-page.server").loadPublishedPageSnapshot>
    >;
    if (result.kind === "redirect") {
      throw redirect({ href: result.toPath, statusCode: result.statusCode });
    }
    // Builtin page — always seeded + published; a missing snapshot means the CMS
    // store is broken, not that the page is legitimately absent.
    if (result.kind !== "snapshot") {
      throw new Error("cms: contact loader must return a snapshot");
    }
    return { snapshot: result.snapshot };
  },
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
  // Prefer the SSR-resolved loader snapshot over the client-only CMS seed store so
  // the first client render matches the server HTML (avoids hydration mismatch).
  const page = useCmsPageForView("page_contact") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-28 sm:pt-32 pb-8">
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
      <Footer />
    </div>
  );
}
