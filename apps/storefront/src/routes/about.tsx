import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { useEdit } from "@/lib/cms/edit-context";

export const Route = createFileRoute("/about")({
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
  const page = useCmsPageForView("page_about");
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
