import { createFileRoute } from "@tanstack/react-router";
import { CityLanding, cityJsonLd } from "@/components/site/CityLanding";
import { absoluteCanonicalLink, absoluteOgUrl } from "@/lib/cms/absolute-head";

const city = "Hengelo";
const path = "/schoonmaakbedrijf-hengelo";

export const Route = createFileRoute("/schoonmaakbedrijf-hengelo")({
  head: () => ({
    meta: [
      { title: "Schoonmaakbedrijf Hengelo — McCoy Cleaning" },
      {
        name: "description",
        content:
          "Schoonmaakbedrijf in Hengelo: kantoorschoonmaak, glasbewassing en horecaschoonmaak door een vast eigen team van McCoy Cleaning. Vraag een offerte aan.",
      },
      { property: "og:title", content: "Schoonmaakbedrijf Hengelo — McCoy Cleaning" },
      {
        property: "og:description",
        content:
          "Professionele schoonmaak in Hengelo door een vast eigen team. Kantoor, horeca, glasbewassing en vloeronderhoud.",
      },
      { property: "og:url", content: absoluteOgUrl(path) },
      { property: "og:type", content: "website" },
    ],
    links: [absoluteCanonicalLink(path)],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(cityJsonLd(city, path)),
      },
    ],
  }),
  component: HengeloPage,
});

function HengeloPage() {
  return (
    <CityLanding
      city={city}
      intro="McCoy Cleaning is uw schoonmaakbedrijf in Hengelo. Wij verzorgen kantoorschoonmaak, glasbewassing en specialistische reiniging voor bedrijven op industrieterreinen en in het centrum van Hengelo."
      services={[
        {
          title: "Kantoorschoonmaak Hengelo",
          body: "Van kleine kantoortuinen tot grote bedrijfspanden — dagelijkse schoonmaak volgens vast programma.",
        },
        {
          title: "Glasbewassing Hengelo",
          body: "Periodieke glasbewassing binnen en buiten, met eigen materieel en gediplomeerde glazenwassers.",
        },
        {
          title: "Horecaschoonmaak Hengelo",
          body: "Hotels, restaurants en cafés in Hengelo dagelijks fris en representatief houden.",
        },
        {
          title: "Vloeronderhoud",
          body: "Machinale reiniging, coating en onderhoud van vloeren in showrooms en bedrijfsruimtes.",
        },
        {
          title: "Opleveringsschoonmaak",
          body: "Bouw- en verhuisschoonmaak in Hengelo, ook op korte termijn planbaar.",
        },
        {
          title: "Sanitair dieptereiniging",
          body: "Vergaande reiniging en ontkalking van sanitair — hygiëne op het hoogste niveau.",
        },
      ]}
      reasons={[
        "Direct bereikbaar aanspreekpunt voor uw locatie in Hengelo",
        "Vast team, geen wisselende krachten",
        "Ervaring met industriële en zakelijke omgevingen",
        "25+ jaar actief in Twente",
        "Werk volgens de laatste kwaliteits- en veiligheidsnormen",
      ]}
    />
  );
}