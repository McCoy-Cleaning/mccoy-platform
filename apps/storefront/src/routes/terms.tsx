import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Algemene Voorwaarden — McCoy Cleaning" },
      {
        name: "description",
        content:
          "Algemene voorwaarden van McCoy Schoonmaak en Reiniging — offertes, uitvoering, aansprakelijkheid en geschillen.",
      },
      { property: "og:title", content: "Algemene Voorwaarden — McCoy Cleaning" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

type Article = { title: string; body: string };

const articles: Article[] = [
  {
    title: "Artikel 1 – Definities",
    body: `Opdrachtnemer: McCoy Schoonmaak en Reiniging, gevestigd te Oldenzaal, ingeschreven bij de Kamer van Koophandel onder nummer 42026285 (McCoy Cleaning BV).

Opdrachtgever: de natuurlijke persoon of rechtspersoon die aan opdrachtnemer opdracht geeft tot het verrichten van werkzaamheden.

Overeenkomst: iedere mondelinge of schriftelijke afspraak tussen opdrachtgever en opdrachtnemer met betrekking tot schoonmaak- en/of reinigingswerkzaamheden.`,
  },
  {
    title: "Artikel 2 – Toepasselijkheid",
    body: `1. Deze algemene voorwaarden zijn van toepassing op alle offertes, overeenkomsten en werkzaamheden van opdrachtnemer.
2. Afwijkingen van deze voorwaarden zijn slechts geldig indien deze schriftelijk zijn overeengekomen.
3. Algemene voorwaarden van opdrachtgever worden uitdrukkelijk van de hand gewezen.`,
  },
  {
    title: "Artikel 3 – Offertes en Overeenkomst",
    body: `1. Alle offertes zijn vrijblijvend, tenzij uitdrukkelijk anders vermeld.
2. Een overeenkomst komt tot stand na schriftelijke of mondelinge acceptatie van de offerte door opdrachtgever.
3. Opdrachtnemer is gerechtigd werkzaamheden geheel of gedeeltelijk door derden te laten uitvoeren.`,
  },
  {
    title: "Artikel 4 – Uitvoering van de Werkzaamheden",
    body: `1. Opdrachtnemer zal de werkzaamheden uitvoeren naar beste inzicht, deskundigheid en vakmanschap.
2. Opdrachtgever draagt zorg voor:
   a. tijdige toegang tot de werklocatie;
   b. de aanwezigheid van noodzakelijke voorzieningen zoals water, elektriciteit en sanitaire faciliteiten.
3. Indien opdrachtgever niet aan zijn verplichtingen voldoet, is opdrachtnemer gerechtigd de uitvoering van de werkzaamheden op te schorten.`,
  },
  {
    title: "Artikel 5 – Prijzen en Betaling",
    body: `1. Alle prijzen zijn exclusief btw, tenzij anders vermeld.
2. Facturen dienen binnen 30 dagen na factuurdatum te worden voldaan.
3. Bij overschrijding van de betalingstermijn is opdrachtgever van rechtswege in verzuim.
4. Vanaf dat moment is opdrachtgever wettelijke rente verschuldigd, evenals alle redelijke buitengerechtelijke incassokosten.`,
  },
  {
    title: "Artikel 6 – Duur en Opzegging",
    body: `1. Overeenkomsten worden aangegaan voor bepaalde of onbepaalde tijd.
2. Overeenkomsten voor onbepaalde tijd kunnen schriftelijk worden opgezegd met een opzegtermijn van één maand, tenzij anders overeengekomen.
3. Opdrachtnemer is gerechtigd de overeenkomst per direct te beëindigen bij:
   a. Wanbetaling;
   b. Ernstig tekortschieten van opdrachtgever.`,
  },
  {
    title: "Artikel 7 – Aansprakelijkheid",
    body: `1. Opdrachtnemer is uitsluitend aansprakelijk voor directe schade die het gevolg is van opzet of grove nalatigheid.
2. De aansprakelijkheid is beperkt tot het bedrag dat door de aansprakelijkheidsverzekering wordt uitgekeerd.
3. Opdrachtnemer is niet aansprakelijk voor indirecte schade, waaronder gevolgschade, gederfde winst en bedrijfsschade.
4. Schade dient binnen 7 dagen na ontdekking schriftelijk te worden gemeld.
5. Opdrachtnemer is in het bijzonder niet aansprakelijk voor schade ontstaan door:
   a. het verplaatsen of te vroeg terugplaatsen van meubilair of het te vroeg in gebruik nemen van gereinigde zaken;
   b. vermissing of beschadiging van zaken die niet aantoonbaar het gevolg zijn van schuld of nalatigheid van opdrachtnemer;
   c. het uitvloeien van vlekken die vooraf niet zichtbaar waren of niet gemeld zijn door opdrachtgever;
   d. het voortijdig betreden of gebruiken van ruimtes waar beschermlagen zijn aangebracht die nog niet droog zijn of dampen kunnen afgeven;
   e. het niet in acht nemen van opgegeven droogtijden;
   f. krimp of uitrekking van tapijten, gordijnen of meubelstoffen;
   g. kleurveranderingen of uitvloeiing van kleuren tijdens reiniging;
   h. verkleuring van materialen door interne oorzaken (bijv. vanuit meubel- of tapijtstructuur);
   i. loszittende of gebrekkige ondergronden die vooraf niet zichtbaar waren of gemeld zijn, zoals lijmlagen of voegwerk.`,
  },
  {
    title: "Artikel 8 – Klachten",
    body: `1. Klachten dienen binnen 48 uur na uitvoering van de werkzaamheden schriftelijk te worden gemeld.
2. Opdrachtnemer krijgt de gelegenheid om de klacht binnen een redelijke termijn te herstellen.
3. Indien niet tijdig wordt geklaagd, vervalt het recht op herstel of compensatie.`,
  },
  {
    title: "Artikel 9 – Overmacht",
    body: `1. Onder overmacht wordt verstaan iedere omstandigheid buiten de invloed van opdrachtnemer waardoor nakoming tijdelijk of blijvend onmogelijk is.
2. In geval van overmacht is opdrachtnemer gerechtigd de werkzaamheden op te schorten of de overeenkomst te ontbinden zonder schadeplichtig te zijn.`,
  },
  {
    title: "Artikel 10 – Vertrouwelijkheid",
    body: `1. Beide partijen zijn verplicht tot geheimhouding van vertrouwelijke informatie die zij in het kader van de overeenkomst verkrijgen.
2. Deze verplichting blijft ook na beëindiging van de overeenkomst van kracht.`,
  },
  {
    title: "Artikel 11 – Toepasselijk Recht en Geschillen",
    body: `1. Op alle overeenkomsten is uitsluitend Nederlands recht van toepassing.
2. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement waar opdrachtnemer is gevestigd.`,
  },
];

function TermsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Juridisch
          </p>
          <h1 className="font-display mt-3 text-5xl text-white md:text-6xl">
            Algemene Voorwaarden
          </h1>
          <p className="mt-4 text-sm text-white/55">
            McCoy Schoonmaak en Reiniging — laatst bijgewerkt: juni 2026
          </p>

          <div className="mt-12 space-y-6">
            {articles.map((a) => (
              <article
                key={a.title}
                className="rounded-3xl border border-white/10 bg-card/60 p-7 md:p-9"
              >
                <h2 className="font-display text-2xl text-white md:text-3xl">{a.title}</h2>
                <div className="mt-4 space-y-3 whitespace-pre-line text-[15px] leading-relaxed text-white/75">
                  {a.body}
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