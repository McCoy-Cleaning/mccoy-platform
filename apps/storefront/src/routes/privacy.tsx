import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

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

type Section = { title: string; body: string };

const sections: Section[] = [
  {
    title: "Verantwoordelijke",
    body: `McCoy Cleaning B.V., gevestigd aan Nijverheidsstraat 63, 7575 BH Oldenzaal, is verantwoordelijk voor de verwerking van persoonsgegevens zoals weergegeven in deze privacyverklaring.

Contactgegevens:
https://www.mccoy.nl
Nijverheidsstraat 63, 7575 BH Oldenzaal
0541 534 982`,
  },
  {
    title: "Persoonsgegevens die wij verwerken",
    body: `McCoy Cleaning B.V. verwerkt je persoonsgegevens doordat je gebruik maakt van onze diensten en/of omdat je deze gegevens zelf aan ons verstrekt.

Hieronder vind je een overzicht van de persoonsgegevens die wij verwerken:
• Voor- en achternaam
• Adresgegevens
• Telefoonnummer
• E-mailadres
• Overige persoonsgegevens die de klant actief verstrekt, bijvoorbeeld door een profiel op onze website aan te maken, in correspondentie en telefonisch`,
  },
  {
    title: "Bijzondere en/of gevoelige persoonsgegevens",
    body: `Onze website en/of dienst heeft niet de intentie gegevens te verzamelen over websitebezoekers die jonger zijn dan 16 jaar, tenzij ze toestemming hebben van ouders of voogd. We kunnen echter niet controleren of een bezoeker ouder dan 16 is. Wij raden ouders dan ook aan betrokken te zijn bij de onlineactiviteiten van hun kinderen, om zo te voorkomen dat er gegevens over kinderen verzameld worden zonder ouderlijke toestemming.

Als je ervan overtuigd bent dat wij zonder die toestemming persoonlijke gegevens hebben verzameld over een minderjarige, neem dan contact met ons op via info@mccoy.nl, dan verwijderen wij deze informatie.`,
  },
  {
    title: "Doeleinden van de gegevensverwerking",
    body: `McCoy Cleaning B.V. verwerkt jouw persoonsgegevens voor de volgende doelen:
• Je te kunnen bellen of e-mailen indien dit nodig is om onze dienstverlening uit te kunnen voeren
• Je te informeren over wijzigingen van onze diensten en producten
• Om goederen en diensten bij je af te leveren`,
  },
  {
    title: "Geautomatiseerde besluitvorming",
    body: "McCoy Cleaning B.V. maakt geen gebruik van geautomatiseerde besluitvorming.",
  },
  {
    title: "Hoe lang we persoonsgegevens bewaren",
    body: "McCoy Cleaning B.V. bewaart je persoonsgegevens niet langer dan strikt nodig is om de doelen te realiseren waarvoor je gegevens worden verzameld. Wij hanteren een bewaartermijn van 6 maanden voor persoonsgegevens.",
  },
  {
    title: "Delen van persoonsgegevens met derden",
    body: "McCoy Cleaning B.V. verstrekt uitsluitend aan derden en alleen als dit nodig is voor de uitvoering van onze overeenkomst met jou of om te voldoen aan een wettelijke verplichting.",
  },
  {
    title: "Cookies, of vergelijkbare technieken, die wij gebruiken",
    body: "McCoy Cleaning B.V. gebruikt geen cookies of vergelijkbare technieken.",
  },
  {
    title: "Gegevens inzien, aanpassen of verwijderen",
    body: `Je hebt het recht om je persoonsgegevens in te zien, te corrigeren of te verwijderen. Dit kun je zelf doen via de persoonlijke instellingen van jouw account. Daarnaast heb je het recht om je eventuele toestemming voor de gegevensverwerking in te trekken of bezwaar te maken tegen de verwerking van jouw persoonsgegevens door ons bedrijf en heb je het recht op gegevensoverdraagbaarheid. Dat betekent dat je bij ons een verzoek kan indienen om de persoonsgegevens die wij van jou beschikken in een computerbestand naar jou of een ander, door jou genoemde organisatie, te sturen.

Wil je gebruik maken van je recht op bezwaar en/of recht op gegevensoverdraagbaarheid of heb je andere vragen/opmerkingen over de gegevensverwerking, stuur dan een gespecificeerd verzoek naar info@mccoy.nl.

Om er zeker van te zijn dat het verzoek tot inzage door jou is gedaan, vragen wij jou een kopie van je identiteitsbewijs bij het verzoek mee te sturen. Maak in deze kopie je pasfoto, MRZ (machine readable zone, de strook met nummers onderaan het paspoort), paspoortnummer en Burgerservicenummer (BSN) zwart. Dit ter bescherming van je privacy. McCoy Cleaning B.V. zal zo snel mogelijk, maar in ieder geval binnen vier weken, op jouw verzoek reageren.

McCoy Cleaning B.V. wil je er tevens op wijzen dat je de mogelijkheid hebt om een klacht in te dienen bij de nationale toezichthouder, de Autoriteit Persoonsgegevens. Dat kan via de volgende link: https://autoriteitpersoonsgegevens.nl/nl/contact-met-de-autoriteit-persoonsgegevens/tip-ons`,
  },
  {
    title: "Hoe wij persoonsgegevens beveiligen",
    body: "McCoy Cleaning B.V. neemt de bescherming van jouw gegevens serieus en neemt passende maatregelen om misbruik, verlies, onbevoegde toegang, ongewenste openbaarmaking en ongeoorloofde wijziging tegen te gaan. Als jij het idee hebt dat jouw gegevens toch niet goed beveiligd zijn of er aanwijzingen zijn van misbruik, neem dan contact op met onze klantenservice of via info@mccoy.nl.",
  },
];

function PrivacyPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Juridisch
          </p>
          <h1 className="font-display mt-3 text-5xl text-white md:text-6xl">
            Privacyverklaring
          </h1>
          <p className="mt-4 text-sm text-white/55">
            McCoy Cleaning B.V. — laatst bijgewerkt: juli 2026
          </p>

          <div className="mt-12 space-y-6">
            {sections.map((s) => (
              <article
                key={s.title}
                className="rounded-3xl border border-white/10 bg-card/60 p-7 md:p-9"
              >
                <h2 className="font-display text-2xl text-white md:text-3xl">{s.title}</h2>
                <div className="mt-4 space-y-3 whitespace-pre-line text-[15px] leading-relaxed text-white/75">
                  {s.body}
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
