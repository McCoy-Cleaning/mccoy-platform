import { createFileRoute } from "@tanstack/react-router";
import { CityLanding, cityJsonLd } from "@/components/site/CityLanding";
import { absoluteCanonicalLink, absoluteOgUrl } from "@/lib/cms/absolute-head";

const city = "Enschede";
const path = "/schoonmaakbedrijf-enschede";

export const Route = createFileRoute("/schoonmaakbedrijf-enschede")({
  head: () => ({
    meta: [
      { title: "Schoonmaakbedrijf Enschede — McCoy Cleaning" },
      {
        name: "description",
        content:
          "Schoonmaakbedrijf in Enschede: kantoorschoonmaak, glasbewassing en vloeronderhoud door een vast eigen team van McCoy Cleaning. Vraag een offerte aan.",
      },
      { property: "og:title", content: "Schoonmaakbedrijf Enschede — McCoy Cleaning" },
      {
        property: "og:description",
        content:
          "Professionele schoonmaak in Enschede door een vast eigen team. Kantoor, horeca, glasbewassing en vloeronderhoud.",
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
  component: EnschedePage,
});

function EnschedePage() {
  return (
    <CityLanding
      city={city}
      intro="Zoekt u een betrouwbaar schoonmaakbedrijf in Enschede? McCoy Cleaning verzorgt de dagelijkse en periodieke schoonmaak voor bedrijven, kantoren en horeca in Enschede en de rest van Twente."
      services={[
        {
          title: "Kantoorschoonmaak Enschede",
          body: "Dagelijkse en periodieke schoonmaak van kantoren, vergaderruimtes en sanitair — buiten of tijdens werktijd.",
        },
        {
          title: "Glasbewassing Enschede",
          body: "Ramen, gevels en glazen puien professioneel gereinigd. Ook op hoogte met de juiste veiligheidsmiddelen.",
        },
        {
          title: "Horecaschoonmaak Enschede",
          body: "Restaurants, hotels en cafés in het centrum van Enschede en omgeving — discreet en op maat.",
        },
        {
          title: "Vloeronderhoud",
          body: "Kristalliseren, machinaal reinigen en beschermen van tegel-, PVC- en natuursteenvloeren.",
        },
        {
          title: "Opleveringsschoonmaak",
          body: "Nieuwbouw en renovatie opgeleverd in showroomstaat, klaar voor bewoning of ingebruikname.",
        },
        {
          title: "Specialistisch reinigen",
          body: "Dieptereiniging van sanitair, tapijten en meubels bij bedrijven in Enschede.",
        },
      ]}
      reasons={[
        "Snel ter plaatse in Enschede vanuit ons kantoor in Oldenzaal",
        "Eén vast team dat uw pand en wensen kent",
        "Transparante offerte en heldere planning",
        "25+ jaar ervaring in Twente",
        "Duurzame reinigingsmiddelen en moderne apparatuur",
      ]}
    />
  );
}