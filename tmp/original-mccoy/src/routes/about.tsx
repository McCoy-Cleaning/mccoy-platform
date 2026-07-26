import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { About } from "@/components/site/Sections";

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
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-24">
        <About />
      </main>
      <Footer />
    </div>
  );
}