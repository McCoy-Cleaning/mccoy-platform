import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { useEdit } from "@/lib/cms/edit-context";

export const Route = createFileRoute("/contact")({
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
  const page = useCmsPageForView("page_contact");
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32">
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
