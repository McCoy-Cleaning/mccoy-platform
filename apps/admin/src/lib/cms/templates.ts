import {
  Layout,
  Type,
  AlignCenter,
  Columns3,
  CheckSquare,
  Quote,
  Grid3x3,
  Film,
  ArrowLeftRight,
  GalleryHorizontal,
  ListOrdered,
  Table2,
  Sparkles,
  Minus,
  Users,
  UserCircle,
  Star,
  Milestone,
  Megaphone,
  Bell,
  Briefcase,
  Newspaper,
  FolderKanban,
  Mail,
  MessageSquare,
  PanelTop,
} from "lucide-react";
import { assertPickerTypesMatchRegistry } from "@mccoy/cms-schema";
import type { BlockCategory, BlockType } from "./types";

export type TemplateDef = {
  type: BlockType;
  name: string;
  description: string;
  category: BlockCategory;
  icon: React.ComponentType<{ className?: string }>;
  defaultData: Record<string, any>;
};

export const TEMPLATES: TemplateDef[] = [
  {
    type: "hero",
    name: "Hero",
    description: "Grote intro-sectie met titel, subtitel, CTA en afbeelding.",
    category: "Hero & intro",
    icon: Layout,
    defaultData: {
      eyebrow: "McCoy Cleaning",
      title: "Een krachtige titel die aandacht trekt",
      subtitle: "Kort een sterke boodschap die uitlegt waarom bezoekers moeten blijven lezen.",
      ctaLabel: "Vraag offerte aan",
      ctaHref: "/offerte",
      image: "",
      align: "left",
    },
  },
  {
    type: "richText",
    name: "Rich text",
    description: "Kop, opgemaakte tekst, links, citaten en optionele knop.",
    category: "Content",
    icon: Type,
    defaultData: {
      title: "Vertel je verhaal",
      body: "Schrijf hier een langere paragraaf met achtergrond, uitleg of context. Klik om te bewerken.",
      ctaLabel: "",
      ctaHref: "",
    },
  },
  {
    type: "centered",
    name: "Gecentreerde tekst",
    description: "Titel, alinea en CTA in een smalle, gecentreerde layout.",
    category: "Content",
    icon: AlignCenter,
    defaultData: {
      title: "Klaar om te beginnen?",
      body: "Een korte, krachtige boodschap gecentreerd op de pagina.",
      ctaLabel: "Neem contact op",
      ctaHref: "/contact",
    },
  },
  {
    type: "textImage",
    name: "Tekst + afbeelding",
    description: "Tweekoloms sectie met tekst en een beeld ernaast.",
    category: "Content",
    icon: Columns3,
    defaultData: {
      title: "Waarom voor ons kiezen",
      body: "Beschrijf hier je aanpak, waarde of proces. Klik op de afbeelding om te vervangen.",
      image: "",
      reverse: false,
    },
  },
  {
    type: "columns",
    name: "Tekst kolommen",
    description: "Twee tot vier kolommen tekst voor diensten, waarden of uitleg.",
    category: "Content",
    icon: Columns3,
    defaultData: {
      title: "Onze pijlers",
      columns: [
        { title: "Kwaliteit", body: "Consistente resultaten door één vast team." },
        { title: "Snelheid", body: "Snelle reactie en flexibele planning." },
        { title: "Vertrouwen", body: "Transparant contact en heldere afspraken." },
      ],
    },
  },
  {
    type: "benefits",
    name: "Voordelen (checklist)",
    description: "Checklist-sectie gericht op klantvoordelen.",
    category: "Content",
    icon: CheckSquare,
    defaultData: {
      title: "Wat je krijgt",
      items: [
        "Snelle offerte binnen 24 uur",
        "Één vast contactpersoon",
        "Geen verrassingen achteraf",
        "Flexibele planning",
      ],
    },
  },
  {
    type: "quote",
    name: "Quote / testimonial",
    description: "Eén of meer testimonials met naam, functie, bedrijf en foto.",
    category: "Content",
    icon: Quote,
    defaultData: {
      items: [
        {
          id: "quote_1",
          quote: "Hun team werkt secuur, snel en betrouwbaar. Al jaren tevreden.",
          author: "Naam Klant",
          role: "Facility Manager",
          company: "Bedrijf B.V.",
        },
      ],
    },
  },
  {
    type: "gallery",
    name: "Werkgalerij",
    description: "Mozaïek zoals op de homepage — voeg zelf foto's met titel toe.",
    category: "Media",
    icon: Grid3x3,
    defaultData: {
      title: "Een blik op wat wij doen",
      eyebrow: "Ons werk",
      body: "Schoonmaak op het hoogste niveau voor bedrijven, horeca en specialistische projecten in Twente.",
      images: [] as string[],
      layout: "featured",
    },
  },
  {
    type: "video",
    name: "Video sectie",
    description: "Ingesloten video met titel, beschrijving en poster.",
    category: "Media",
    icon: Film,
    defaultData: {
      title: "Bekijk hoe wij werken",
      description: "Een korte video die onze aanpak laat zien.",
      videoUrl: "",
      poster: "",
    },
  },
  {
    type: "beforeAfter",
    name: "Voor & na",
    description: "Interactieve vergelijking tussen twee afbeeldingen.",
    category: "Media",
    icon: ArrowLeftRight,
    defaultData: { before: "", after: "", title: "Voor & na" },
  },
  {
    type: "carousel",
    name: "Carrousel",
    description: "Herbruikbare slide-gebaseerde sectie.",
    category: "Media",
    icon: GalleryHorizontal,
    defaultData: {
      slides: [
        { title: "Slide 1", body: "Beschrijving", image: "" },
        { title: "Slide 2", body: "Beschrijving", image: "" },
      ],
    },
  },
  {
    type: "steps",
    name: "Proces / stappen",
    description: "Drie tot zes genummerde stappen.",
    category: "Structure",
    icon: ListOrdered,
    defaultData: {
      title: "Hoe het werkt",
      steps: [
        { title: "Aanvraag", body: "Je vraagt vrijblijvend een offerte aan." },
        { title: "Kennismaking", body: "We bezoeken de locatie en bespreken wensen." },
        { title: "Uitvoering", body: "Ons team voert de werkzaamheden uit." },
        { title: "Nazorg", body: "Vaste contactpersoon en continue verbetering." },
      ],
    },
  },
  {
    type: "comparisonTable",
    name: "Vergelijkingstabel",
    description: "Vergelijk pakketten, producten of diensten.",
    category: "Structure",
    icon: Table2,
    defaultData: {
      title: "Kies je pakket",
      columns: ["Basis", "Standaard", "Premium"],
      rows: [
        { feature: "Wekelijkse schoonmaak", values: [true, true, true] },
        { feature: "Ramenwas", values: [false, true, true] },
        { feature: "Speciale aandacht sanitair", values: [false, false, true] },
      ],
    },
  },
  {
    type: "featureGrid",
    name: "Feature grid",
    description: "Icoon + titel + beschrijving cards.",
    category: "Structure",
    icon: Sparkles,
    defaultData: {
      title: "Onze sterke punten",
      features: [
        { icon: "sparkles", title: "Vakmanschap", body: "Getraind eigen team." },
        { icon: "shield", title: "Betrouwbaar", body: "Vaste gezichten, vaste kwaliteit." },
        { icon: "clock", title: "Flexibel", body: "Afgestemd op jouw agenda." },
        { icon: "leaf", title: "Duurzaam", body: "Verantwoorde middelen." },
      ],
    },
  },
  {
    type: "spacer",
    name: "Spacer / divider",
    description: "Instelbare ruimte of decoratieve scheider.",
    category: "Structure",
    icon: Minus,
    defaultData: { size: "md", divider: true },
  },
  {
    type: "teamGrid",
    name: "Team grid",
    description: "Foto, naam, rol, bio en socials.",
    category: "Team & about",
    icon: Users,
    defaultData: {
      title: "Ons team",
      members: [
        { name: "Naam", role: "Rol", bio: "Korte bio.", photo: "" },
        { name: "Naam", role: "Rol", bio: "Korte bio.", photo: "" },
        { name: "Naam", role: "Rol", bio: "Korte bio.", photo: "" },
      ],
    },
  },
  {
    type: "teamProfile",
    name: "Team profiel",
    description: "Grote biografie-layout met foto en contact.",
    category: "Team & about",
    icon: UserCircle,
    defaultData: {
      name: "Volledige naam",
      role: "Rol / functie",
      bio: "Uitgebreide biografie. Klik om te bewerken.",
      photo: "",
      email: "",
    },
  },
  {
    type: "values",
    name: "Waarden",
    description: "Icoon of card grid met bedrijfsprincipes.",
    category: "Team & about",
    icon: Star,
    defaultData: {
      title: "Onze waarden",
      values: [
        { title: "Eerlijk", body: "Duidelijk in verwachtingen." },
        { title: "Zorgvuldig", body: "Aandacht voor detail." },
        { title: "Verbonden", body: "Persoonlijk contact." },
      ],
    },
  },
  {
    type: "timeline",
    name: "Tijdlijn / historie",
    description: "Verticale lijst van mijlpalen en data.",
    category: "Team & about",
    icon: Milestone,
    defaultData: {},
  },
  {
    type: "roadmap",
    name: "Roadmap",
    description: "Mijlpalen met bewerkbare bullet points.",
    category: "Structure",
    icon: Milestone,
    defaultData: {},
  },
  {
    type: "plans",
    name: "Pakketten",
    description: "Prijsplannen met gedeelde kenmerken (✓ / ✗ per plan).",
    category: "Structure",
    icon: Table2,
    defaultData: {},
  },
  {
    type: "cta",
    name: "Call-to-action banner",
    description: "Volledige breedte prompt met knop.",
    category: "Conversion",
    icon: Megaphone,
    defaultData: {
      title: "Klaar om samen te werken?",
      body: "Vraag vandaag nog vrijblijvend een offerte aan.",
      ctaLabel: "Vraag offerte aan",
      ctaHref: "/offerte",
    },
  },
  {
    type: "announcement",
    name: "Announcement bar",
    description: "Korte boodschap met optionele link en sluitknop.",
    category: "Conversion",
    icon: Bell,
    defaultData: {
      message: "Nu ook actief in heel Twente — bekijk onze regio's.",
      linkLabel: "Meer",
      linkHref: "/services",
    },
  },
  {
    type: "newsletter",
    name: "Nieuwsbrief",
    description: "E-mailaanmelding met consent; opslag als website-aanvraag.",
    category: "Conversion",
    icon: Mail,
    defaultData: {},
  },
  {
    type: "contactForm",
    name: "Contactformulier",
    description: "Configureerbaar formulier via de bestaande Aanvragen-pijplijn.",
    category: "Conversion",
    icon: MessageSquare,
    defaultData: {},
  },
  {
    type: "popup",
    name: "Popup CTA",
    description:
      "Dismissible modal/banner; toont één keer per sessie of tot sluiten (per blok-id).",
    category: "Conversion",
    icon: PanelTop,
    defaultData: {},
  },
  {
    type: "portfolio",
    name: "Portfolio / projecten",
    description: "Projecten met categorieën, filters, beelden en links.",
    category: "Showcase",
    icon: FolderKanban,
    defaultData: {
      title: "Recente projecten",
      projects: [
        { title: "Project 1", category: "Kantoor", image: "" },
        { title: "Project 2", category: "Horeca", image: "" },
        { title: "Project 3", category: "Zorg", image: "" },
      ],
    },
  },
  {
    type: "jobs",
    name: "Vacatures",
    description: "Publiceer openstaande functies met details en een sollicitatieactie.",
    category: "Recruitment",
    icon: Briefcase,
    defaultData: {},
  },
  {
    type: "latestPosts",
    name: "Uitgelichte artikelen",
    description: "Handmatig beheerde artikelenkaarten (geen automatische feed).",
    category: "Showcase",
    icon: Newspaper,
    defaultData: {},
  },
];

export const CATEGORY_ORDER: BlockCategory[] = [
  "Hero & intro",
  "Content",
  "Media",
  "Structure",
  "Team & about",
  "Conversion",
  "Showcase",
  "Recruitment",
];

/** Block types that visually match live storefront section patterns. */
export const PAGE_PARITY_BLOCK_TYPES: BlockType[] = [
  "hero",
  "textImage",
  "richText",
  "centered",
  "columns",
  "benefits",
  "gallery",
  "featureGrid",
  "cta",
  "roadmap",
  "plans",
  "timeline",
  "jobs",
  "teamGrid",
  "quote",
];

export function getTemplate(type: BlockType): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.type === type);
}

assertPickerTypesMatchRegistry(TEMPLATES.map((t) => t.type));
