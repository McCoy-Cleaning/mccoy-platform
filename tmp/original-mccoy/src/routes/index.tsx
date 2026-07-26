import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PartnersSlider } from "@/components/site/PartnersSlider";
import {
  Hero,
  Stats,
  WorkGallery,
} from "@/components/site/Sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Schoonmaakbedrijf Twente — Kantoor, Horeca & Glasbewassing" },
      {
        name: "description",
        content:
          "Schoonmaak in Twente met vast eigen team: kantoor, glasbewassing, vloeronderhoud, horeca en oplevering. Oldenzaal, Hengelo, Enschede, Almelo.",
      },
      { property: "og:title", content: "Schoonmaakbedrijf Twente — McCoy Cleaning" },
      {
        property: "og:description",
        content:
          "Professionele schoonmaak, glasbewassing en vloeronderhoud voor bedrijven en horeca in Twente. 25+ jaar ervaring.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "alternate", hrefLang: "nl", href: "/" },
      { rel: "alternate", hrefLang: "en", href: "/en" },
      { rel: "alternate", hrefLang: "x-default", href: "/" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <PartnersSlider />
        <Stats />
        <WorkGallery />
      </main>
      <Footer />
    </div>
  );
}
