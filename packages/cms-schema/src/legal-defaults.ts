import {
  MCCOY_NAP,
  napAddressSingleLine,
} from "./business-nap";

/** Shared shape for privacy / terms pages — header + ordered text blocks. */
export type LegalArticle = {
  id: string;
  title: string;
  body: string;
};

export type LegalMainContent = {
  eyebrow?: string;
  heading: string;
  updatedLabel?: string;
  articles: LegalArticle[];
};

/** Seed copy migrated from the former static `/privacy` page. */
export function defaultPrivacyMainContent(): LegalMainContent {
  return {
    eyebrow: "Juridisch",
    heading: "Privacyverklaring",
    updatedLabel: "McCoy Cleaning B.V. — laatst bijgewerkt: augustus 2026",
    articles: privacyArticles(),
  };
}

/** Seed copy migrated from the former static `/terms` page. */
export function defaultTermsMainContent(): LegalMainContent {
  return {
    eyebrow: "Juridisch",
    heading: "Algemene Voorwaarden",
    updatedLabel: "McCoy Schoonmaak en Reiniging — laatst bijgewerkt: juni 2026",
    articles: termsArticles(),
  };
}

function article(title: string, body: string): LegalArticle {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return { id: `legal_${slug || "item"}`, title, body };
}

function privacyArticles(): LegalArticle[] {
  return [
    article(
      "Verantwoordelijke",
      `McCoy Cleaning B.V., gevestigd aan ${napAddressSingleLine()}, is verantwoordelijk voor de verwerking van persoonsgegevens zoals weergegeven in deze privacyverklaring.

Contactgegevens:
${MCCOY_NAP.website}
${napAddressSingleLine()}
${MCCOY_NAP.telephoneDisplayNational}`,
    ),
    article(
      "Persoonsgegevens die wij verwerken",
      `McCoy Cleaning B.V. verwerkt je persoonsgegevens doordat je gebruik maakt van onze diensten en/of omdat je deze gegevens zelf aan ons verstrekt.

Hieronder vind je een overzicht van de persoonsgegevens die wij verwerken:
• Voor- en achternaam
• Adresgegevens
• Telefoonnummer
• E-mailadres
• Overige persoonsgegevens die de klant actief verstrekt, bijvoorbeeld door een profiel op onze website aan te maken, in correspondentie en telefonisch`,
    ),
    article(
      "Bijzondere en/of gevoelige persoonsgegevens",
      `Onze website en/of dienst heeft niet de intentie gegevens te verzamelen over websitebezoekers die jonger zijn dan 16 jaar, tenzij ze toestemming hebben van ouders of voogd. We kunnen echter niet controleren of een bezoeker ouder dan 16 is. Wij raden ouders dan ook aan betrokken te zijn bij de onlineactiviteiten van hun kinderen, om zo te voorkomen dat er gegevens over kinderen verzameld worden zonder ouderlijke toestemming.

Als je ervan overtuigd bent dat wij zonder die toestemming persoonlijke gegevens hebben verzameld over een minderjarige, neem dan contact met ons op via ${MCCOY_NAP.email}, dan verwijderen wij deze informatie.`,
    ),
    article(
      "Doeleinden van de gegevensverwerking",
      `McCoy Cleaning B.V. verwerkt jouw persoonsgegevens voor de volgende doelen:
• Je te kunnen bellen of e-mailen indien dit nodig is om onze dienstverlening uit te kunnen voeren
• Je te informeren over wijzigingen van onze diensten en producten
• Om goederen en diensten bij je af te leveren`,
    ),
    article(
      "Geautomatiseerde besluitvorming",
      "McCoy Cleaning B.V. maakt geen gebruik van geautomatiseerde besluitvorming.",
    ),
    article(
      "Hoe lang we persoonsgegevens bewaren",
      "McCoy Cleaning B.V. bewaart je persoonsgegevens niet langer dan strikt nodig is om de doelen te realiseren waarvoor je gegevens worden verzameld. Wij hanteren een bewaartermijn van 6 maanden voor persoonsgegevens.",
    ),
    article(
      "Delen van persoonsgegevens met derden",
      "McCoy Cleaning B.V. verstrekt uitsluitend aan derden en alleen als dit nodig is voor de uitvoering van onze overeenkomst met jou of om te voldoen aan een wettelijke verplichting.",
    ),
    article(
      "Cookies, of vergelijkbare technieken, die wij gebruiken",
      `McCoy Cleaning B.V. gebruikt functionele technieken die nodig zijn voor de werking van de website (bijvoorbeeld het onthouden van je taalvoorkeur).

Voor niet-noodzakelijke statistieken vragen wij apart toestemming via de cookiebanner. Na toestemming laden wij Google Analytics 4 (Google Ireland Limited / Google LLC) om geanonimiseerde bezoekstatistieken te verzamelen (onder meer paginaweergaven en technische gegevens zoals browser/apparaat). Analytics-scripts en bijbehorende cookies worden niet geladen zolang je analytics cookies niet hebt geaccepteerd. Je kunt je keuze later resetten door de lokale opslag (localStorage) van deze website te wissen of opnieuw te kiezen wanneer de banner opnieuw verschijnt.

Daarnaast kan Vercel Web Analytics actief zijn. Dat is een cookieloze, geaggregeerde meting van websitebezoek en valt buiten de analytics-cookiebanner.`,
    ),
    article(
      "Gegevens inzien, aanpassen of verwijderen",
      `Je hebt het recht om je persoonsgegevens in te zien, te corrigeren of te verwijderen. Dit kun je zelf doen via de persoonlijke instellingen van jouw account. Daarnaast heb je het recht om je eventuele toestemming voor de gegevensverwerking in te trekken of bezwaar te maken tegen de verwerking van jouw persoonsgegevens door ons bedrijf en heb je het recht op gegevensoverdraagbaarheid. Dat betekent dat je bij ons een verzoek kan indienen om de persoonsgegevens die wij van jou beschikken in een computerbestand naar jou of een ander, door jou genoemde organisatie, te sturen.

Wil je gebruik maken van je recht op bezwaar en/of recht op gegevensoverdraagbaarheid of heb je andere vragen/opmerkingen over de gegevensverwerking, stuur dan een gespecificeerd verzoek naar ${MCCOY_NAP.email}.

Om er zeker van te zijn dat het verzoek tot inzage door jou is gedaan, vragen wij jou een kopie van je identiteitsbewijs bij het verzoek mee te sturen. Maak in deze kopie je pasfoto, MRZ (machine readable zone, de strook met nummers onderaan het paspoort), paspoortnummer en Burgerservicenummer (BSN) zwart. Dit ter bescherming van je privacy. McCoy Cleaning B.V. zal zo snel mogelijk, maar in ieder geval binnen vier weken, op jouw verzoek reageren.

McCoy Cleaning B.V. wil je er tevens op wijzen dat je de mogelijkheid hebt om een klacht in te dienen bij de nationale toezichthouder, de Autoriteit Persoonsgegevens. Dat kan via de volgende link: https://autoriteitpersoonsgegevens.nl/nl/contact-met-de-autoriteit-persoonsgegevens/tip-ons`,
    ),
    article(
      "Hoe wij persoonsgegevens beveiligen",
      `McCoy Cleaning B.V. neemt de bescherming van jouw gegevens serieus en neemt passende maatregelen om misbruik, verlies, onbevoegde toegang, ongewenste openbaarmaking en ongeoorloofde wijziging tegen te gaan. Als jij het idee hebt dat jouw gegevens toch niet goed beveiligd zijn of er aanwijzingen zijn van misbruik, neem dan contact op met onze klantenservice of via ${MCCOY_NAP.email}.`,
    ),
  ];
}

function termsArticles(): LegalArticle[] {
  return [
    article(
      "Artikel 1 – Definities",
      `Opdrachtnemer: McCoy Schoonmaak en Reiniging, gevestigd te Oldenzaal, ingeschreven bij de Kamer van Koophandel onder nummer 42026285 (McCoy Cleaning BV).

Opdrachtgever: de natuurlijke persoon of rechtspersoon die aan opdrachtnemer opdracht geeft tot het verrichten van werkzaamheden.

Overeenkomst: iedere mondelinge of schriftelijke afspraak tussen opdrachtgever en opdrachtnemer met betrekking tot schoonmaak- en/of reinigingswerkzaamheden.`,
    ),
    article(
      "Artikel 2 – Toepasselijkheid",
      `1. Deze algemene voorwaarden zijn van toepassing op alle offertes, overeenkomsten en werkzaamheden van opdrachtnemer.
2. Afwijkingen van deze voorwaarden zijn slechts geldig indien deze schriftelijk zijn overeengekomen.
3. Algemene voorwaarden van opdrachtgever worden uitdrukkelijk van de hand gewezen.`,
    ),
    article(
      "Artikel 3 – Offertes en Overeenkomst",
      `1. Alle offertes zijn vrijblijvend, tenzij uitdrukkelijk anders vermeld.
2. Een overeenkomst komt tot stand na schriftelijke of mondelinge acceptatie van de offerte door opdrachtgever.
3. Opdrachtnemer is gerechtigd werkzaamheden geheel of gedeeltelijk door derden te laten uitvoeren.`,
    ),
    article(
      "Artikel 4 – Uitvoering van de Werkzaamheden",
      `1. Opdrachtnemer zal de werkzaamheden uitvoeren naar beste inzicht, deskundigheid en vakmanschap.
2. Opdrachtgever draagt zorg voor:
   a. tijdige toegang tot de werklocatie;
   b. de aanwezigheid van noodzakelijke voorzieningen zoals water, elektriciteit en sanitaire faciliteiten.
3. Indien opdrachtgever niet aan zijn verplichtingen voldoet, is opdrachtnemer gerechtigd de uitvoering van de werkzaamheden op te schorten.`,
    ),
    article(
      "Artikel 5 – Prijzen en Betaling",
      `1. Alle prijzen zijn exclusief btw, tenzij anders vermeld.
2. Facturen dienen binnen 30 dagen na factuurdatum te worden voldaan.
3. Bij overschrijding van de betalingstermijn is opdrachtgever van rechtswege in verzuim.
4. Vanaf dat moment is opdrachtgever wettelijke rente verschuldigd, evenals alle redelijke buitengerechtelijke incassokosten.`,
    ),
    article(
      "Artikel 6 – Duur en Opzegging",
      `1. Overeenkomsten worden aangegaan voor bepaalde of onbepaalde tijd.
2. Overeenkomsten voor onbepaalde tijd kunnen schriftelijk worden opgezegd met een opzegtermijn van één maand, tenzij anders overeengekomen.
3. Opdrachtnemer is gerechtigd de overeenkomst per direct te beëindigen bij:
   a. Wanbetaling;
   b. Ernstig tekortschieten van opdrachtgever.`,
    ),
    article(
      "Artikel 7 – Aansprakelijkheid",
      `1. Opdrachtnemer is uitsluitend aansprakelijk voor directe schade die het gevolg is van opzet of grove nalatigheid.
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
    ),
    article(
      "Artikel 8 – Klachten",
      `1. Klachten dienen binnen 48 uur na uitvoering van de werkzaamheden schriftelijk te worden gemeld.
2. Opdrachtnemer krijgt de gelegenheid om de klacht binnen een redelijke termijn te herstellen.
3. Indien niet tijdig wordt geklaagd, vervalt het recht op herstel of compensatie.`,
    ),
    article(
      "Artikel 9 – Overmacht",
      `1. Onder overmacht wordt verstaan iedere omstandigheid buiten de invloed van opdrachtnemer waardoor nakoming tijdelijk of blijvend onmogelijk is.
2. In geval van overmacht is opdrachtnemer gerechtigd de werkzaamheden op te schorten of de overeenkomst te ontbinden zonder schadeplichtig te zijn.`,
    ),
    article(
      "Artikel 10 – Vertrouwelijkheid",
      `1. Beide partijen zijn verplicht tot geheimhouding van vertrouwelijke informatie die zij in het kader van de overeenkomst verkrijgen.
2. Deze verplichting blijft ook na beëindiging van de overeenkomst van kracht.`,
    ),
    article(
      "Artikel 11 – Toepasselijk Recht en Geschillen",
      `1. Op alle overeenkomsten is uitsluitend Nederlands recht van toepassing.
2. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement waar opdrachtnemer is gevestigd.`,
    ),
  ];
}
