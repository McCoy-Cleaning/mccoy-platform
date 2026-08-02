import { z } from "zod";
import { cmsLinkSchema } from "./links";
import type { CmsLink } from "./types";
import type { FixedSectionKey } from "./sections";
import { defaultPartnerCmsItems, defaultPartnerResolvedBackdrop, getPartnerBackdropOverride } from "./default-partners";
import {
  isPlateCssColor,
  LOGO_BACKDROP_BLACK,
  LOGO_BACKDROP_WHITE,
  normalizeLogoBackdropColor,
  type LogoBackdropPreference,
  type LogoBackdropResolved,
} from "./infer-logo-backdrop";
import type { FormScopeSnapshot } from "./form-scope";
import { formScopeSnapshotSchema, normalizeFormScopeSnapshot } from "./form-scope";
import { defaultPrivacyMainContent, defaultTermsMainContent } from "./legal-defaults";

export type CmsImage = {
  assetId: string;
  src: string;
  alt: string;
  decorative: boolean;
  width?: number;
  height?: number;
  focalPoint?: { x: number; y: number };
};

export type CmsButton = {
  label: string;
  link: CmsLink;
};

export type IdItem = { id: string };

export type StatItem = IdItem & { value: string; label: string };
export type PartnerItem = IdItem & {
  name: string;
  image: CmsImage;
  /** Editor preference; `auto` uses {@link resolvedBackdrop}. Default `auto`. */
  logoBackdrop?: LogoBackdropPreference;
  /** Cached logo-box CSS color (`#rrggbb`) from plate strip or white default. */
  resolvedBackdrop?: LogoBackdropResolved;
};
export type GalleryItem = IdItem & {
  title: string;
  image: CmsImage;
  caption?: string;
  /** Featured mosaic tile shape — omit to keep classic Ons-werk spans. */
  shape?: "wide" | "square" | "tall";
};
export type ServiceCard = IdItem & {
  title: string;
  description: string;
  image: CmsImage;
  link?: CmsLink;
};
export type ProductCard = IdItem & {
  title: string;
  description: string;
  /** Optional legacy field — Producten-info renders icons, not photos. */
  image?: CmsImage;
  link?: CmsLink;
};

export type HomeHeroContent = {
  eyebrow?: string;
  heading: string;
  headingAccent?: string;
  body: string;
  /** Optional — cleared via null patch in Secties. */
  image?: CmsImage;
  primaryCta?: CmsButton;
  secondaryCta?: CmsButton;
};

export type PartnersContent = {
  eyebrow?: string;
  heading: string;
  items: PartnerItem[];
};

export type StatsContent = {
  eyebrow?: string;
  heading?: string;
  body?: string;
  items: StatItem[];
};

export type WorkGalleryContent = {
  eyebrow?: string;
  heading: string;
  body?: string;
  items: GalleryItem[];
};

export type AboutMainContent = {
  eyebrow?: string;
  heading: string;
  missionTitle?: string;
  missionBody?: string;
  visionTitle?: string;
  visionBody?: string;
  historyTitle?: string;
  historyBody?: string;
  /** @deprecated Prefer missionImage — kept for older drafts. */
  image?: CmsImage;
  missionImage?: CmsImage;
  visionImage?: CmsImage;
  historyImage?: CmsImage;
};

export type ServicesMainContent = {
  eyebrow?: string;
  heading: string;
  intro: string;
  cards: ServiceCard[];
};

export type ProductsMainContent = {
  eyebrow?: string;
  heading: string;
  /** Primary section body copy under the title. */
  intro: string;
  /** Extra callout under the CTAs (e.g. webshop coming-soon notice). */
  body?: string;
  /** Flyer / promo image shown beside intro copy, CTAs, and note. */
  image?: CmsImage;
};

/** Assortment section: title + intro text + icon cards (no photos). */
export type ProductsInfoContent = {
  eyebrow?: string;
  /** May be empty when cleared in the editor. */
  heading: string;
  intro?: string;
  cards: ProductCard[];
};

export type FormPageChromeContent = {
  eyebrow?: string;
  heading: string;
  body?: string;
  image?: CmsImage;
};

/** Vacatures page chrome + optional application-form scope. */
export type VacaturesMainContent = FormPageChromeContent & {
  applicationScope?: FormScopeSnapshot;
};

export type ContactInfoIcon = "mail" | "phone" | "map" | "clock";

export type ContactInfoItem = {
  id: string;
  icon: ContactInfoIcon;
  label: string;
  value: string;
  /** Optional mailto:/tel:/https link for the card. */
  href?: string;
};

export type ContactInfoContent = {
  items: ContactInfoItem[];
};

/** Default intro beside the contact form (NL) when CMS `body` is unset. */
export const DEFAULT_CONTACT_FORM_INTRO_NL =
  "Vul het formulier in. Uw aanvraag wordt opgeslagen en per e-mail doorgestuurd naar info@mccoy.nl.";

/**
 * App-controlled inquiry / offerte forms; section exists so it can be hidden (not deleted).
 * Contact uses `scope`; offerte uses `glassScope` / `furnitureScope`.
 */
export type ContactFormContent = {
  heading?: string;
  /** Plain-text intro beside the form (left column). */
  body?: string;
  scope?: FormScopeSnapshot;
  glassScope?: FormScopeSnapshot;
  furnitureScope?: FormScopeSnapshot;
};

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

export type SectionContentMap = {
  "home.hero": HomeHeroContent;
  "home.partners": PartnersContent;
  "home.stats": StatsContent;
  "home.workGallery": WorkGalleryContent;
  "about.main": AboutMainContent;
  "services.main": ServicesMainContent;
  "products.main": ProductsMainContent;
  "products.info": ProductsInfoContent;
  "contact.main": FormPageChromeContent;
  "contact.info": ContactInfoContent;
  "contact.form": ContactFormContent;
  "vacatures.main": VacaturesMainContent;
  "offerte.main": FormPageChromeContent;
  "offerte.info": ContactInfoContent;
  "offerte.form": ContactFormContent;
  "privacy.main": LegalMainContent;
  "terms.main": LegalMainContent;
};

export type PageSectionContent = Partial<{
  [K in FixedSectionKey]: SectionContentMap[K];
}>;

function newId(prefix = "item"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createItemId(prefix = "item"): string {
  return newId(prefix);
}

function defaultProductCards(): ProductCard[] {
  return [
    {
      id: "prod_hygiene",
      title: "Hygiëne papier",
      description: "Professioneel hygiënepapier voor sanitair, keukens en bedrijfspanden.",
      link: { type: "internal_route", route: "contact" },
    },
    {
      id: "prod_soaps",
      title: "Professionele zepen",
      description: "Hoogwaardige zepen en dispensers voor een frisse, representatieve sanitaire ruimte.",
      link: { type: "internal_route", route: "contact" },
    },
    {
      id: "prod_agents",
      title: "Reinigingsmiddelen & hardware",
      description: "Reinigingsmiddelen voor horeca plus apparatuur en hardware om schoon te maken.",
      link: { type: "internal_route", route: "contact" },
    },
  ];
}

export const cmsImageSchema: z.ZodType<CmsImage> = z.object({
  assetId: z.string().min(1),
  src: z.string().min(1),
  alt: z.string(),
  decorative: z.boolean(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  focalPoint: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
});

export const cmsButtonSchema: z.ZodType<CmsButton> = z.object({
  label: z.string().min(1),
  link: cmsLinkSchema,
});

const statItemSchema = z.object({
  id: z.string().min(1),
  value: z.string(),
  label: z.string(),
});

const logoBackdropPreferenceSchema = z.enum(["auto", "light", "dark", "white", "black"]);
/** Plate/CSS hex, or legacy light|dark tokens (normalized on migrate). */
const logoBackdropResolvedSchema = z.string().min(1);

const partnerItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  image: cmsImageSchema,
  logoBackdrop: logoBackdropPreferenceSchema.optional(),
  resolvedBackdrop: logoBackdropResolvedSchema.optional(),
});

const galleryItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  image: cmsImageSchema,
  caption: z.string().optional(),
  shape: z.enum(["wide", "square", "tall"]).optional(),
});

const serviceCardSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  image: cmsImageSchema,
  link: cmsLinkSchema.optional(),
});

const productCardSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  image: cmsImageSchema.optional(),
  link: cmsLinkSchema.optional(),
});

export const homeHeroContentSchema: z.ZodType<HomeHeroContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  headingAccent: z.string().optional(),
  body: z.string(),
  image: cmsImageSchema.optional(),
  primaryCta: cmsButtonSchema.optional(),
  secondaryCta: cmsButtonSchema.optional(),
});

export const partnersContentSchema: z.ZodType<PartnersContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  items: z.array(partnerItemSchema),
});

export const statsContentSchema: z.ZodType<StatsContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  body: z.string().optional(),
  items: z.array(statItemSchema),
});

export const workGalleryContentSchema: z.ZodType<WorkGalleryContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  body: z.string().optional(),
  items: z.array(galleryItemSchema),
});

export const aboutMainContentSchema: z.ZodType<AboutMainContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  missionTitle: z.string().optional(),
  missionBody: z.string().optional(),
  visionTitle: z.string().optional(),
  visionBody: z.string().optional(),
  historyTitle: z.string().optional(),
  historyBody: z.string().optional(),
  image: cmsImageSchema.optional(),
  missionImage: cmsImageSchema.optional(),
  visionImage: cmsImageSchema.optional(),
  historyImage: cmsImageSchema.optional(),
});

export const servicesMainContentSchema: z.ZodType<ServicesMainContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  intro: z.string(),
  cards: z.array(serviceCardSchema),
});

export const productsMainContentSchema: z.ZodType<ProductsMainContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  intro: z.string(),
  body: z.string().optional(),
  image: cmsImageSchema.optional(),
});

export const productsInfoContentSchema: z.ZodType<ProductsInfoContent> = z.object({
  eyebrow: z.string().optional(),
  /** Empty string is allowed — editors may clear the title on purpose. */
  heading: z.string(),
  intro: z.string().optional(),
  cards: z.array(productCardSchema),
});

export const formPageChromeContentSchema: z.ZodType<FormPageChromeContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  body: z.string().optional(),
  image: cmsImageSchema.optional(),
});

export const vacaturesMainContentSchema: z.ZodType<VacaturesMainContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  body: z.string().optional(),
  image: cmsImageSchema.optional(),
  applicationScope: formScopeSnapshotSchema.optional(),
});

const contactInfoIconSchema = z.enum(["mail", "phone", "map", "clock"]);

const contactInfoItemSchema = z.object({
  id: z.string().min(1),
  icon: contactInfoIconSchema,
  label: z.string(),
  value: z.string(),
  href: z.string().optional(),
});

export const contactInfoContentSchema: z.ZodType<ContactInfoContent> = z.object({
  items: z.array(contactInfoItemSchema),
});

export const contactFormContentSchema: z.ZodType<ContactFormContent> = z.object({
  heading: z.string().optional(),
  body: z.string().optional(),
  scope: formScopeSnapshotSchema.optional(),
  glassScope: formScopeSnapshotSchema.optional(),
  furnitureScope: formScopeSnapshotSchema.optional(),
});

export const legalArticleSchema: z.ZodType<LegalArticle> = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
});

export const legalMainContentSchema: z.ZodType<LegalMainContent> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string(),
  updatedLabel: z.string().optional(),
  articles: z.array(legalArticleSchema),
});

export const SECTION_CONTENT_SCHEMAS: {
  [K in FixedSectionKey]: z.ZodType<SectionContentMap[K]>;
} = {
  "home.hero": homeHeroContentSchema,
  "home.partners": partnersContentSchema,
  "home.stats": statsContentSchema,
  "home.workGallery": workGalleryContentSchema,
  "about.main": aboutMainContentSchema,
  "services.main": servicesMainContentSchema,
  "products.main": productsMainContentSchema,
  "products.info": productsInfoContentSchema,
  "contact.main": formPageChromeContentSchema,
  "contact.info": contactInfoContentSchema,
  "contact.form": contactFormContentSchema,
  "vacatures.main": vacaturesMainContentSchema,
  "offerte.main": formPageChromeContentSchema,
  "offerte.info": contactInfoContentSchema,
  "offerte.form": contactFormContentSchema,
  "privacy.main": legalMainContentSchema,
  "terms.main": legalMainContentSchema,
};

export function localImage(path: string, alt: string, decorative = false): CmsImage {
  return {
    assetId: `local:${path.replace(/^\//, "")}`,
    src: path.startsWith("/") || path.startsWith("http") ? path : `/${path}`,
    alt,
    decorative,
  };
}

export function externalImage(url: string, alt: string): CmsImage | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"))) {
      return null;
    }
  } catch {
    return null;
  }
  const hash = url.length.toString(36);
  return {
    assetId: `external:${hash}`,
    src: url,
    alt,
    decorative: false,
  };
}

/** Prototype CMS upload — data-URL embedded in content (legacy read-path only). Prefer Storage. */
export function uploadedImage(dataUrl: string, alt: string, uploadId?: string): CmsImage | null {
  const trimmed = dataUrl.trim();
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) return null;
  const id = uploadId?.trim() || newId("upload");
  return {
    assetId: `upload:${id}`,
    src: trimmed,
    alt,
    decorative: false,
  };
}

export function isUploadedCmsImage(image: Pick<CmsImage, "assetId" | "src">): boolean {
  return image.assetId.startsWith("upload:") || /^data:image\//i.test(image.src);
}

export function isStorageCmsImage(image: Pick<CmsImage, "assetId">): boolean {
  return image.assetId.startsWith("storage:");
}

export function isLegacyEmbeddedCmsImage(image: Pick<CmsImage, "assetId" | "src">): boolean {
  return isUploadedCmsImage(image);
}

/** Build CmsImage from a Storage catalog asset (src is a rendering snapshot). */
export function storageImage(
  opts: {
    assetId: string;
    publicUrl: string;
    alt?: string;
    decorative?: boolean;
    width?: number;
    height?: number;
  },
): CmsImage {
  const id = opts.assetId.startsWith("storage:") ? opts.assetId : `storage:${opts.assetId}`;
  const decorative = opts.decorative === true;
  return {
    assetId: id,
    src: opts.publicUrl,
    alt: decorative ? "" : (opts.alt ?? ""),
    decorative,
    width: opts.width,
    height: opts.height,
  };
}

/** Walk a value tree and collect legacy embedded images. */
export function collectLegacyEmbeddedImages(value: unknown): CmsImage[] {
  const found: CmsImage[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const rec = node as Record<string, unknown>;
    if (
      typeof rec.assetId === "string" &&
      typeof rec.src === "string" &&
      typeof rec.alt === "string" &&
      typeof rec.decorative === "boolean"
    ) {
      const img = rec as unknown as CmsImage;
      if (isLegacyEmbeddedCmsImage(img)) found.push(img);
    }
    for (const v of Object.values(rec)) visit(v);
  };
  visit(value);
  return found;
}

/** Replace matching legacy images in a deep clone of value. */
export function replaceCmsImagesInTree(
  value: unknown,
  replace: (image: CmsImage) => CmsImage | null,
): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => replaceCmsImagesInTree(item, replace));
  }
  const rec = value as Record<string, unknown>;
  if (
    typeof rec.assetId === "string" &&
    typeof rec.src === "string" &&
    typeof rec.alt === "string" &&
    typeof rec.decorative === "boolean"
  ) {
    const img = rec as unknown as CmsImage;
    const next = replace(img);
    if (next) return { ...next };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = replaceCmsImagesInTree(v, replace);
  }
  return out;
}

export function defaultSectionContent(key: FixedSectionKey): SectionContentMap[FixedSectionKey] {
  switch (key) {
    case "home.hero":
      // Match the legacy original: i18n copy, secondary CTA only (quote CTA lives in navbar).
      return {
        eyebrow: "Live Clean",
        heading: "Bij McCoy wordt kwaliteit",
        headingAccent: "zichtbaar.",
        body: "Al meer dan 25 jaar staan wij voor schoonmaak met karakter — uitgevoerd door een vast eigen team, met professionele middelen en een onmiskenbaar oog voor detail. Geen onderaannemers, geen losse krachten: alleen vakmensen die uw pand behandelen alsof het hun eigen pand is.",
        image: localImage("/images/cms/hero-cleaning.jpg", "McCoy Cleaning professional at work"),
        secondaryCta: {
          label: "Bekijk onze diensten",
          link: { type: "internal_route", route: "services" },
        },
      } satisfies HomeHeroContent;
    case "home.partners":
      return {
        eyebrow: "Onze klanten",
        heading: "Klanten waar wij voor werken",
        items: defaultPartnerCmsItems(),
      } satisfies PartnersContent;
    case "home.stats":
      return {
        eyebrow: "Kwaliteit boven alles",
        // Omit heading so the storefront can render the accented i18n title
        // ("Meer dan 25 jaar expertise…") until an editor explicitly sets one.
        body:
          "Wij geloven dat schoonmaak een vak is — geen bijzaak. Daarom investeren wij in mensen, training en de juiste apparatuur. Het resultaat: een pand dat structureel schoner oogt, langer mooi blijft en bezoekers direct het verschil laat voelen vanaf de drempel.",
        items: [
          { id: "stat_years", value: "25+", label: "Jaar ervaring" },
          { id: "stat_team", value: "100%", label: "Vast eigen team" },
          { id: "stat_clients", value: "160+", label: "Tevreden klanten" },
        ],
      } satisfies StatsContent;
    case "home.workGallery":
      return {
        eyebrow: "Ons werk",
        heading: "Een blik op wat wij doen",
        body: "Schoonmaak op het hoogste niveau voor bedrijven, horeca en specialistische projecten in Twente.",
        items: [
          {
            id: "gallery_regular",
            title: "Reguliere schoonmaak",
            image: localImage("/images/cms/work-regular.jpg", "Reguliere schoonmaak"),
          },
          {
            id: "gallery_horeca",
            title: "Horeca schoonmaak",
            image: localImage("/images/cms/work-horeca.jpg", "Horeca schoonmaak"),
          },
          {
            id: "gallery_oplevering",
            title: "Opleveringsschoonmaak",
            image: localImage("/images/cms/work-oplevering.jpg", "Opleveringsschoonmaak"),
          },
          {
            id: "gallery_floor",
            title: "Vloeronderhoud",
            image: localImage("/images/cms/work-floor.jpg", "Vloeronderhoud"),
          },
          {
            // Original Sections.tsx gallery slot 5 used about-vision (not furniture).
            id: "gallery_furniture",
            title: "Meubelreiniging",
            image: localImage("/images/cms/about-vision-alt.png", "Meubelreiniging"),
          },
          {
            id: "gallery_glass",
            title: "Glasbewassing & Buitenreiniging",
            image: localImage("/images/cms/work-glass.jpg", "Glasbewassing & Buitenreiniging"),
          },
        ],
      } satisfies WorkGalleryContent;
    case "about.main":
      return {
        eyebrow: "Over ons",
        heading: "Kwaliteit, missie & visie",
        missionTitle: "Missie",
        missionBody:
          "McCoy heeft als missie het leveren van schoonmaakdiensten van het hoogste kwaliteitsniveau voor organisaties waar hygiëne en uitstraling van cruciaal belang zijn.\n\nWij realiseren schone, veilige en representatieve leef- en werkomgevingen door te werken met maximale precisie, professionele middelen en goed opgeleide vakmensen. Daarbij streven wij continu naar een subliem eindresultaat, waarbij geen detail over het hoofd wordt gezien.\n\nMcCoy onderscheidt zich door een compromisloze focus op kwaliteit: wij leveren geen standaard schoonmaak, maar een zichtbaar hoger niveau van dienstverlening.",
        visionTitle: "Visie",
        visionBody:
          "McCoy heeft de ambitie om uit te groeien tot het toonaangevende schoonmaakbedrijf in de regio voor opdrachtgevers die uitsluitend genoegen nemen met de hoogste kwaliteit.\n\nDe organisatie richt zich specifiek op sectoren waarin hygiëne een essentiële rol speelt, zoals tandartspraktijken, de medische sector en hoogwaardige bedrijfslocaties. Daarnaast richt McCoy zich op omvangrijke en specialistische schoonmaakprojecten, zoals het opleveren van bedrijfspanden en woningen, specialistische dieptereiniging van sanitair en keukens en gespecialiseerd vloeronderhoud.\n\nMcCoy is een partner die de klant wil ontzorgen door middel van schoonmaak, glasbewassing en facilitaire producten die zorgen voor een frisse en professionele uitstraling.\n\nBinnen de strategie van McCoy staat kwaliteit structureel boven prijs. Dit houdt in dat er bewust meer tijd, aandacht en expertise wordt ingezet om een optimaal eindresultaat te realiseren. De klant neemt een centrale positie in: wij streven naar duurzame samenwerkingen en het consequent overtreffen van verwachtingen.",
        historyTitle: "Historie",
        historyBody:
          "McCoy is officieel opgericht op 1 april 1998. De oprichter en eigenaar, Sander Kroese, was destijds 24 jaar oud en werkzaam bij een schoonmaakbedrijf in Delden. Al op jonge leeftijd ontwikkelde hij een sterke affiniteit met schoonmaakwerkzaamheden. Zo hield hij zich in zijn jeugd onder andere bezig met het grondig reinigen van auto's en ondersteunde hij in het ouderlijk huis structureel bij huishoudelijke schoonmaaktaken.\n\nHet idee voor McCoy is ontstaan tijdens een informele gelegenheid in de horeca. In de beginfase richtte het bedrijf zich met name op schoonmaakdiensten voor diverse horecagelegenheden in Oldenzaal. De naam 'McCoy' is bewust gekozen vanwege de betekenis en connotatie. Hoewel het een veelvoorkomende achternaam is in Schotland, verwijst de uitdrukking \"The real McCoy\" naar authenticiteit en kwaliteit, oftewel: het leveren van het beste en het échte werk. Deze waarden vormen de kern van de bedrijfsvisie van de oprichter.",
        missionImage: localImage("/images/cms/about-mission.png", "Missie — voor en na"),
        visionImage: localImage("/images/cms/about-vision.jpg", "Visie"),
        historyImage: localImage("/images/cms/about-history.jpg", "Historie"),
      } satisfies AboutMainContent;
    case "services.main":
      return {
        eyebrow: "Diensten",
        heading: "Ons aanbod",
        intro: "Een volledig schoonmaakaanbod door één vast eigen team in Twente.",
        cards: [
          {
            id: "svc_regular",
            title: "Reguliere schoonmaak",
            description:
              "Een schone werkomgeving is belangrijk voor zowel medewerkers als bezoekers. Bij McCoy Cleaning verzorgen wij professionele reguliere schoonmaak voor bedrijven, kantoren, winkels, praktijken en bedrijfspanden in en rondom Twente.",
            image: localImage("/images/cms/work-regular-sander.png", "Reguliere schoonmaak"),
            link: { type: "internal_route", route: "contact" },
          },
          {
            id: "svc_horeca",
            title: "Horeca schoonmaak",
            description:
              "In de horeca draait alles om beleving, uitstraling en hygiëne. Wij verzorgen professionele horeca schoonmaak voor restaurants, cafés, hotels en lunchrooms in en rondom Twente.",
            image: localImage("/images/cms/work-horeca.jpg", "Horeca schoonmaak"),
            link: { type: "internal_route", route: "contact" },
          },
          {
            id: "svc_oplevering",
            title: "Opleveringsschoonmaak",
            description:
              "Na een verbouwing of renovatie blijft vaak veel stof en bouwafval achter. McCoy Cleaning verzorgt professionele opleveringsschoonmaak voor woningen, kantoren, winkels en bedrijfspanden in en rondom Twente.",
            image: localImage("/images/cms/work-oplevering-hal.png", "Opleveringsschoonmaak"),
            link: { type: "internal_route", route: "contact" },
          },
          {
            id: "svc_floor",
            title: "Vloeronderhoud",
            description:
              "Vloeren bepalen voor een groot deel de uitstraling van een ruimte. Met professioneel vloeronderhoud van McCoy Cleaning blijven jouw vloeren schoon, verzorgd en langer in topconditie.",
            image: localImage("/images/cms/work-floor-scrubber.jpg", "Vloeronderhoud"),
            link: { type: "internal_route", route: "contact" },
          },
          {
            id: "svc_furniture",
            title: "Meubelreiniging",
            description:
              "Stoffen meubels, leren banken en stoelen verdienen specialistische zorg. Met professionele extractie en pH-neutrale producten reinigen wij grondig zonder de vezels te beschadigen.",
            image: localImage("/images/cms/work-furniture-bank.jpg", "Meubelreiniging"),
            link: { type: "internal_route", route: "offerte" },
          },
          {
            id: "svc_glass",
            title: "Glasbewassing & Buitenreiniging",
            description:
              "De buitenkant van een pand bepaalt de eerste indruk. Schone ramen, een verzorgde gevel en een nette entree dragen direct bij aan een professionele en betrouwbare uitstraling.",
            image: localImage("/images/cms/work-glass-van.jpg", "Glasbewassing & Buitenreiniging"),
            link: { type: "internal_route", route: "offerte" },
          },
        ],
      } satisfies ServicesMainContent;
    case "products.main":
      return {
        eyebrow: "Producten",
        heading: "Geurproducten met een premium sanitaire beleving.",
        intro:
          "Een belangrijk onderdeel van McCoy Cleaning is McCoy Products, onze groothandel. In ons assortiment vind je: hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en apparatuur en hardware om schoon te maken.\n\nVoor het verkrijgen van onze producten kunt u bellen of contact op nemen via het contactformulier, we helpen u dan graag.",
        body: "We zijn momenteel druk achter de schermen met de online webshop! Deze volgt binnenkort.",
        image: localImage("/images/cms/products-flyer.png", "McCoy Cleaning Products flyer"),
      } satisfies ProductsMainContent;
    case "products.info":
      return {
        eyebrow: "Ons assortiment",
        heading: "McCoy Cleaning Products",
        intro: "Hygiënepapier, professionele zepen, reinigingsmiddelen en hardware voor een frisse, representatieve omgeving.",
        cards: defaultProductCards(),
      } satisfies ProductsInfoContent;
    case "contact.main":
      return {
        eyebrow: "Contact",
        heading: "Neem contact op",
        body: "Wij denken graag met u mee.",
      } satisfies FormPageChromeContent;
    case "contact.info":
      return {
        items: [
          {
            id: "contact_email",
            icon: "mail",
            label: "E-mail",
            value: "info@mccoy.nl",
            href: "mailto:info@mccoy.nl",
          },
          {
            id: "contact_phone",
            icon: "phone",
            label: "Telefoon",
            value: "0541 534 982",
            href: "tel:+31541534982",
          },
          {
            id: "contact_address",
            icon: "map",
            label: "Adres",
            value: "Nijverheidsstraat 63\n7575 BH Oldenzaal",
          },
          {
            id: "contact_hours",
            icon: "clock",
            label: "Kantooruren",
            value: "Maandag t/m vrijdag 08:30 – 17:00",
          },
        ],
      } satisfies ContactInfoContent;
    case "contact.form":
      return {} satisfies ContactFormContent;
    case "vacatures.main":
      return {
        eyebrow: "Vacatures",
        heading: "Werken bij McCoy",
        body: "Word onderdeel van ons vaste team.",
      } satisfies VacaturesMainContent;
    case "offerte.main":
      return {
        eyebrow: "Offerte",
        heading: "Vraag een offerte aan",
        body: "Vertel ons wat u nodig heeft.",
      } satisfies FormPageChromeContent;
    case "offerte.info":
      return {
        items: [
          {
            id: "offerte_email",
            icon: "mail",
            label: "E-mail",
            value: "info@mccoy.nl",
            href: "mailto:info@mccoy.nl",
          },
          {
            id: "offerte_phone",
            icon: "phone",
            label: "Telefoon",
            value: "0541 534 982",
            href: "tel:+31541534982",
          },
          {
            id: "offerte_address",
            icon: "map",
            label: "Adres",
            value: "Nijverheidsstraat 63\n7575 BH Oldenzaal",
          },
          {
            id: "offerte_hours",
            icon: "clock",
            label: "Kantooruren",
            value: "Maandag t/m vrijdag 08:30 – 17:00",
          },
        ],
      } satisfies ContactInfoContent;
    case "offerte.form":
      return {} satisfies ContactFormContent;
    case "privacy.main":
      return defaultPrivacyMainContent();
    case "terms.main":
      return defaultTermsMainContent();
  }
}

export function parseSectionContent<K extends FixedSectionKey>(
  key: K,
  raw: unknown,
): SectionContentMap[K] | null {
  const result = SECTION_CONTENT_SCHEMAS[key].safeParse(raw);
  return result.success ? (result.data as SectionContentMap[K]) : null;
}

export function validatePageSectionContent(content: PageSectionContent | undefined): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!content) return { ok: true, issues };
  for (const [key, value] of Object.entries(content)) {
    if (!Object.prototype.hasOwnProperty.call(SECTION_CONTENT_SCHEMAS, key)) {
      issues.push(`Unknown section key: ${key}`);
      continue;
    }
    const k = key as FixedSectionKey;
    const parsed = SECTION_CONTENT_SCHEMAS[k].safeParse(value);
    if (!parsed.success) {
      issues.push(`Invalid content for ${key}: ${parsed.error.message}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

/**
 * Deep-merge section patch; arrays (cards/items) replace wholesale when provided.
 * Pass `null` to delete an optional field (e.g. remove a CTA). `undefined` is ignored.
 */
export function mergeSectionPatch<T extends Record<string, unknown>>(
  base: T,
  patch: Partial<{ [K in keyof T]: T[K] | null }>,
): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) {
      delete out[k];
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v;
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] && !Array.isArray(out[k])) {
      out[k] = mergeSectionPatch(out[k] as Record<string, unknown>, v as Record<string, unknown>);
      continue;
    }
    out[k] = v;
  }
  return out as T;
}

const LEGACY_PROTOTYPE_HERO_SHORT_BODY =
  "Al meer dan 25 jaar staan wij voor schoonmaak met karakter — uitgevoerd door een vast eigen team.";

/**
 * Prototype hero that shipped with SEO eyebrow, split accent, short body, and an
 * Offerte primary CTA that the original never rendered in the hero.
 */
export function isLegacyPrototypeHero(content: HomeHeroContent): boolean {
  if (content.body === LEGACY_PROTOTYPE_HERO_SHORT_BODY) return true;
  if (
    content.eyebrow === "Schoonmaakbedrijf Twente" &&
    content.headingAccent === "kwaliteit zichtbaar."
  ) {
    return true;
  }
  if (
    content.primaryCta?.label === "Offerte aanvragen" &&
    content.heading === "Bij McCoy wordt" &&
    content.headingAccent === "kwaliteit zichtbaar."
  ) {
    return true;
  }
  return false;
}

/**
 * Replace known-bad prototype hero with the original-matching defaults.
 * Preserves a custom image when the rest of the copy is prototype-only.
 */
export function migrateLegacyHeroContent(existing?: HomeHeroContent): HomeHeroContent {
  const def = defaultSectionContent("home.hero") as HomeHeroContent;
  let next: HomeHeroContent;
  if (!existing || isLegacyPrototypeHero(existing)) {
    if (existing?.image && !existing.image.src.includes("placeholder")) {
      next = { ...def, image: existing.image };
    } else {
      next = def;
    }
  } else {
    next = existing;
  }
  return migrateOriginalHeroImage(next);
}

/**
 * Truncated 3-tile prototype gallery — the homepage shows all six work tiles.
 */
export function isLegacyPrototypeWorkGallery(content: WorkGalleryContent): boolean {
  if (content.items.length !== 3) return false;
  const ids = content.items.map((i) => i.id).sort().join(",");
  return ids === "gallery_horeca,gallery_oplevering,gallery_regular";
}

export function migrateLegacyWorkGalleryContent(
  existing?: WorkGalleryContent,
): WorkGalleryContent {
  const def = defaultSectionContent("home.workGallery") as WorkGalleryContent;
  if (!existing || isLegacyPrototypeWorkGallery(existing)) return def;
  return migrateOriginalWorkGalleryImages(existing);
}

/**
 * Remap known incorrect *local* default CMS image paths to the original
 * Sections.tsx assignment. Does **not** rewrite Supabase Storage URLs —
 * published `storage:` / cms-media URLs remain the durable source of truth.
 * Custom editor uploads are left alone.
 */
const ORIGINAL_SERVICE_IMAGE_BY_ID: Record<string, string> = {
  svc_regular: "/images/cms/work-regular-sander.png",
  svc_horeca: "/images/cms/work-horeca.jpg",
  svc_oplevering: "/images/cms/work-oplevering-hal.png",
  svc_floor: "/images/cms/work-floor-scrubber.jpg",
  svc_furniture: "/images/cms/work-furniture-bank.jpg",
  svc_glass: "/images/cms/work-glass-van.jpg",
};

const ORIGINAL_GALLERY_IMAGE_BY_ID: Record<string, string> = {
  gallery_regular: "/images/cms/work-regular.jpg",
  gallery_horeca: "/images/cms/work-horeca.jpg",
  gallery_oplevering: "/images/cms/work-oplevering.jpg",
  gallery_floor: "/images/cms/work-floor.jpg",
  gallery_furniture: "/images/cms/about-vision-alt.png",
  gallery_glass: "/images/cms/work-glass.jpg",
};

const ORIGINAL_HERO_IMAGE_SRC = "/images/cms/hero-cleaning.jpg";

/** Generic local paths that were incorrectly used as service-card defaults. */
const LEGACY_GENERIC_SERVICE_SRCS = new Set([
  "/images/cms/work-regular.jpg",
  "/images/cms/work-regular.webp",
  "/images/cms/work-oplevering.jpg",
  "/images/cms/work-oplevering.webp",
  "/images/cms/work-floor.jpg",
  "/images/cms/work-floor.webp",
  "/images/cms/work-glass.jpg",
  "/images/cms/work-glass.webp",
]);

function isLocalPublicImageSrc(src: string): boolean {
  return src.startsWith("/images/") && !src.includes("://");
}

function isRemappableLegacyLocalSrc(src: string): boolean {
  return src.includes("placeholder") || LEGACY_GENERIC_SERVICE_SRCS.has(src);
}

function remapCmsImageSrc(image: CmsImage, nextSrc: string): CmsImage {
  if (image.src === nextSrc) return image;
  return {
    ...image,
    src: nextSrc,
    assetId: `local:${nextSrc.replace(/^\//, "")}`,
  };
}

export function migrateOriginalHeroImage(content: HomeHeroContent): HomeHeroContent {
  const src = content.image?.src ?? "";
  if (!src || src === ORIGINAL_HERO_IMAGE_SRC) return content;
  // Only rewrite local placeholders — never pull Supabase URLs back to /images.
  if (isLocalPublicImageSrc(src) && src.includes("placeholder")) {
    return { ...content, image: remapCmsImageSrc(content.image!, ORIGINAL_HERO_IMAGE_SRC) };
  }
  return content;
}

export function migrateOriginalServicesImages(content: ServicesMainContent): ServicesMainContent {
  let changed = false;
  const cards = content.cards.map((card) => {
    const target = ORIGINAL_SERVICE_IMAGE_BY_ID[card.id];
    if (!target || card.image.src === target) return card;
    if (!isLocalPublicImageSrc(card.image.src) || !isRemappableLegacyLocalSrc(card.image.src)) {
      return card;
    }
    changed = true;
    return { ...card, image: remapCmsImageSrc(card.image, target) };
  });
  return changed ? { ...content, cards } : content;
}

export function migrateOriginalWorkGalleryImages(content: WorkGalleryContent): WorkGalleryContent {
  let changed = false;
  const items = content.items.map((item) => {
    const target = ORIGINAL_GALLERY_IMAGE_BY_ID[item.id];
    if (!target || item.image.src === target) return item;
    const src = item.image.src;
    if (!isLocalPublicImageSrc(src)) return item;
    const needsFix =
      isRemappableLegacyLocalSrc(src) ||
      (item.id === "gallery_furniture" &&
        (src === "/images/cms/work-regular.jpg" || src === "/images/cms/work-regular.webp"));
    if (!needsFix) return item;
    changed = true;
    return {
      ...item,
      image: remapCmsImageSrc(item.image, target),
    };
  });
  return changed ? { ...content, items } : content;
}

/**
 * Published / draft partners with an empty list never received logos in CMS.
 * Seed the default partner catalog once so the inspector and storefront match.
 * Editors who intentionally remove every logo should hide the section instead.
 */
export function migrateEmptyPartnersContent(existing?: PartnersContent): PartnersContent {
  const def = defaultSectionContent("home.partners") as PartnersContent;
  if (!existing) return migratePartnersLogoBackdrop(def);
  if (existing.items.length === 0) {
    return migratePartnersLogoBackdrop({
      ...existing,
      eyebrow: existing.eyebrow ?? def.eyebrow,
      heading: existing.heading?.trim() ? existing.heading : def.heading,
      items: def.items,
    });
  }
  return migratePartnersLogoBackdrop(existing);
}

/**
 * Backfill `logoBackdrop` / `resolvedBackdrop` on partner items without
 * rewriting names, images, or locale copy.
 *
 * - Explicit per-partner overrides (Dominee/Finbrokers/Benitech black,
 *   Laurens/Benerink white, Steggink yellow plate) win.
 * - Manual `light`/`dark` (or white/black) overrides are preserved as white/black mats.
 * - Legacy luminance tokens (`light`|`dark` resolved) and missing values → white.
 * - Plate CSS hex from new uploads is kept as-is.
 */
export function migratePartnersLogoBackdrop(content: PartnersContent): PartnersContent {
  let changed = false;
  const items = content.items.map((item) => {
    const forced =
      getPartnerBackdropOverride(item.id) ?? getPartnerBackdropOverride(item.image.src);
    if (forced) {
      if (
        item.logoBackdrop === forced.logoBackdrop &&
        item.resolvedBackdrop === forced.resolvedBackdrop
      ) {
        return item;
      }
      changed = true;
      return {
        ...item,
        logoBackdrop: forced.logoBackdrop,
        resolvedBackdrop: forced.resolvedBackdrop,
      };
    }

    const rawPref = item.logoBackdrop ?? "auto";
    let logoBackdrop: LogoBackdropPreference =
      rawPref === "white" ? "light" : rawPref === "black" ? "dark" : rawPref;
    if (logoBackdrop !== "auto" && logoBackdrop !== "light" && logoBackdrop !== "dark") {
      logoBackdrop = "auto";
    }

    let resolvedBackdrop: LogoBackdropResolved;
    if (logoBackdrop === "light") {
      resolvedBackdrop = LOGO_BACKDROP_WHITE;
    } else if (logoBackdrop === "dark") {
      resolvedBackdrop = LOGO_BACKDROP_BLACK;
    } else if (isPlateCssColor(item.resolvedBackdrop)) {
      resolvedBackdrop = normalizeLogoBackdropColor(item.resolvedBackdrop)!;
    } else {
      // Existing logos / legacy light|dark analysis → white default.
      resolvedBackdrop =
        defaultPartnerResolvedBackdrop(item.id) ??
        defaultPartnerResolvedBackdrop(item.image.src) ??
        LOGO_BACKDROP_WHITE;
    }

    if (logoBackdrop === item.logoBackdrop && resolvedBackdrop === item.resolvedBackdrop) {
      return item;
    }
    changed = true;
    return { ...item, logoBackdrop, resolvedBackdrop };
  });
  return changed ? { ...content, items } : content;
}

/**
 * Migrate legacy flat PageOverrides (hero.*) into HomeHeroContent.
 * Does not invent missing structured collections.
 */
export function migrateLegacyHeroOverrides(
  overrides: Record<string, string> | undefined,
  existing?: HomeHeroContent,
): HomeHeroContent {
  const base = migrateLegacyHeroContent(
    existing ?? (defaultSectionContent("home.hero") as HomeHeroContent),
  );
  if (!overrides) return base;
  const next = { ...base };
  if (overrides["hero.kicker"]) next.eyebrow = overrides["hero.kicker"];
  if (overrides["hero.title"]) next.heading = overrides["hero.title"];
  if (overrides["hero.titleAccent"]) next.headingAccent = overrides["hero.titleAccent"];
  if (overrides["hero.sub"]) next.body = overrides["hero.sub"];
  if (overrides["hero.image"]) {
    const fallback = next.image ?? localImage("/images/hero-placeholder.jpg", "Hero");
    next.image = {
      ...fallback,
      src: overrides["hero.image"],
      assetId: overrides["hero.image"].startsWith("data:")
        ? fallback.assetId
        : `local:migrated-hero`,
    };
  }
  if (overrides["hero.ctaSecondary"]) {
    next.secondaryCta = {
      label: overrides["hero.ctaSecondary"],
      link: next.secondaryCta?.link ?? { type: "internal_route", route: "services" },
    };
  }
  return next;
}

/** Prototype stats that shipped with wrong numbers / truncated body. */
export function isLegacyPrototypeStats(content: StatsContent): boolean {
  const shortBody = "Wij geloven dat schoonmaak een vak is — geen bijzaak.";
  if (content.body === shortBody) return true;
  return content.items.some(
    (item) =>
      (item.id === "stat_team" && item.value === "1") ||
      (item.id === "stat_focus" && item.label.toLowerCase().includes("eigen mensen")) ||
      (item.value === "1" && item.label.toLowerCase().includes("vast team")),
  );
}

/**
 * Replace known-bad prototype stats with the approved homepage copy.
 * Leaves intentionally customized CMS stats alone.
 */
export function migrateLegacyStatsContent(existing?: StatsContent): StatsContent {
  const def = defaultSectionContent("home.stats") as StatsContent;
  if (!existing || isLegacyPrototypeStats(existing)) return def;
  return existing;
}

export function ensureStableCollectionIds<T extends { id?: string }>(
  items: T[],
  prefix: string,
): Array<T & { id: string }> {
  const seen = new Set<string>();
  return items.map((item, i) => {
    let id = item.id && item.id.length > 0 ? item.id : `${prefix}_${i}_${newId("x")}`;
    while (seen.has(id)) id = `${prefix}_${newId("x")}`;
    seen.add(id);
    return { ...item, id };
  });
}
