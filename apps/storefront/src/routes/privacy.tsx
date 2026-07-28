import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { useEdit } from "@/lib/cms/edit-context";

export const Route = createFileRoute("/privacy")({
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
  const page = useCmsPageForView("page_privacy");
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
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
      <Footer />
    </div>
  );
}
