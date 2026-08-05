import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";
import {
  resolveUiLangFromHints,
  UI_LOCALE_COOKIE,
  type Locale,
} from "@mccoy/cms-schema";

const STORAGE_KEY = UI_LOCALE_COOKIE;
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export type Lang = Locale;

type Dict = typeof translations.nl;

const translations = {
  nl: {
    nav: {
      home: "Home",
      services: "Diensten",
      about: "Over ons",
      products: "Producten",
      work: "Ons werk",
      contact: "Contact",
      jobs: "Vacatures",
      cta: "Vraag een offerte aan",
      terms: "Algemene voorwaarden",
    },
    hero: {
      kicker: "Live Clean",
      title: "Bij McCoy wordt kwaliteit",
      titleAccent: "zichtbaar.",
      sub: "Al meer dan 25 jaar staan wij voor schoonmaak met karakter — uitgevoerd door een vast eigen team, met professionele middelen en een onmiskenbaar oog voor detail. Geen onderaannemers, geen losse krachten: alleen vakmensen die uw pand behandelen alsof het hun eigen pand is.",
      ctaPrimary: "Vraag een offerte aan",
      ctaSecondary: "Bekijk onze diensten",
    },
    stats: {
      kicker: "Kwaliteit boven alles",
      title: "Meer dan",
      titleAccent: "25 jaar",
      titleEnd: "expertise in zichtbare kwaliteit.",
      sub: "Wij geloven dat schoonmaak een vak is — geen bijzaak. Daarom investeren wij in mensen, training en de juiste apparatuur. Het resultaat: een pand dat structureel schoner oogt, langer mooi blijft en bezoekers direct het verschil laat voelen vanaf de drempel.",
      items: [
        { value: "25+", label: "Jaar ervaring" },
        { value: "100%", label: "Vast eigen team" },
        { value: "160+", label: "Tevreden klanten" },
      ],
    },
    work: {
      kicker: "Ons werk",
      title: "Alles voor een professioneel schone werkomgeving",
      sub: "Van sanitaire voorzieningen en hygiënepapier tot professionele reinigingsmiddelen. McCoy combineert betrouwbare producten, praktisch advies en persoonlijke service in één complete oplossing.",
      items: [
        {
          title: "Reguliere schoonmaak",
          desc: "Een schone werkomgeving is belangrijk voor zowel medewerkers als bezoekers. Bij McCoy Cleaning verzorgen wij professionele reguliere schoonmaak voor bedrijven, kantoren, winkels, praktijken en bedrijfspanden in en rondom Twente.",
          full: [
            "Een schone werkomgeving is belangrijk voor zowel medewerkers als bezoekers. Het zorgt voor een professionele uitstraling, een prettige werksfeer en draagt bij aan hygiëne en productiviteit. Bij McCoy Cleaning verzorgen wij professionele reguliere schoonmaak voor bedrijven, kantoren, winkels, praktijken en bedrijfspanden in en rondom Twente.",
            "Wij werken met vaste schoonmaakplannen die volledig worden afgestemd op jouw wensen en de behoeften van het pand. Of het nu gaat om dagelijkse schoonmaak, wekelijkse onderhoudsrondes of periodieke dieptereiniging: ons team zorgt ervoor dat iedere ruimte schoon, fris en representatief blijft.",
            "Onze medewerkers werken met professionele schoonmaakmiddelen en moderne apparatuur om efficiënt én grondig te reinigen. Daarbij letten we niet alleen op zichtbare netheid, maar ook op hygiëne en detail. Denk aan werkplekken, sanitair, entrees, vergaderruimtes, keukens en algemene ruimtes.",
            "Bij McCoy Cleaning staan betrouwbaarheid, kwaliteit en flexibiliteit centraal. Wij begrijpen dat ieder bedrijf anders is en zorgen daarom voor een aanpak die aansluit op jouw planning en werkzaamheden.",
          ],
        },
        {
          title: "Horeca schoonmaak",
          desc: "In de horeca draait alles om beleving, uitstraling en hygiëne. Wij verzorgen professionele horeca schoonmaak voor restaurants, cafés, hotels en lunchrooms in en rondom Twente.",
          full: [
            "In de horeca draait alles om beleving, uitstraling en hygiëne. Gasten verwachten een schone en verzorgde omgeving vanaf het moment dat ze binnenkomen. Bij McCoy Cleaning begrijpen we hoe belangrijk dit is. Daarom verzorgen wij professionele horeca schoonmaak voor restaurants, cafés, hotels, lunchrooms en andere horecalocaties in en rondom Twente.",
            "Een horecazaak krijgt dagelijks te maken met intensief gebruik. Keukens, vloeren, sanitair en meubilair moeten niet alleen schoon ogen, maar ook voldoen aan hoge hygiënestandaarden. Ons team werkt met professionele reinigingsmiddelen en efficiënte methodes om iedere ruimte grondig te reinigen.",
            "Wij verzorgen zowel dagelijkse schoonmaak als periodiek onderhoud en kunnen werken buiten openingstijden om jouw bedrijfsprocessen niet te verstoren. Van keukenreiniging tot terrasonderhoud: wij zorgen voor een frisse en representatieve uitstraling waar gasten zich prettig voelen.",
          ],
        },
        {
          title: "Opleveringsschoonmaak",
          desc: "Na een verbouwing of renovatie blijft vaak veel stof en bouwafval achter. McCoy Cleaning verzorgt professionele opleveringsschoonmaak voor woningen, kantoren, winkels en bedrijfspanden in en rondom Twente.",
          full: [
            "Na een verbouwing, renovatie of bouwproject blijft vaak veel stof, vuil en bouwafval achter. Een ruimte kan pas echt worden opgeleverd wanneer alles schoon, fris en gebruiksklaar is. McCoy Cleaning verzorgt professionele opleveringsschoonmaak voor woningen, kantoren, winkels en bedrijfspanden in en rondom Twente.",
            "Tijdens een bouw- of renovatieproject verspreidt stof zich vaak door het hele pand. Daarnaast blijven er regelmatig cementresten, verfspatten, stickers en ander bouwvuil achter. Ons team zorgt voor een grondige schoonmaak van iedere ruimte, zodat het pand netjes en representatief kan worden opgeleverd.",
            "Wij werken efficiënt en zorgvuldig en besteden extra aandacht aan details. Van ramen en kozijnen tot sanitair en vloeren: alles wordt professioneel gereinigd zodat de ruimte direct klaar is voor gebruik.",
          ],
        },
        {
          title: "Vloeronderhoud",
          desc: "Vloeren bepalen voor een groot deel de uitstraling van een ruimte. Met professioneel vloeronderhoud van McCoy Cleaning blijven jouw vloeren schoon, verzorgd en langer in topconditie.",
          full: [
            "Vloeren bepalen voor een groot deel de uitstraling van een ruimte. Intensief dagelijks gebruik kan zorgen voor slijtage, vlekken en een doffe uitstraling. Met professioneel vloeronderhoud van McCoy Cleaning blijven jouw vloeren schoon, verzorgd en langer in topconditie.",
            "Wij verzorgen specialistisch vloeronderhoud voor bedrijven, kantoren, horecagelegenheden en commerciële ruimtes in en rondom Twente. Daarbij maken wij gebruik van professionele machines, veilige reinigingsmiddelen en de juiste technieken voor ieder type vloer.",
            "Of het nu gaat om tapijtreiniging, het schrobben en kristalliseren van harde vloeren of het stripppen en in de was zetten: wij zorgen voor een grondige aanpak die zichtbaar resultaat oplevert.",
          ],
        },
        {
          title: "Meubelreiniging",
          desc: "Stoffen meubels, leren banken en stoelen verdienen specialistische zorg. Met professionele extractie en pH-neutrale producten reinigen wij grondig zonder de vezels te beschadigen.",
          full: [
            "Stoffen meubels, leren banken, stoelen en bekleding verdienen specialistische zorg. McCoy Cleaning reinigt jouw meubilair met professionele extractie-apparatuur en pH-neutrale middelen die de vezels beschermen.",
            "Wij verwijderen vlekken, geuren en ingesleten vuil en frissen de bekleding zichtbaar op. Geschikt voor kantoren, horeca, hotels, praktijken én particuliere woningen in en rondom Twente.",
            "Het resultaat: een fris, hygiënisch en als nieuw ogend interieur — met een langere levensduur voor jouw meubilair.",
          ],
        },
        {
          title: "Glasbewassing & Buitenreiniging",
          desc: "De buitenkant van een pand bepaalt de eerste indruk. Schone ramen, een verzorgde gevel en een nette entree dragen direct bij aan een professionele en betrouwbare uitstraling.",
          full: [
            "De buitenkant van een pand bepaalt de eerste indruk. Schone ramen, een verzorgde gevel en een nette entree dragen direct bij aan een professionele en betrouwbare uitstraling.",
            "McCoy Cleaning is gespecialiseerd in glasbewassing en buitenreiniging voor bedrijven, winkels, horecalocaties en bedrijfspanden in Twente en omgeving.",
            "Wij reinigen onder andere:",
            "• Ramen en glaspartijen",
            "• Kozijnen, deuren, houtwerk en boeiranden",
            "• Gevels, damwanden en gevelbeplating",
            "• Entrees en buitenruimtes",
            "• Bestrating rondom het pand",
            "• Zonnepanelen voor optimaal rendement",
            "Of het nu gaat om periodieke glasbewassing of een eenmalige grondige buitenreiniging – wij leveren altijd maatwerk, afgestemd op jouw situatie.",
            "Door weersinvloeden, vervuiling en dagelijks gebruik kunnen ramen, gevels en buitenruimtes snel hun frisse uitstraling verliezen. Met onze professionele apparatuur en veilige werkmethodes zorgen wij ervoor dat jouw pand weer schoon, representatief en uitnodigend oogt.",
            "Wij werken veilig, efficiënt en met oog voor detail, zodat jouw pand het hele jaar door een verzorgde en professionele uitstraling behoudt.",
          ],
        },
      ],
    },
    services: {
      kicker: "Diensten",
      title: "Wat wij voor u verzorgen",
      readMore: "Lees meer",
      readLess: "Inklappen",
      contactCta: "Neem contact op",
      quoteCta: "Offerte aanvragen",
    },
    about: {
      kicker: "Over ons",
      title: "Kwaliteit, missie & visie",
      missionTitle: "Missie",
      mission:
        "McCoy heeft als missie het leveren van schoonmaakdiensten van het hoogste kwaliteitsniveau voor organisaties waar hygiëne en uitstraling van cruciaal belang zijn.\n\nWij realiseren schone, veilige en representatieve leef- en werkomgevingen door te werken met maximale precisie, professionele middelen en goed opgeleide vakmensen. Daarbij streven wij continu naar een subliem eindresultaat, waarbij geen detail over het hoofd wordt gezien.\n\nMcCoy onderscheidt zich door een compromisloze focus op kwaliteit: wij leveren geen standaard schoonmaak, maar een zichtbaar hoger niveau van dienstverlening.",
      visionTitle: "Visie",
      vision:
        "McCoy heeft de ambitie om uit te groeien tot het toonaangevende schoonmaakbedrijf in de regio voor opdrachtgevers die uitsluitend genoegen nemen met de hoogste kwaliteit.\n\nDe organisatie richt zich specifiek op sectoren waarin hygiëne een essentiële rol speelt, zoals tandartspraktijken, de medische sector en hoogwaardige bedrijfslocaties. Daarnaast richt McCoy zich op omvangrijke en specialistische schoonmaakprojecten, zoals het opleveren van bedrijfspanden en woningen, specialistische dieptereiniging van sanitair en keukens en gespecialiseerd vloeronderhoud.\n\nMcCoy is een partner die de klant wil ontzorgen door middel van schoonmaak, glasbewassing en facilitaire producten die zorgen voor een frisse en professionele uitstraling.\n\nBinnen de strategie van McCoy staat kwaliteit structureel boven prijs. Dit houdt in dat er bewust meer tijd, aandacht en expertise wordt ingezet om een optimaal eindresultaat te realiseren. De klant neemt een centrale positie in: wij streven naar duurzame samenwerkingen en het consequent overtreffen van verwachtingen.",
      historyTitle: "Historie",
      history:
        "McCoy is officieel opgericht op 1 april 1998. De oprichter en eigenaar, Sander Kroese, was destijds 24 jaar oud en werkzaam bij een schoonmaakbedrijf in Delden. Al op jonge leeftijd ontwikkelde hij een sterke affiniteit met schoonmaakwerkzaamheden. Zo hield hij zich in zijn jeugd onder andere bezig met het grondig reinigen van auto's en ondersteunde hij in het ouderlijk huis structureel bij huishoudelijke schoonmaaktaken.\n\nHet idee voor McCoy is ontstaan tijdens een informele gelegenheid in de horeca. In de beginfase richtte het bedrijf zich met name op schoonmaakdiensten voor diverse horecagelegenheden in Oldenzaal. De naam 'McCoy' is bewust gekozen vanwege de betekenis en connotatie. Hoewel het een veelvoorkomende achternaam is in Schotland, verwijst de uitdrukking \"The real McCoy\" naar authenticiteit en kwaliteit, oftewel: het leveren van het beste en het échte werk. Deze waarden vormen de kern van de bedrijfsvisie van de oprichter.",
    },
    partners: {
      kicker: "Onze klanten",
      title: "Klanten waar wij voor werken",
    },
    products: {
      kicker: "Producten",
      title: "McCoy Cleaning Products",
      desc: "Ontdek geurbeleving, premium dispensers en facilitaire producten die zorgen voor een frisse, representatieve ruimte.",
      cta: "Vraag productofferte aan",
    },
    contact: {
      title: "Laten we praten over uw pand.",
      kicker: "Contact",
      sub: "Of het nu gaat om het aanvragen van reguliere schoonmaak, specialistische reiniging of een algemene vraag, wij staan voor u klaar.",
      name: "Naam",
      phone: "Telefoon",
      email: "E-mail",
      company: "Bedrijfsnaam",
      message: "Uw bericht",
      submit: "Verstuur aanvraag",
      success: "Bedankt! We nemen zo snel mogelijk contact op.",
      address: "Adres",
      hours: "Kantooruren",
      hoursValue: "Maandag t/m vrijdag 08:30 – 17:00",
      addressValue: "Nijverheidsstraat 63\n7575 BH Oldenzaal",
      photosLabel: "Foto's van de situatie (optioneel)",
      photosHelp: "JPG, PNG of PDF — meerdere bestanden toegestaan",
      responseWithin: "Persoonlijk antwoord binnen één werkdag",
      requestsInPortal: "Aanvragen verschijnen in het admin-portaal",
      receivedMessage: "We hebben uw bericht ontvangen en nemen zo snel mogelijk contact op.",
      consent: "Door te versturen stemt u in met verwerking van uw gegevens voor deze aanvraag.",
      submitting: "Bezig…",
      placeholderName: "Uw naam",
      placeholderCompany: "Optioneel",
      placeholderPhone: "06 …",
      placeholderEmail: "naam@bedrijf.nl",
      placeholderMessage: "Waar kunnen we u mee helpen?",
      sections: {
        general: {
          tag: "01 — Reguliere schoonmaak",
          title: "Regulier, horeca & opleveringen",
          desc: "Vaste schoonmaakprogramma's voor kantoren en bedrijfspanden, hospitality cleaning voor restaurants en hotels, en stof- en bouwafvalvrije opleveringschoonmaak na een verbouwing.",
          typeLabel: "Type opdracht",
          types: ["Regulier (kantoor/bedrijf)", "Horeca / hospitality", "Opleveringsschoonmaak"],
          frequency: "Gewenste frequentie",
          frequencyOptions: ["Dagelijks", "Wekelijks (2-5×)", "Maandelijks", "Eenmalig"],
          surface: "Oppervlakte (m²)",
          start: "Gewenste startdatum",
        },
        window: {
          tag: "02 — Glasbewassing",
          title: "Glasbewassing & gevelreiniging",
          desc: "Streep­vrij schone ramen binnen én buiten — van pui op straatniveau tot hoogwerkers en gondels. Vertel ons zo veel mogelijk over het pand, dan rekenen wij u direct een eerlijke prijs voor.",
          floors: "Aantal verdiepingen",
          windows: "Aantal ramen (indicatie)",
          height: "Hoogste raam (meter)",
          access: "Bereikbaarheid",
          accessOptions: ["Vanaf de grond", "Ladder", "Hoogwerker", "Gondel / glazenwasserslift"],
          sides: "Binnen, buiten of beide?",
          sidesOptions: ["Alleen buiten", "Alleen binnen", "Binnen + buiten"],
          frequency: "Frequentie",
          frequencyOptions: ["4× per jaar", "6× per jaar", "Maandelijks", "Eenmalig"],
        },
        furniture: {
          tag: "03 — Vloer- & meubelreiniging",
          title: "Vloer- & meubelonderhoud",
          desc: "Diepe reiniging en bescherming van stoffen meubilair, lederen banken, tapijten en harde vloeren. Wij werken met professionele extractie-apparatuur en pH-neutrale middelen die de vezel sparen.",
          itemType: "Type meubel / vloer",
          itemOptions: [
            "Stoffen bank / fauteuil",
            "Lederen meubilair",
            "Bureaustoelen",
            "Tapijt / vloerbedekking",
            "Harde vloer (PVC / linoleum)",
            "Marmoleum / natuursteen",
            "Parket",
            "Matrassen",
          ],
          pieces: "Aantal stuks",
          material: "Materiaal / stof (indien bekend)",
          stains: "Bijzondere vlekken of geuren",
          area: "Oppervlakte (m²)",
        },
      },
    },
    jobs: {
      kicker: "Vacatures",
      title: "Werken bij McCoy",
      sub: "Door groei zijn we bij McCoy altijd opzoek naar goede mensen, zowel voor de schoonmaak als glasbewassing. Geen ervaring? Geen probleem. Bij McCoy leren wij jou het vak en kijken we naar de uren en dagen die bij jou passen.\n\nJe kunt dus altijd solliciteren!",
      teamTitle: "Meer dan schoonmaken alleen",
      teamText: "Wist je dat we naast schoonmaken ook gewoon kunnen voetballen? Bij McCoy geloven we in een sterke teamgeest — op het werk én daarbuiten.",
      apply: "Solliciteer direct",
      formTitle: "Sollicitatieformulier",
      formSub:
        "Vul je gegevens in, upload je CV en motivatiebrief. Wij reageren binnen 5 werkdagen — altijd persoonlijk.",
      role: "Functie",
      motivation: "Korte motivatie",
      cv: "CV / Resumé (PDF, DOC)",
      letter: "Motivatiebrief (PDF, DOC)",
      cvPick: "Kies bestand",
      videoTitle: "Maak kennis met McCoy",
      videoSub:
        "Een korte blik achter de schermen — de mensen, het vakmanschap en de standaard die wij elke dag waarmaken.",
      submit: "Verstuur sollicitatie",
      success: "Bedankt voor je sollicitatie! We reageren binnen 5 werkdagen.",
      roles: [
        {
          title: "Reguliere schoonmaak",
          desc: "Voor onze vaste schoonmaakrondes bij kantoren en bedrijven zoeken wij medewerkers die oog hebben voor detail en plezier hebben in hun werk.",
        },
        {
          title: "Glazenwasser",
          desc: "Werk in een hecht team aan glasbewassing en gevelreiniging. Ervaring is een pre, motivatie een must.",
        },
        {
          title: "Oproepkracht",
          desc: "Flexibel inzetbaar voor opleveringen en specialistische projecten — ideaal voor wie variatie zoekt.",
        },
      ],
    },
    footer: {
      tagline: "Bij McCoy wordt kwaliteit zichtbaar.",
      rights: "Alle rechten voorbehouden.",
      terms: "Algemene voorwaarden",
      privacy: "Privacyverklaring",
      certs: "Keurmerken & certificaten",
    },
  },
  en: {
    nav: {
      home: "Home",
      services: "Services",
      about: "About",
      products: "Products",
      work: "Our work",
      contact: "Contact",
      jobs: "Careers",
      cta: "Request a quote",
      terms: "Terms & conditions",
    },
    hero: {
      kicker: "Live Clean",
      title: "At McCoy quality becomes",
      titleAccent: "visible.",
      sub: "For over 25 years we've stood for cleaning with character — delivered by a permanent in-house team, with professional equipment and an unmistakable eye for detail. No subcontractors, no temps: only craftspeople who treat your building as if it were their own.",
      ctaPrimary: "Request a quote",
      ctaSecondary: "Explore our services",
    },
    stats: {
      kicker: "Quality above all",
      title: "More than",
      titleAccent: "25 years",
      titleEnd: "of expertise in visible quality.",
      sub: "We believe cleaning is a craft — not an afterthought. That's why we invest in people, training and the right equipment. The result: a building that looks structurally cleaner, stays beautiful longer, and lets visitors feel the difference from the moment they step in.",
      items: [
        { value: "25+", label: "Years experience" },
        { value: "100%", label: "In-house team" },
        { value: "160+", label: "Happy clients" },
      ],
    },
    work: {
      kicker: "Our work",
      title: "Everything for a professionally clean workplace",
      sub: "From sanitary fittings and hygiene paper to professional cleaning agents. McCoy combines reliable products, practical advice and personal service in one complete solution.",
      items: [
        {
          title: "Regular cleaning",
          desc: "A clean workspace matters for staff and visitors alike. McCoy Cleaning delivers professional recurring cleaning for offices, shops, practices and commercial buildings across Twente.",
          full: [
            "A clean workspace matters for both staff and visitors. It signals professionalism, lifts the mood and contributes to hygiene and productivity. McCoy Cleaning delivers professional recurring cleaning for businesses, offices, shops, practices and commercial buildings in and around Twente.",
            "We work with fixed cleaning plans tailored to your wishes and the needs of the building — from daily cleaning and weekly maintenance rounds to periodic deep cleaning. Every room stays clean, fresh and presentable.",
            "Our staff use professional products and modern equipment to clean efficiently and thoroughly, paying attention to hygiene and detail: workstations, sanitary areas, entrances, meeting rooms, kitchens and common spaces.",
            "Reliability, quality and flexibility come first. Every business is different, so our approach fits your planning and operations.",
          ],
        },
        {
          title: "Hospitality cleaning",
          desc: "In hospitality everything is about experience, appearance and hygiene. We deliver professional cleaning for restaurants, cafés, hotels and lunchrooms across Twente.",
          full: [
            "In hospitality everything revolves around experience, appearance and hygiene. Guests expect a clean, well-kept environment the moment they step in. McCoy Cleaning provides professional hospitality cleaning for restaurants, cafés, hotels, lunchrooms and other venues in and around Twente.",
            "Hospitality spaces face intensive daily use. Kitchens, floors, sanitary areas and furniture must look spotless and meet high hygiene standards. Our team uses professional products and efficient methods.",
            "We handle daily cleaning and periodic maintenance, and we can work outside opening hours to avoid disrupting your operations. From kitchen cleaning to terrace upkeep — your venue feels fresh and welcoming.",
          ],
        },
        {
          title: "Post-construction cleaning",
          desc: "After renovation or construction, dust and debris remain. McCoy Cleaning delivers professional post-construction cleaning for homes, offices, shops and commercial buildings across Twente.",
          full: [
            "After a renovation or construction project, dust, dirt and debris are left behind. A space is only truly delivered when everything is clean, fresh and ready to use. We provide professional post-construction cleaning for homes, offices, shops and commercial buildings in and around Twente.",
            "Dust spreads throughout the building during construction, alongside cement residue, paint splatter, stickers and other waste. Our team cleans every room thoroughly so the property can be handed over neat and presentable.",
            "We work efficiently and carefully with extra attention to detail: from windows and frames to sanitary areas and floors — everything is cleaned professionally and ready for use.",
          ],
        },
        {
          title: "Floor care",
          desc: "Floors define the look of a room. With professional floor care from McCoy Cleaning, your floors stay clean, presentable and in top condition for longer.",
          full: [
            "Floors largely define the appearance of a room. Intensive daily use causes wear, stains and a dull look. With professional floor care from McCoy Cleaning, your floors stay clean, presentable and in top condition for longer.",
            "We provide specialist floor maintenance for businesses, offices, hospitality and commercial spaces across Twente, using professional machines, safe products and the right techniques for every type of floor.",
            "Whether it's carpet cleaning, scrubbing and crystallising hard floors or stripping and waxing — our thorough approach delivers visible results and extends the lifespan of your floors.",
          ],
        },
        {
          title: "Furniture cleaning",
          desc: "Fabric furniture, leather sofas and chairs deserve specialist care. With professional extraction equipment and pH-neutral products we clean thoroughly without damaging the fibres.",
          full: [
            "Fabric furniture, leather sofas, chairs and upholstery deserve specialist care. McCoy Cleaning treats your furniture with professional extraction equipment and pH-neutral products that protect the fibres.",
            "We remove stains, odours and ingrained dirt, visibly refreshing the upholstery. Suitable for offices, hospitality, hotels, practices and private homes across Twente.",
            "The result: a fresh, hygienic interior that looks like new — with a longer lifespan for your furniture.",
          ],
        },
        {
          title: "Window & Exterior Cleaning",
          desc: "The exterior of a building determines the first impression. Clean windows, a well-maintained façade and a neat entrance directly contribute to a professional and trustworthy appearance.",
          full: [
            "The exterior of a building determines the first impression. Clean windows, a well-maintained façade and a neat entrance directly contribute to a professional and trustworthy appearance.",
            "McCoy Cleaning specializes in window cleaning and exterior cleaning for companies, shops, hospitality locations and business premises in Twente and the surrounding area.",
            "We clean, among other things:",
            "• Windows and glass sections",
            "• Frames, doors, woodwork and bargeboards",
            "• Façades, sheet piling and façade cladding",
            "• Entrances and outdoor areas",
            "• Paving around the building",
            "• Solar panels for optimal performance",
            "Whether it is periodic window cleaning or a one-off thorough exterior cleaning — we always provide custom work, tailored to your situation.",
            "Due to weather influences, pollution and daily use, windows, façades and outdoor areas can quickly lose their fresh appearance. With our professional equipment and safe working methods, we ensure that your property looks clean, representative and inviting again.",
            "We work safely, efficiently and with an eye for detail, so that your building maintains a well-maintained and professional appearance all year round.",
          ],
        },
      ],
    },
    services: {
      kicker: "Services",
      title: "What we take care of",
      readMore: "Read more",
      readLess: "Collapse",
      contactCta: "Contact us",
      quoteCta: "Get a quote",
    },
    about: {
      kicker: "About us",
      title: "Quality, mission & vision",
      missionTitle: "Mission",
      mission:
        "McCoy's mission is to deliver cleaning services of the highest quality for organisations where hygiene and appearance are critical.\n\nWe create clean, safe and presentable living and working environments through maximum precision, professional equipment and well-trained craftspeople. We continuously pursue a sublime end result, where no detail is overlooked.\n\nMcCoy stands out through an uncompromising focus on quality: not standard cleaning, but a visibly higher level of service.",
      visionTitle: "Vision",
      vision:
        "McCoy aims to grow into the leading cleaning company in the region for clients who only accept the highest quality.\n\nWe focus specifically on sectors where hygiene plays an essential role — dental practices, the medical sector and premium business locations — alongside large and specialist projects: post-construction cleaning of buildings and homes, specialist deep cleaning of sanitary areas and kitchens, and specialised floor care.\n\nMcCoy is a partner that unburdens the client through cleaning, window cleaning and facility products that ensure a fresh and professional appearance.\n\nWithin our strategy, quality structurally comes before price. We deliberately invest more time, attention and expertise to realise an optimal end result. The client takes a central position: we pursue lasting partnerships and consistently exceed expectations.",
      historyTitle: "History",
      history:
        "McCoy was officially founded on 1 April 1998. Founder and owner Sander Kroese was 24 at the time and working for a cleaning company in Delden. From a young age he had a strong affinity for cleaning work — thoroughly detailing cars and helping out structurally with household chores at home.\n\nThe idea for McCoy was born during an informal evening in the hospitality scene. In its early days the company focused mainly on cleaning services for various hospitality venues in Oldenzaal. The name 'McCoy' was chosen deliberately: although a common surname in Scotland, the expression \"The real McCoy\" refers to authenticity and quality — delivering the best, the real thing. These values form the core of the founder's vision for the business.",
    },
    partners: {
      kicker: "Our clients",
      title: "Clients we work for",
    },
    products: {
      kicker: "Products",
      title: "McCoy Cleaning Products",
      desc: "Discover fragrance experience, premium dispensers and facility products that keep every space fresh and representative.",
      cta: "Request a product quote",
    },
    contact: {
      title: "Let's talk about your building.",
      kicker: "Contact",
      sub: "Whether you're requesting regular cleaning, specialist cleaning or you simply have a general question — we're here for you.",
      name: "Name",
      phone: "Phone",
      email: "Email",
      company: "Company",
      message: "Your message",
      submit: "Send request",
      success: "Thank you! We will be in touch shortly.",
      address: "Address",
      hours: "Office hours",
      hoursValue: "Monday to Friday 08:30 – 17:00",
      addressValue: "Nijverheidsstraat 63\n7575 BH Oldenzaal",
      photosLabel: "Photos of the situation (optional)",
      photosHelp: "JPG, PNG or PDF — multiple files allowed",
      responseWithin: "Personal reply within one working day",
      requestsInPortal: "Requests appear in the admin portal",
      receivedMessage: "We have received your message and will get back to you as soon as possible.",
      consent: "By submitting, you agree to the processing of your details for this request.",
      submitting: "Sending…",
      placeholderName: "Your name",
      placeholderCompany: "Optional",
      placeholderPhone: "06 …",
      placeholderEmail: "name@company.com",
      placeholderMessage: "How can we help you?",
      sections: {
        general: {
          tag: "01 — Recurring cleaning",
          title: "Regular, hospitality & post-construction",
          desc: "Recurring cleaning programmes for offices and commercial buildings, hospitality cleaning for restaurants and hotels, and dust-free post-construction cleaning after renovations.",
          typeLabel: "Type of work",
          types: ["Regular (office / commercial)", "Hospitality", "Post-construction"],
          frequency: "Desired frequency",
          frequencyOptions: ["Daily", "Weekly (2-5×)", "Monthly", "One-off"],
          surface: "Surface area (m²)",
          start: "Preferred start date",
        },
        window: {
          tag: "02 — Window cleaning",
          title: "Window & façade cleaning",
          desc: "Streak-free clean glass inside and out — from street-level frontage to cherry pickers and gondolas. Tell us as much as possible about the building so we can quote you fairly straight away.",
          floors: "Number of floors",
          windows: "Number of windows (estimate)",
          height: "Highest window (metres)",
          access: "Access",
          accessOptions: ["From the ground", "Ladder", "Cherry picker", "Gondola / building lift"],
          sides: "Inside, outside or both?",
          sidesOptions: ["Outside only", "Inside only", "Inside + outside"],
          frequency: "Frequency",
          frequencyOptions: ["4× per year", "6× per year", "Monthly", "One-off"],
        },
        furniture: {
          tag: "03 — Floor & furniture care",
          title: "Floor & furniture cleaning",
          desc: "Deep cleaning and protection of fabric furniture, leather sofas, carpets and hard floors. We work with professional extraction equipment and pH-neutral products that protect the fibre.",
          itemType: "Type of furniture / floor",
          itemOptions: [
            "Fabric sofa / armchair",
            "Leather furniture",
            "Office chairs",
            "Carpet / floor covering",
            "Hard floor (PVC / linoleum)",
            "Marmoleum / natural stone",
            "Parquet",
            "Mattresses",
          ],
          pieces: "Number of items",
          material: "Material / fabric (if known)",
          stains: "Notable stains or odours",
          area: "Surface area (m²)",
        },
      },
    },
    jobs: {
      kicker: "Careers",
      title: "Work at McCoy",
      sub: "Due to our growth, McCoy is always looking for great people — both for cleaning and window cleaning. No experience? No problem. At McCoy we teach you the trade and find hours and days that suit you.\n\nSo you can always apply!",
      teamTitle: "More than just cleaning",
      teamText: "Did you know that besides cleaning, we also know how to play football? At McCoy we believe in strong team spirit — at work and beyond.",
      apply: "Apply now",
      formTitle: "Application form",
      formSub:
        "Fill in your details, upload your CV and letter of motivation. We respond within 5 working days — always personally.",
      role: "Role",
      motivation: "Short motivation",
      cv: "CV / Resume (PDF, DOC)",
      letter: "Letter of motivation (PDF, DOC)",
      cvPick: "Choose file",
      videoTitle: "Meet McCoy",
      videoSub:
        "A quick look behind the scenes — the people, the craft and the standard we deliver every single day.",
      submit: "Send application",
      success: "Thank you for applying! We reply within 5 working days.",
      roles: [
        {
          title: "Regular cleaning",
          desc: "For our recurring cleaning rounds at offices and businesses we are looking for people with an eye for detail.",
        },
        {
          title: "Window cleaner",
          desc: "Work in a tight team on window and façade cleaning. Experience is a plus, motivation a must.",
        },
        {
          title: "On-call staff",
          desc: "Flexible deployment for handovers and specialist projects — ideal if you like variety.",
        },
      ],
    },
    footer: {
      tagline: "At McCoy quality becomes visible.",
      rights: "All rights reserved.",
      terms: "Terms & conditions",
      privacy: "Privacy statement",
      certs: "Quality marks & certificates",
    },
  },
} as const;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict };
const I18nContext = createContext<Ctx | null>(null);

function persistLocalePreference(lang: Lang): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode / quota */
  }
  const secure =
    typeof window.location !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${UI_LOCALE_COOKIE}=${lang}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

/**
 * SSR: URL → cookie → Accept-Language → nl (via request headers).
 * Client CSR: URL → cookie → localStorage → nl.
 * Hydration reuses the SSR useState seed — never flip from storage after paint.
 *
 * Uses createIsomorphicFn so `@tanstack/react-start/server` stays out of the
 * client graph (no CommonJS `require` — ESM SSR has no `require`).
 */
export const resolveInitialUiLang = createIsomorphicFn()
  .server((): Lang =>
    resolveUiLangFromHints({
      pathname: getRequestUrl().pathname,
      cookieHeader: getRequestHeader("cookie"),
      acceptLanguage: getRequestHeader("accept-language"),
    }),
  )
  .client((): Lang => {
    let stored: Lang | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      stored = raw === "nl" || raw === "en" ? raw : null;
    } catch {
      stored = null;
    }
    return resolveUiLangFromHints({
      pathname: window.location.pathname,
      cookieHeader: document.cookie,
      acceptLanguage: null,
      fallbackLocale: stored,
    });
  });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => resolveInitialUiLang());

  // Write-through cookie + localStorage. Never flip lang after paint — SSR already
  // resolved URL / cookie / Accept-Language (legacy localStorage migrates via head script).
  useEffect(() => {
    persistLocalePreference(lang);
  }, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("translate", "no");
    document.documentElement.classList.add("notranslate");
    document.body?.setAttribute("translate", "no");
    document.body?.classList.add("notranslate");
    const metaName = "google";
    let meta = document.querySelector<HTMLMetaElement>(`meta[name="${metaName}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = metaName;
      document.head.appendChild(meta);
    }
    meta.content = "notranslate";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    persistLocalePreference(l);
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: translations[lang] as Dict }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// Context identity cannot survive Fast Refresh of this module (Provider +
// createContext share one file). Invalidate so importers remount together.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
