import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { useEdit } from "@/lib/cms/edit-context";

export const Route = createFileRoute("/offerte")({
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
  const page = useCmsPageForView("page_offerte");
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
