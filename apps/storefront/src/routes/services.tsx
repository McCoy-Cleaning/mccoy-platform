import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { useEdit } from "@/lib/cms/edit-context";

export const Route = createFileRoute("/services")({
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
  const page = useCmsPageForView("page_services");
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
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
      <Footer />
    </div>
  );
}
