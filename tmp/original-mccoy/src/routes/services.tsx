import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Services } from "@/components/site/Sections";

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
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-24">
        <Services />
      </main>
      <Footer />
    </div>
  );
}