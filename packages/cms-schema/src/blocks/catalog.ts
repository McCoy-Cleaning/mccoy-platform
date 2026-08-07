import { z } from "zod";
import { cmsButtonSchema, normalizeCmsButton, type CmsButton } from "../button";
import type { CmsImage } from "../cms-image";
import { createItemId } from "../ids";
import { formScopeSnapshotSchema, normalizeFormScopeSnapshot, type FormScopeSnapshot } from "../form-scope";
import { cmsLinkSchema, linkFromLegacyHref, parseCmsLink } from "../links";
import type { BlockType, CmsLink } from "../types";
import type { CmsBlockDataDefinition } from "./definition";
import { normalizeCmsImage } from "./image-normalize";
import {
  seedDefaultContactFormFields,
  formFieldItemSchema,
  formFieldPayloadKey,
  normalizeContactFormColumnsDesktop,
  normalizeContactFormTextPlacement,
  normalizeFormFields,
  type ContactFormColumnsDesktop,
  type ContactFormTextPlacement,
  type FormFieldItem,
} from "./form-fields";
import {
  createTextListItem,
  normalizeTextList,
  textListItemSchema,
  type TextListItem,
} from "./text-list";
import { newSectionsCatalogSlice, specialisedCatalogSlice } from "./catalog-slices";

export type {
  JobsBlockData,
  JobItem,
  VacancyItem,
  EmploymentType,
  VacancyHourlyRate,
  VacancyHoursPerWeek,
} from "./jobs";
export {
  jobsDefinition,
  normalizeJobs,
  createDefaultJobs,
  createVacaturesSeedJobs,
  createDefaultVacancy,
  formatHourlyRateNl,
  formatHoursPerWeekNl,
  validateJobsForPublish,
  cloneJobsDataWithNewIds,
  ensureVacaturesJobsBlock,
  warnLegacyVacancyFallback,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS_NL,
} from "./jobs";

function legacyCta(rec: Record<string, unknown>): CmsButton | undefined {
  if (rec.cta && typeof rec.cta === "object") {
    const parsed = cmsButtonSchema.safeParse(rec.cta);
    if (parsed.success) return parsed.data;
  }
  const label = typeof rec.ctaLabel === "string" ? rec.ctaLabel : "";
  const href = typeof rec.ctaHref === "string" ? rec.ctaHref : "";
  if (!label) return undefined;
  const link = linkFromLegacyHref(href) ?? { type: "internal_route" as const, route: "contact" as const };
  return { label, link };
}

function str(rec: Record<string, unknown>, key: string, fallback = ""): string {
  return typeof rec[key] === "string" ? (rec[key] as string) : fallback;
}

function bool(rec: Record<string, unknown>, key: string, fallback = false): boolean {
  return typeof rec[key] === "boolean" ? (rec[key] as boolean) : fallback;
}

/** Default Producten intro metrics strip (NL). Seeded when productsIntro lacks metrics. */
export const DEFAULT_PRODUCTS_INTRO_METRICS = [
  { id: "metric_products", value: "100+", label: "Producten" },
  { id: "metric_b2b", value: "B2B", label: "Groothandel" },
  { id: "metric_contact", value: "24/7", label: "Contact" },
] as const;

export type ProductsIntroMetric = {
  id: string;
  value: string;
  label: string;
};

export function normalizeProductsIntroMetrics(
  value: unknown,
  seedDefaults: boolean,
): ProductsIntroMetric[] | undefined {
  if (Array.isArray(value) && value.length > 0) {
    const metrics: ProductsIntroMetric[] = [];
    for (const row of value) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const valueText = typeof rec.value === "string" ? rec.value.trim() : "";
      const labelText = typeof rec.label === "string" ? rec.label.trim() : "";
      if (!valueText && !labelText) continue;
      metrics.push({
        id:
          typeof rec.id === "string" && rec.id.trim()
            ? rec.id.trim()
            : createItemId("metric"),
        value: valueText,
        label: labelText,
      });
    }
    if (metrics.length > 0) return metrics.slice(0, 6);
  }
  if (seedDefaults) {
    return DEFAULT_PRODUCTS_INTRO_METRICS.map((m) => ({ ...m }));
  }
  return undefined;
}

function def<TType extends BlockType, TData>(
  d: CmsBlockDataDefinition<TType, TData>,
): CmsBlockDataDefinition<TType, TData> {
  return d;
}

// —— Hero ——
export type HeroHeadingAccent = {
  beforeAccent?: string;
  accent?: string;
  afterAccent?: string;
};
export type HeroTrustItem = {
  id: string;
  value: string;
  label: string;
};
export type HeroHighlightStat = {
  value: string;
  label: string;
};
export type HeroPresentation = "default" | "formChrome";

export type HeroBlockData = {
  eyebrow?: string;
  title: string;
  /** Semantic accent parts — never raw HTML. */
  headingAccent?: HeroHeadingAccent;
  subtitle?: string;
  cta?: CmsButton;
  secondaryCta?: CmsButton;
  image?: CmsImage;
  align?: "left" | "center";
  /** Trust strip under CTAs (Home hero parity). */
  trustItems?: HeroTrustItem[];
  /** Floating badge on the hero media card (bottom-left). */
  highlightStat?: HeroHighlightStat;
  /** Floating certification chip on the hero media card (top-right). */
  certBadge?: string;
  /**
   * `formChrome` — Offerte/Contact-style intro (eyebrow + h1 + body + optional image).
   * Matches storefront FormPageChrome design.
   */
  presentation?: HeroPresentation;
};
const heroHeadingAccentSchema = z.object({
  beforeAccent: z.string().optional(),
  accent: z.string().optional(),
  afterAccent: z.string().optional(),
});
const heroTrustItemSchema = z.object({
  id: z.string().min(1),
  value: z.string(),
  label: z.string(),
});
const heroHighlightStatSchema = z.object({
  value: z.string(),
  label: z.string(),
});
const heroSchema: z.ZodType<HeroBlockData> = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  headingAccent: heroHeadingAccentSchema.optional(),
  subtitle: z.string().optional(),
  cta: cmsButtonSchema.optional(),
  secondaryCta: cmsButtonSchema.optional(),
  image: z.custom<CmsImage | undefined>((v) => v === undefined || normalizeCmsImage(v) != null).optional(),
  align: z.enum(["left", "center"]).optional(),
  trustItems: z.array(heroTrustItemSchema).optional(),
  highlightStat: heroHighlightStatSchema.optional(),
  certBadge: z.string().optional(),
  presentation: z.enum(["default", "formChrome"]).optional(),
});

/** Default trust strip matching the live Home hero / stats factory. */
export const DEFAULT_HERO_TRUST_ITEMS: readonly HeroTrustItem[] = [
  { id: "stat_years", value: "25+", label: "Jaar ervaring" },
  { id: "stat_team", value: "100%", label: "Vast eigen team" },
  { id: "stat_clients", value: "160+", label: "Tevreden klanten" },
];

function createDefaultHero(): HeroBlockData {
  return {
    eyebrow: "Live Clean",
    title: "Bij McCoy wordt kwaliteit",
    headingAccent: { accent: "zichtbaar." },
    subtitle:
      "Al meer dan 25 jaar staan wij voor schoonmaak met karakter — uitgevoerd door een vast eigen team, met professionele middelen en een onmiskenbaar oog voor detail. Geen onderaannemers, geen losse krachten: alleen vakmensen die uw pand behandelen alsof het hun eigen pand is.",
    secondaryCta: {
      label: "Bekijk onze diensten",
      link: { type: "internal_route", route: "services" },
    },
    image: {
      assetId: "local:images/cms/hero-cleaning.jpg",
      src: "/images/cms/hero-cleaning.jpg",
      alt: "McCoy Cleaning professional at work",
      decorative: false,
    },
    align: "left",
    trustItems: DEFAULT_HERO_TRUST_ITEMS.map((item) => ({ ...item })),
    highlightStat: { value: "25+", label: "Jaar ervaring" },
    certBadge: "Gecertificeerd",
  };
}
function normalizeHeroHeadingAccent(raw: unknown): HeroHeadingAccent | undefined {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) {
      // Legacy string accent → treat as accent substring only (no HTML).
      return { accent: raw.replace(/<[^>]+>/g, "").trim() || undefined };
    }
    return undefined;
  }
  const rec = raw as Record<string, unknown>;
  const accent: HeroHeadingAccent = {
    beforeAccent: str(rec, "beforeAccent") || undefined,
    accent: str(rec, "accent") || undefined,
    afterAccent: str(rec, "afterAccent") || undefined,
  };
  if (!accent.beforeAccent && !accent.accent && !accent.afterAccent) return undefined;
  return accent;
}
function parseOptionalButton(raw: unknown): CmsButton | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const parsed = cmsButtonSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}
function normalizeHeroTrustItems(raw: unknown): HeroTrustItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const id = typeof row.id === "string" && row.id ? row.id : createItemId("trust");
      return {
        id,
        value: typeof row.value === "string" ? row.value : "",
        label: typeof row.label === "string" ? row.label : "",
      };
    })
    .filter((item) => item.value.trim() || item.label.trim());
  return items.length ? items : undefined;
}
function normalizeHeroHighlightStat(raw: unknown): HeroHighlightStat | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const value = str(rec, "value");
  const label = str(rec, "label");
  if (!value && !label) return undefined;
  return { value, label };
}
function normalizeHero(value: unknown): HeroBlockData {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const primary = legacyCta(rec) ?? parseOptionalButton(rec.primaryCta);
  const secondary = parseOptionalButton(rec.secondaryCta);
  const title = str(rec, "title") || str(rec, "heading", "Titel");
  const subtitle = str(rec, "subtitle") || str(rec, "body") || undefined;
  const presentation: HeroPresentation | undefined =
    rec.presentation === "formChrome" ? "formChrome" : undefined;
  const data: HeroBlockData = {
    eyebrow: str(rec, "eyebrow") || undefined,
    title,
    headingAccent: normalizeHeroHeadingAccent(rec.headingAccent),
    subtitle: subtitle || undefined,
    cta: primary,
    secondaryCta: secondary,
    image: normalizeCmsImage(rec.image),
    align: rec.align === "center" ? "center" : "left",
    trustItems: normalizeHeroTrustItems(rec.trustItems),
    highlightStat: normalizeHeroHighlightStat(rec.highlightStat),
    certBadge: str(rec, "certBadge") || undefined,
    ...(presentation ? { presentation } : {}),
  };
  return heroSchema.safeParse(data).success ? data : createDefaultHero();
}

// —— Simple title/body/cta ——
type TitleBodyCta = { title: string; body?: string; cta?: CmsButton };
function titleBodyCtaSchema(): z.ZodType<TitleBodyCta> {
  return z.object({
    title: z.string(),
    body: z.string().optional(),
    cta: cmsButtonSchema.optional(),
  });
}
function normalizeTitleBodyCta(value: unknown, fallbackTitle: string): TitleBodyCta {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    title: str(rec, "title", fallbackTitle),
    body: str(rec, "body") || undefined,
    cta: legacyCta(rec),
  };
}

// —— Columns ——
export type ColumnItem = { id: string; title: string; body: string };
export type ColumnsBlockData = { title: string; columns: ColumnItem[] };
const columnsSchema: z.ZodType<ColumnsBlockData> = z.object({
  title: z.string(),
  columns: z.array(
    z.object({ id: z.string().min(1), title: z.string(), body: z.string() }),
  ),
});

// —— Benefits ——
export type BenefitsBlockData = { title: string; items: TextListItem[] };
const benefitsSchema: z.ZodType<BenefitsBlockData> = z.object({
  title: z.string(),
  items: z.array(textListItemSchema),
});

// —— Quote / testimonials ——
export type QuoteTestimonialItem = {
  id: string;
  quote: string;
  author?: string;
  role?: string;
  company?: string;
  avatar?: CmsImage;
};

export type QuoteBlockData = {
  items: QuoteTestimonialItem[];
};

export function createDefaultQuoteItem(
  overrides: Partial<Omit<QuoteTestimonialItem, "id">> = {},
): QuoteTestimonialItem {
  return {
    id: createItemId("quote"),
    quote: overrides.quote ?? "Een inspirerende quote van een klant.",
    author: overrides.author ?? "Naam",
    role: overrides.role ?? "Functie",
    company: overrides.company ?? "Bedrijf",
    avatar: overrides.avatar,
  };
}

function normalizeQuoteItem(entry: unknown): QuoteTestimonialItem | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, unknown>;
  const quote = typeof row.quote === "string" ? row.quote : "";
  const id = typeof row.id === "string" && row.id ? row.id : createItemId("quote");
  return {
    id,
    quote,
    author: typeof row.author === "string" && row.author ? row.author : undefined,
    role: typeof row.role === "string" && row.role ? row.role : undefined,
    company: typeof row.company === "string" && row.company ? row.company : undefined,
    avatar: normalizeCmsImage(row.avatar),
  };
}

/** Prefer `items[]`; migrate legacy flat quote/author/role/company/avatar. */
export function normalizeQuoteBlockData(value: unknown): QuoteBlockData {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const fromItems = Array.isArray(rec.items)
    ? rec.items.map(normalizeQuoteItem).filter((item): item is QuoteTestimonialItem => item != null)
    : [];
  if (fromItems.length > 0) {
    return { items: fromItems };
  }
  const legacyQuote = typeof rec.quote === "string" ? rec.quote : "";
  const hasLegacy =
    Boolean(legacyQuote) ||
    Boolean(rec.author) ||
    Boolean(rec.role) ||
    Boolean(rec.company) ||
    Boolean(rec.avatar);
  if (hasLegacy) {
    return {
      items: [
        {
          id: createItemId("quote"),
          quote: legacyQuote,
          author: str(rec, "author") || undefined,
          role: str(rec, "role") || undefined,
          company: str(rec, "company") || undefined,
          avatar: normalizeCmsImage(rec.avatar),
        },
      ],
    };
  }
  return { items: [createDefaultQuoteItem()] };
}

// —— Gallery ——
export type GalleryImageShape = "wide" | "square" | "tall";
/** Where per-item text sits relative to its image (text+image mode). */
export type GalleryTextPlacement = "above" | "below" | "left" | "right";
/** Images-only keeps classic gallery; textAndImage enables title/caption/body layouts. */
export type GalleryContentMode = "imagesOnly" | "textAndImage";
/** Column count for above/below text+image grids. */
export type GalleryColumns = 2 | 3 | 4;

export type GalleryImageItem = {
  id: string;
  image: CmsImage;
  title?: string;
  caption?: string;
  /** Longer body copy next to / with the image (text+image mode). */
  body?: string;
  /**
   * Tile shape for featured mosaic.
   * Omit for classic Ons-werk index spans; never invent a shape on normalize.
   */
  shape?: GalleryImageShape;
};
export type GalleryBlockData = {
  title: string;
  eyebrow?: string;
  body?: string;
  images: GalleryImageItem[];
  /** `featured` = homepage Ons-werk mosaic. Used when contentMode is imagesOnly. */
  layout?: "grid" | "masonry" | "featured";
  /** Default `imagesOnly` so published galleries keep prior behavior. */
  contentMode?: GalleryContentMode;
  /** Section-level text placement when contentMode is textAndImage. Default `below`. */
  textPlacement?: GalleryTextPlacement;
  /** Grid columns when textPlacement is above|below. Default 2. */
  columns?: GalleryColumns;
};

/** Canonical Dutch copy for the products “Ons werk” text+image gallery. */
export const GALLERY_WORK_SERVICES_COPY = {
  eyebrow: "Ons werk",
  title: "Alles voor een professioneel schone werkomgeving",
  body: "Van sanitaire voorzieningen en hygiënepapier tot professionele reinigingsmiddelen. McCoy combineert betrouwbare producten, praktisch advies en persoonlijke service in één complete oplossing.",
  items: [
    {
      title: "Sanitaire dispensers",
      body: "Functionele dispensers voor een verzorgde, hygiënische en professioneel ingerichte sanitaire ruimte.",
    },
    {
      title: "Hygiënepapier",
      body: "Een compleet assortiment toiletpapier, handdoekrollen en vouwhanddoekjes voor iedere werkomgeving.",
    },
    {
      title: "Professionele reinigingsmiddelen",
      body: "Doeltreffende producten voor de dagelijkse reiniging van interieurs, vloeren en sanitaire ruimtes.",
    },
  ],
} as const;

const LEGACY_GALLERY_ITEM_KEYS: Record<string, number> = {
  dispenser: 0,
  dispensers: 0,
  "sanitaire dispensers": 0,
  "hygiene papier": 1,
  "hygiëne papier": 1,
  "hygiënepapier": 1,
  "hygiene paper": 1,
  schoonmaakmiddelen: 2,
  reinigingsmiddelen: 2,
  "professionele reinigingsmiddelen": 2,
  "cleaning products": 2,
};

function normalizeGalleryItemKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * One-time migration for the outdated NL Producten gallery seed.
 * Must not run on EN overlays or editor-customized copy — normalize() runs on every
 * public render, so rewriting here previously forced Dutch factory text onto /en.
 */
export function upgradeTextAndImageGalleryCopy(data: {
  title: string;
  body?: string;
  images: GalleryImageItem[];
  contentMode: GalleryContentMode;
}): { title: string; body?: string; images: GalleryImageItem[] } {
  if (data.contentMode !== "textAndImage") {
    return { title: data.title, body: data.body, images: data.images };
  }

  const titleTrim = data.title.trim();
  const bodyText = data.body?.trim() ?? "";
  // Strict NL seed only — never treat EN titles ("A look at what we do") as migrate targets.
  const isOutdatedNlSeed =
    titleTrim === "Een blik op wat wij doen" &&
    (!bodyText ||
      bodyText.includes("Schoonmaak op het hoogste niveau") ||
      bodyText.includes("Cleaning at the highest level"));

  if (!isOutdatedNlSeed) {
    return { title: data.title, body: data.body, images: data.images };
  }

  const title = GALLERY_WORK_SERVICES_COPY.title;
  const body = GALLERY_WORK_SERVICES_COPY.body;

  const images = data.images.map((img, index) => {
    const key = normalizeGalleryItemKey(img.title ?? "");
    const captionKey = normalizeGalleryItemKey(img.caption ?? "");
    const mappedFromTitle =
      key && Object.prototype.hasOwnProperty.call(LEGACY_GALLERY_ITEM_KEYS, key)
        ? LEGACY_GALLERY_ITEM_KEYS[key]
        : undefined;
    const mappedFromCaption =
      captionKey && Object.prototype.hasOwnProperty.call(LEGACY_GALLERY_ITEM_KEYS, captionKey)
        ? LEGACY_GALLERY_ITEM_KEYS[captionKey]
        : undefined;
    const mappedIndex =
      mappedFromTitle ??
      mappedFromCaption ??
      (data.images.length === 3 && index < 3 ? index : undefined);
    if (mappedIndex == null) return img;
    const canonical = GALLERY_WORK_SERVICES_COPY.items[mappedIndex];
    if (!canonical) return img;
    return {
      ...img,
      title: canonical.title,
      body: canonical.body,
      caption: undefined,
    };
  });

  return { title, body, images };
}

/** Span classes for the featured mosaic grid (`auto-rows-[220px]` × 4 cols). */
export const galleryShapeConfig = {
  /** Same footprint as classic “Reguliere schoonmaak”: 2×2. */
  wide: { aspectRatio: "1 / 1", className: "col-span-2 row-span-2" },
  square: { aspectRatio: "1 / 1", className: "" },
  tall: { aspectRatio: "3 / 4", className: "row-span-2" },
} as const;

export function normalizeGalleryShape(raw: unknown): GalleryImageShape {
  return raw === "wide" || raw === "tall" ? raw : "square";
}

/** Explicit editor shape only — omit when unset so featured keeps classic mosaic spans. */
export function parseOptionalGalleryShape(raw: unknown): GalleryImageShape | undefined {
  if (raw === "wide" || raw === "tall" || raw === "square") return raw;
  return undefined;
}

export function normalizeGalleryTextPlacement(raw: unknown): GalleryTextPlacement {
  return raw === "above" || raw === "left" || raw === "right" ? raw : "below";
}

export function normalizeGalleryContentMode(raw: unknown): GalleryContentMode {
  return raw === "textAndImage" ? "textAndImage" : "imagesOnly";
}

export function normalizeGalleryColumns(raw: unknown): GalleryColumns {
  const n = typeof raw === "string" ? Number(raw) : raw;
  return n === 3 || n === 4 ? n : 2;
}

// —— Video ——
export type VideoBlockData = {
  title?: string;
  description?: string;
  videoUrl: string;
  poster?: CmsImage;
};

// —— Before/after ——
export type BeforeAfterBlockData = {
  title?: string;
  before?: CmsImage;
  after?: CmsImage;
  beforeLabel?: string;
  afterLabel?: string;
};

// —— Carousel ——
export type CarouselSlide = {
  id: string;
  title: string;
  body?: string;
  image?: CmsImage;
};
export type CarouselBlockData = { slides: CarouselSlide[] };

// —— Steps ——
export type StepItem = { id: string; title: string; body: string; image?: CmsImage };
export type StepsBlockData = { title: string; steps: StepItem[] };

// —— Comparison ——
export type ComparisonRow = { id: string; feature: string; values: boolean[] };
export type ComparisonTableBlockData = {
  title: string;
  columns: string[];
  rows: ComparisonRow[];
};

// —— Feature grid ——
export type FeatureItem = {
  id: string;
  icon: string;
  title: string;
  body: string;
  /** @deprecated Prefer `cta`. Kept for normalize of older Producten drafts. */
  link?: CmsLink;
  /** Per-card button on assortment cards (Producten presentation). */
  cta?: CmsButton;
};
export type FeatureGridPresentation = "default" | "productsAssortment";
export type FeatureGridBlockData = {
  title: string;
  features: FeatureItem[];
  /** Producten assortment chrome — eyebrow/intro + card grid layout. */
  presentation?: FeatureGridPresentation;
  eyebrow?: string;
  intro?: string;
};

export type TextImagePresentation = "default" | "productsIntro" | "aboutPillar";

export type AboutIntroPillar = {
  id: string;
  icon: string;
  label: string;
};

export type CenteredPresentation = "default" | "aboutIntro";

// —— Spacer ——
export type SpacerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpacerBlockData = { size: SpacerSize; divider: boolean };

const SPACER_SIZES = ["xs", "sm", "md", "lg", "xl"] as const satisfies readonly SpacerSize[];

/** Map legacy token / pixel sizes into the current SpacerSize enum. */
export function normalizeSpacerSize(raw: unknown): SpacerSize {
  if (typeof raw === "string") {
    const token = raw.trim().toLowerCase();
    if ((SPACER_SIZES as readonly string[]).includes(token)) {
      return token as SpacerSize;
    }
    // Legacy pixel heights from older drafts
    const px = Number.parseInt(token.replace(/px$/i, ""), 10);
    if (Number.isFinite(px)) {
      if (px <= 16) return "xs";
      if (px <= 32) return "sm";
      if (px <= 56) return "md";
      if (px <= 96) return "lg";
      return "xl";
    }
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw <= 16) return "xs";
    if (raw <= 32) return "sm";
    if (raw <= 56) return "md";
    if (raw <= 96) return "lg";
    return "xl";
  }
  return "md";
}

// —— Team ——
export type TeamMember = {
  id: string;
  name: string;
  role?: string;
  bio?: string;
  photo?: CmsImage;
};
export type TeamGridBlockData = { title: string; members: TeamMember[] };
export type TeamProfileBlockData = {
  name: string;
  role?: string;
  bio?: string;
  photo?: CmsImage;
  email?: string;
};

// —— Values ——
export type ValueItem = { id: string; title: string; body: string };
export type ValuesBlockData = { title: string; values: ValueItem[] };

// —— CTA ——
export type CtaBlockData = { title: string; body?: string; cta?: CmsButton };

// —— Forms / conversion ——
export type NewsletterBlockData = {
  title: string;
  body?: string;
  buttonLabel: string;
  consent?: string;
  scope?: FormScopeSnapshot;
};
export type ContactFormBlockData = {
  title: string;
  /** Eyebrow above the heading (copy column). */
  eyebrow?: string;
  /** Plain-text intro in the copy column. */
  body?: string;
  /** Bullet points in the copy column. Omit for defaults; `[]` hides them. */
  highlights?: TextListItem[];
  /** Copy position relative to the form. Default `left`. */
  textPlacement?: ContactFormTextPlacement;
  /** Field grid columns on desktop (sm+). Mobile is always 1. Default `2`. */
  formColumnsDesktop?: ContactFormColumnsDesktop;
  submitLabel?: string;
  successMessage?: string;
  successDetail?: string;
  consent?: string;
  labels?: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
    message?: string;
  };
  placeholders?: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
    message?: string;
  };
  /** Ignored at runtime — delivery uses server FORM_TO_EMAIL. Kept for legacy JSON. */
  recipient?: string;
  fields: FormFieldItem[];
  /** Legacy success copy — prefer successMessage. */
  confirmation?: string;
  scope?: FormScopeSnapshot;
};
export type AnnouncementBlockData = {
  message: string;
  linkLabel?: string;
  link?: CmsLink | null;
};
export type PopupBlockData = { title: string; body?: string; cta?: CmsButton };

// —— Showcase ——
export type PortfolioItem = {
  id: string;
  title: string;
  category?: string;
  image?: CmsImage;
};
export type PortfolioBlockData = { title: string; projects: PortfolioItem[] };
export type PostItem = {
  id: string;
  title: string;
  excerpt?: string;
  date?: string;
  image?: CmsImage;
};
export type LatestPostsBlockData = { title: string; posts: PostItem[] };

function mapIdList<T extends { id: string }>(
  raw: unknown,
  map: (row: Record<string, unknown>, id: string) => T,
): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const id = typeof row.id === "string" && row.id ? row.id : createItemId("item");
    return map(row, id);
  });
}

export const catalogDefinitions = {
  hero: def({
    type: "hero",
    label: "Hero",
    category: "Hero & intro",
    description: "Full-bleed intro met media, CTAs en trust strip (Home-pariteit)",
    dataVersion: 3,
    schema: heroSchema,
    createDefault: createDefaultHero,
    normalize: normalizeHero,
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  richText: def({
    type: "richText",
    label: "Rich text",
    category: "Content",
    dataVersion: 1,
    schema: titleBodyCtaSchema(),
    createDefault: (): TitleBodyCta => ({
      title: "Vertel je verhaal",
      body: "Schrijf hier een paragraaf.",
    }),
    normalize: (v) => normalizeTitleBodyCta(v, "Tekst"),
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  centered: def({
    type: "centered",
    label: "Gecentreerde tekst",
    category: "Content",
    dataVersion: 2,
    schema: z.object({
      title: z.string(),
      body: z.string().optional(),
      cta: cmsButtonSchema.optional(),
      presentation: z.enum(["default", "aboutIntro"]).optional(),
      eyebrow: z.string().optional(),
      pillars: z
        .array(
          z.object({
            id: z.string().min(1),
            icon: z.string(),
            label: z.string(),
          }),
        )
        .optional(),
    }),
    createDefault: (): TitleBodyCta & {
      presentation?: CenteredPresentation;
      eyebrow?: string;
      pillars?: AboutIntroPillar[];
    } => ({
      title: "Klaar om te beginnen?",
      body: "Korte boodschap",
      cta: { label: "Neem contact op", link: { type: "internal_route", route: "contact" } },
    }),
    normalize: (value) => {
      const base = normalizeTitleBodyCta(value, "Titel");
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const presentation: CenteredPresentation | undefined =
        rec.presentation === "aboutIntro" ? "aboutIntro" : undefined;
      const pillars: AboutIntroPillar[] = [];
      if (Array.isArray(rec.pillars)) {
        for (const entry of rec.pillars) {
          if (!entry || typeof entry !== "object") continue;
          const row = entry as Record<string, unknown>;
          const label = str(row, "label");
          if (!label) continue;
          pillars.push({
            id: str(row, "id") || createItemId("pillar"),
            icon: str(row, "icon", "award"),
            label,
          });
        }
      }
      return {
        ...base,
        ...(presentation ? { presentation } : {}),
        ...(str(rec, "eyebrow") ? { eyebrow: str(rec, "eyebrow") } : {}),
        ...(pillars.length ? { pillars } : {}),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  textImage: def({
    type: "textImage",
    label: "Tekst met afbeelding",
    category: "Content",
    dataVersion: 2,
    schema: z.object({
      title: z.string(),
      body: z.string().optional(),
      image: z.custom<CmsImage | undefined>().optional(),
      reverse: z.boolean().optional(),
      /** Producten intro / Over ons pillar chrome. */
      presentation: z.enum(["default", "productsIntro", "aboutPillar"]).optional(),
      eyebrow: z.string().optional(),
      /** Webshop / aside notice — separate from intro `body` paragraphs. */
      notice: z.string().optional(),
      /** Producten intro metrics strip (value + label pairs). */
      metrics: z
        .array(
          z.object({
            id: z.string(),
            value: z.string(),
            label: z.string(),
          }),
        )
        .optional(),
      /** Over ons pillar number badge (e.g. "01"). */
      tag: z.string().optional(),
      /** Lucide-ish icon key for about pillar (target/eye/history). */
      icon: z.string().optional(),
      aspectClassName: z.string().optional(),
      objectPosition: z.string().optional(),
      scaleMode: z.enum(["default", "soft"]).optional(),
    }),
    createDefault: () => ({
      title: "Waarom voor ons kiezen",
      body: "Beschrijf je aanpak.",
      reverse: false,
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const presentation: TextImagePresentation | undefined =
        rec.presentation === "productsIntro"
          ? "productsIntro"
          : rec.presentation === "aboutPillar"
            ? "aboutPillar"
            : undefined;
      const metrics = normalizeProductsIntroMetrics(rec.metrics, presentation === "productsIntro");
      return {
        title: str(rec, "title", "Titel"),
        body: str(rec, "body") || undefined,
        image: normalizeCmsImage(rec.image),
        reverse: bool(rec, "reverse"),
        ...(presentation ? { presentation } : {}),
        ...(str(rec, "eyebrow") ? { eyebrow: str(rec, "eyebrow") } : {}),
        ...(str(rec, "notice") ? { notice: str(rec, "notice") } : {}),
        ...(metrics ? { metrics } : {}),
        ...(str(rec, "tag") ? { tag: str(rec, "tag") } : {}),
        ...(str(rec, "icon") ? { icon: str(rec, "icon") } : {}),
        ...(str(rec, "aspectClassName") ? { aspectClassName: str(rec, "aspectClassName") } : {}),
        ...(str(rec, "objectPosition") ? { objectPosition: str(rec, "objectPosition") } : {}),
        ...(rec.scaleMode === "soft" ? { scaleMode: "soft" as const } : {}),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  columns: def({
    type: "columns",
    label: "Tekst kolommen",
    category: "Content",
    dataVersion: 1,
    schema: columnsSchema,
    createDefault: (): ColumnsBlockData => ({
      title: "Kolommen",
      columns: [
        { id: createItemId("col"), title: "Kolom 1", body: "Tekst" },
        { id: createItemId("col"), title: "Kolom 2", body: "Tekst" },
      ],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title", "Kolommen"),
        columns: mapIdList(rec.columns, (row, id) => ({
          id,
          title: str(row, "title"),
          body: str(row, "body"),
        })),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  benefits: def({
    type: "benefits",
    label: "Voordelen",
    category: "Content",
    dataVersion: 1,
    schema: benefitsSchema,
    createDefault: (): BenefitsBlockData => ({
      title: "Voordelen",
      items: [createTextListItem("Voordeel één"), createTextListItem("Voordeel twee")],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return { title: str(rec, "title", "Voordelen"), items: normalizeTextList(rec.items) };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  quote: def({
    type: "quote",
    label: "Quote",
    category: "Content",
    dataVersion: 2,
    schema: z.object({
      items: z.array(
        z.object({
          id: z.string().min(1),
          quote: z.string(),
          author: z.string().optional(),
          role: z.string().optional(),
          company: z.string().optional(),
          avatar: z.custom<CmsImage | undefined>().optional(),
        }),
      ),
    }),
    createDefault: (): QuoteBlockData => ({
      items: [createDefaultQuoteItem()],
    }),
    normalize: (value) => normalizeQuoteBlockData(value),
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  gallery: def({
    type: "gallery",
    label: "Galerij",
    category: "Media",
    dataVersion: 4,
    schema: z.object({
      title: z.string(),
      eyebrow: z.string().optional(),
      body: z.string().optional(),
      images: z.array(
        z.object({
          id: z.string(),
          image: z.custom<CmsImage>((v) => normalizeCmsImage(v) != null),
          title: z.string().optional(),
          caption: z.string().optional(),
          body: z.string().optional(),
          shape: z.enum(["wide", "square", "tall"]).optional(),
        }),
      ),
      layout: z.enum(["grid", "masonry", "featured"]).optional(),
      contentMode: z.enum(["imagesOnly", "textAndImage"]).optional(),
      textPlacement: z.enum(["above", "below", "left", "right"]).optional(),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    }),
    createDefault: (): GalleryBlockData => ({
      title: GALLERY_WORK_SERVICES_COPY.title,
      eyebrow: GALLERY_WORK_SERVICES_COPY.eyebrow,
      body: GALLERY_WORK_SERVICES_COPY.body,
      images: [],
      layout: "featured",
      contentMode: "imagesOnly",
      textPlacement: "below",
      columns: 2,
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const images: GalleryImageItem[] = [];
      if (Array.isArray(rec.images)) {
        for (const entry of rec.images) {
          if (typeof entry === "string") {
            const img = normalizeCmsImage(entry);
            // Legacy URL-only entries: no explicit shape → classic mosaic when featured.
            if (img) images.push({ id: createItemId("img"), image: img });
          } else if (entry && typeof entry === "object") {
            const row = entry as Record<string, unknown>;
            const img = normalizeCmsImage(row.image ?? row.src ?? row);
            if (img) {
              const shape = parseOptionalGalleryShape(row.shape);
              images.push({
                id: typeof row.id === "string" && row.id ? row.id : createItemId("img"),
                image: img,
                title: str(row, "title") || undefined,
                caption: str(row, "caption") || undefined,
                body: str(row, "body") || undefined,
                ...(shape ? { shape } : {}),
              });
            }
          }
        }
      }
      const layoutRaw = rec.layout;
      const layout =
        layoutRaw === "masonry" || layoutRaw === "featured" || layoutRaw === "grid"
          ? layoutRaw
          : "grid";
      const contentMode = normalizeGalleryContentMode(rec.contentMode);
      const upgraded = upgradeTextAndImageGalleryCopy({
        title: str(rec, "title", "Galerij"),
        body: str(rec, "body") || undefined,
        images,
        contentMode,
      });
      return {
        title: upgraded.title,
        eyebrow: str(rec, "eyebrow") || undefined,
        body: upgraded.body,
        images: upgraded.images,
        layout,
        contentMode,
        textPlacement: normalizeGalleryTextPlacement(rec.textPlacement),
        columns: normalizeGalleryColumns(rec.columns),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  video: def({
    type: "video",
    label: "Video",
    category: "Media",
    dataVersion: 1,
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      videoUrl: z.string().min(1),
      poster: z.custom<CmsImage | undefined>().optional(),
    }),
    createDefault: (): VideoBlockData => ({
      title: "Video",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title") || undefined,
        description: str(rec, "description") || undefined,
        videoUrl: str(rec, "videoUrl", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        poster: normalizeCmsImage(rec.poster),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  beforeAfter: def({
    type: "beforeAfter",
    label: "Voor / na",
    category: "Media",
    dataVersion: 1,
    schema: z.object({
      title: z.string().optional(),
      before: z.custom<CmsImage | undefined>().optional(),
      after: z.custom<CmsImage | undefined>().optional(),
      beforeLabel: z.string().optional(),
      afterLabel: z.string().optional(),
    }),
    createDefault: (): BeforeAfterBlockData => ({
      title: "Voor en na",
      beforeLabel: "Voor",
      afterLabel: "Na",
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title") || undefined,
        before: normalizeCmsImage(rec.before),
        after: normalizeCmsImage(rec.after),
        beforeLabel: str(rec, "beforeLabel") || undefined,
        afterLabel: str(rec, "afterLabel") || undefined,
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  carousel: def({
    type: "carousel",
    label: "Carousel",
    category: "Media",
    dataVersion: 1,
    schema: z.object({
      slides: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          body: z.string().optional(),
          image: z.custom<CmsImage | undefined>().optional(),
        }),
      ),
    }),
    createDefault: (): CarouselBlockData => ({
      slides: [{ id: createItemId("slide"), title: "Slide 1", body: "" }],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        slides: mapIdList(rec.slides, (row, id) => ({
          id,
          title: str(row, "title", "Slide"),
          body: str(row, "body") || undefined,
          image: normalizeCmsImage(row.image),
        })),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  steps: def({
    type: "steps",
    label: "Stappen",
    category: "Structure",
    dataVersion: 1,
    schema: z.object({
      title: z.string(),
      steps: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          body: z.string(),
          image: z
            .custom<CmsImage | undefined>((v) => v === undefined || normalizeCmsImage(v) != null)
            .optional(),
        }),
      ),
    }),
    createDefault: (): StepsBlockData => ({
      title: "Onze aanpak",
      steps: [
        { id: createItemId("step"), title: "Stap 1", body: "Beschrijving" },
        { id: createItemId("step"), title: "Stap 2", body: "Beschrijving" },
      ],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title", "Stappen"),
        steps: mapIdList(rec.steps, (row, id) => {
          const image = normalizeCmsImage(row.image);
          return {
            id,
            title: str(row, "title"),
            body: str(row, "body"),
            ...(image ? { image } : {}),
          };
        }),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  comparisonTable: def({
    type: "comparisonTable",
    label: "Vergelijkingstabel",
    category: "Structure",
    dataVersion: 1,
    schema: z.object({
      title: z.string(),
      columns: z.array(z.string()),
      rows: z.array(
        z.object({
          id: z.string(),
          feature: z.string(),
          values: z.array(z.boolean()),
        }),
      ),
    }),
    createDefault: (): ComparisonTableBlockData => ({
      title: "Vergelijking",
      columns: ["Basis", "Premium"],
      rows: [
        { id: createItemId("row"), feature: "Kenmerk A", values: [true, true] },
        { id: createItemId("row"), feature: "Kenmerk B", values: [false, true] },
      ],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const columns = Array.isArray(rec.columns)
        ? rec.columns.filter((c): c is string => typeof c === "string")
        : ["A", "B"];
      const rows = mapIdList(rec.rows, (row, id) => {
        const values = Array.isArray(row.values)
          ? row.values.map((v) => v === true)
          : columns.map(() => false);
        while (values.length < columns.length) values.push(false);
        return {
          id,
          feature: str(row, "feature", "Kenmerk"),
          values: values.slice(0, columns.length),
        };
      });
      return { title: str(rec, "title", "Vergelijking"), columns, rows };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  featureGrid: def({
    type: "featureGrid",
    label: "Kenmerkenraster",
    category: "Structure",
    dataVersion: 1,
    schema: z.object({
      title: z.string(),
      features: z.array(
        z.object({
          id: z.string(),
          icon: z.string(),
          title: z.string(),
          body: z.string(),
          link: cmsLinkSchema.optional(),
          cta: cmsButtonSchema.optional(),
        }),
      ),
      presentation: z.enum(["default", "productsAssortment"]).optional(),
      eyebrow: z.string().optional(),
      intro: z.string().optional(),
    }),
    // Generic defaults — Producten starters live in picker templates only.
    createDefault: (): FeatureGridBlockData => ({
      title: "Kenmerken",
      features: [
        { id: createItemId("feat"), icon: "sparkles", title: "Kwaliteit", body: "Toelichting" },
        { id: createItemId("feat"), icon: "shield", title: "Betrouwbaar", body: "Toelichting" },
      ],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const presentation =
        rec.presentation === "productsAssortment"
          ? ("productsAssortment" as const)
          : undefined;
      return {
        title: str(rec, "title", "Kenmerken"),
        features: mapIdList(rec.features, (row, id) => {
          const legacyLink = parseCmsLink(row.link);
          const cta =
            normalizeCmsButton(row.cta) ??
            (legacyLink && legacyLink.type !== "none"
              ? {
                  label: "Productofferte aanvragen",
                  action: "link" as const,
                  link: legacyLink,
                }
              : undefined);
          return {
            id,
            icon: str(row, "icon", "sparkles"),
            title: str(row, "title"),
            body: str(row, "body") || str(row, "description"),
            ...(cta ? { cta } : {}),
          };
        }),
        ...(presentation ? { presentation } : {}),
        ...(str(rec, "eyebrow") ? { eyebrow: str(rec, "eyebrow") } : {}),
        ...(str(rec, "intro") ? { intro: str(rec, "intro") } : {}),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  spacer: def({
    type: "spacer",
    label: "Spacer",
    category: "Structure",
    dataVersion: 1,
    schema: z.object({
      size: z.enum(["xs", "sm", "md", "lg", "xl"]),
      divider: z.boolean(),
    }),
    createDefault: (): SpacerBlockData => ({ size: "md", divider: false }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return { size: normalizeSpacerSize(rec.size), divider: bool(rec, "divider") };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  teamGrid: def({
    type: "teamGrid",
    label: "Team grid",
    category: "Team & about",
    dataVersion: 1,
    schema: z.object({
      title: z.string(),
      members: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          role: z.string().optional(),
          bio: z.string().optional(),
          photo: z.custom<CmsImage | undefined>().optional(),
        }),
      ),
    }),
    createDefault: (): TeamGridBlockData => ({
      title: "Ons team",
      members: [{ id: createItemId("mem"), name: "Naam", role: "Functie", bio: "" }],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title", "Team"),
        members: mapIdList(rec.members, (row, id) => ({
          id,
          name: str(row, "name", "Naam"),
          role: str(row, "role") || undefined,
          bio: str(row, "bio") || undefined,
          photo: normalizeCmsImage(row.photo),
        })),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  teamProfile: def({
    type: "teamProfile",
    label: "Teamprofiel",
    category: "Team & about",
    dataVersion: 1,
    schema: z.object({
      name: z.string(),
      role: z.string().optional(),
      bio: z.string().optional(),
      photo: z.custom<CmsImage | undefined>().optional(),
      email: z.string().optional(),
    }),
    createDefault: (): TeamProfileBlockData => ({ name: "Naam", role: "Functie", bio: "" }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        name: str(rec, "name", "Naam"),
        role: str(rec, "role") || undefined,
        bio: str(rec, "bio") || undefined,
        photo: normalizeCmsImage(rec.photo),
        email: str(rec, "email") || undefined,
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  values: def({
    type: "values",
    label: "Waarden",
    category: "Team & about",
    dataVersion: 1,
    schema: z.object({
      title: z.string(),
      values: z.array(z.object({ id: z.string(), title: z.string(), body: z.string() })),
    }),
    createDefault: (): ValuesBlockData => ({
      title: "Onze waarden",
      values: [{ id: createItemId("val"), title: "Waarde", body: "Toelichting" }],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title", "Waarden"),
        values: mapIdList(rec.values, (row, id) => ({
          id,
          title: str(row, "title"),
          body: str(row, "body"),
        })),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  cta: def({
    type: "cta",
    label: "CTA-banner",
    category: "Conversion",
    dataVersion: 1,
    schema: titleBodyCtaSchema(),
    createDefault: (): CtaBlockData => ({
      title: "Klaar voor de volgende stap?",
      body: "Neem contact op voor een vrijblijvende offerte.",
      cta: { label: "Offerte aanvragen", link: { type: "internal_route", route: "offerte" } },
    }),
    normalize: (v) => normalizeTitleBodyCta(v, "Call to action"),
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  newsletter: def({
    type: "newsletter",
    label: "Nieuwsbrief",
    category: "Conversion",
    description: "E-mailaanmelding met consent; opslag via website-aanvragen (geen marketingautomatisering).",
    dataVersion: 1,
    schema: z.object({
      title: z.string(),
      body: z.string().optional(),
      buttonLabel: z.string(),
      consent: z.string().optional(),
      scope: formScopeSnapshotSchema.optional(),
    }),
    createDefault: (): NewsletterBlockData => ({
      title: "Blijf op de hoogte",
      body: "Ontvang updates over diensten en vacatures.",
      buttonLabel: "Aanmelden",
      consent: "Ik ga akkoord met de privacyverklaring.",
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title", "Nieuwsbrief"),
        body: str(rec, "body") || undefined,
        buttonLabel: str(rec, "buttonLabel", "Aanmelden"),
        consent: str(rec, "consent") || undefined,
        scope: normalizeFormScopeSnapshot(rec.scope),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  contactForm: def({
    type: "contactForm",
    label: "Contactformulier",
    category: "Conversion",
    description:
      "Contactformulier met tekst (eyebrow/kop/intro) boven, links of rechts van het formulier; verzending via Aanvragen-pijplijn (FORM_TO_EMAIL).",
    dataVersion: 3,
    schema: z.object({
      title: z.string(),
      eyebrow: z.string().optional(),
      body: z.string().optional(),
      highlights: z.array(textListItemSchema).optional(),
      textPlacement: z.enum(["top", "left", "right"]).optional(),
      formColumnsDesktop: z.union([z.literal(1), z.literal(2)]).optional(),
      submitLabel: z.string().optional(),
      successMessage: z.string().optional(),
      successDetail: z.string().optional(),
      consent: z.string().optional(),
      labels: z
        .object({
          name: z.string().optional(),
          company: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          message: z.string().optional(),
        })
        .optional(),
      placeholders: z
        .object({
          name: z.string().optional(),
          company: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
          message: z.string().optional(),
        })
        .optional(),
      recipient: z.string().optional(),
      fields: z.array(formFieldItemSchema),
      confirmation: z.string().optional(),
      scope: formScopeSnapshotSchema.optional(),
    }),
    createDefault: (): ContactFormBlockData => ({
      title: "Laten we praten over uw pand.",
      eyebrow: "Contact",
      body: undefined,
      highlights: undefined,
      textPlacement: "left",
      formColumnsDesktop: 2,
      submitLabel: "Verstuur aanvraag",
      successMessage: "Bedankt! We nemen zo snel mogelijk contact op.",
      successDetail: "We hebben uw bericht ontvangen en nemen zo snel mogelijk contact op.",
      consent: "Door te versturen stemt u in met verwerking van uw gegevens voor deze aanvraag.",
      // Legacy maps for name/email copy; custom fields carry their own labels/placeholders.
      labels: {
        name: "Naam",
        email: "E-mail",
      },
      placeholders: {
        name: "Uw naam",
        email: "naam@bedrijf.nl",
      },
      fields: seedDefaultContactFormFields(),
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const fields = normalizeFormFields(rec.fields).filter((field) => {
        if (field.type === "name" || field.type === "email") return false;
        const key = formFieldPayloadKey(field);
        return key !== "name" && key !== "email";
      });
      const labelsRaw =
        rec.labels && typeof rec.labels === "object"
          ? (rec.labels as Record<string, unknown>)
          : undefined;
      const placeholdersRaw =
        rec.placeholders && typeof rec.placeholders === "object"
          ? (rec.placeholders as Record<string, unknown>)
          : undefined;
      const optStr = (row: Record<string, unknown> | undefined, key: string) => {
        const v = row?.[key];
        return typeof v === "string" && v.trim() ? v : undefined;
      };
      const labels = labelsRaw
        ? {
            name: optStr(labelsRaw, "name"),
            company: optStr(labelsRaw, "company"),
            phone: optStr(labelsRaw, "phone"),
            email: optStr(labelsRaw, "email"),
            message: optStr(labelsRaw, "message"),
          }
        : undefined;
      const placeholders = placeholdersRaw
        ? {
            name: optStr(placeholdersRaw, "name"),
            company: optStr(placeholdersRaw, "company"),
            phone: optStr(placeholdersRaw, "phone"),
            email: optStr(placeholdersRaw, "email"),
            message: optStr(placeholdersRaw, "message"),
          }
        : undefined;
      const highlights =
        rec.highlights === undefined ? undefined : normalizeTextList(rec.highlights);
      return {
        title: str(rec, "title", "Laten we praten over uw pand."),
        eyebrow: str(rec, "eyebrow") || undefined,
        body: str(rec, "body") || undefined,
        highlights,
        textPlacement: normalizeContactFormTextPlacement(rec.textPlacement),
        formColumnsDesktop: normalizeContactFormColumnsDesktop(rec.formColumnsDesktop),
        submitLabel: str(rec, "submitLabel") || undefined,
        successMessage: str(rec, "successMessage") || str(rec, "confirmation") || undefined,
        successDetail: str(rec, "successDetail") || undefined,
        consent: str(rec, "consent") || undefined,
        labels,
        placeholders,
        // Legacy field retained but never trusted for delivery.
        recipient: str(rec, "recipient") || undefined,
        fields:
          fields.length > 0
            ? fields
            : seedDefaultContactFormFields({ labels, placeholders }),
        confirmation: str(rec, "confirmation") || undefined,
        scope: normalizeFormScopeSnapshot(rec.scope),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  announcement: def({
    type: "announcement",
    label: "Aankondiging",
    category: "Conversion",
    dataVersion: 1,
    schema: z.object({
      message: z.string(),
      linkLabel: z.string().optional(),
      link: cmsLinkSchema.nullable().optional(),
    }),
    createDefault: (): AnnouncementBlockData => ({
      message: "Belangrijk nieuws",
      linkLabel: "Meer info",
      link: { type: "internal_route", route: "contact" },
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const href = typeof rec.linkHref === "string" ? rec.linkHref : undefined;
      const fromObject = parseCmsLink(rec.link);
      return {
        message: str(rec, "message", ""),
        linkLabel: str(rec, "linkLabel") || undefined,
        link: fromObject ?? linkFromLegacyHref(href),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  popup: def({
    type: "popup",
    label: "Popup CTA",
    category: "Conversion",
    description:
      "Dismissible modal/banner met titel, tekst en CTA. Toont één keer per sessie of tot sluiten (localStorage per blok-id). Respecteert prefers-reduced-motion. Niet inline als sectie op de pagina.",
    dataVersion: 1,
    schema: titleBodyCtaSchema(),
    createDefault: (): PopupBlockData => ({
      title: "Welkom bij McCoy",
      body: "Bekijk onze diensten of vraag direct een offerte aan.",
      cta: { label: "Offerte aanvragen", link: { type: "internal_route", route: "offerte" } },
    }),
    normalize: (v) => normalizeTitleBodyCta(v, "Popup"),
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  portfolio: def({
    type: "portfolio",
    label: "Portfolio",
    category: "Showcase",
    dataVersion: 1,
    schema: z.object({
      title: z.string(),
      projects: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          category: z.string().optional(),
          image: z.custom<CmsImage | undefined>().optional(),
        }),
      ),
    }),
    createDefault: (): PortfolioBlockData => ({
      title: "Projecten",
      projects: [{ id: createItemId("proj"), title: "Project", category: "" }],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title", "Portfolio"),
        projects: mapIdList(rec.projects, (row, id) => ({
          id,
          title: str(row, "title", "Project"),
          category: str(row, "category") || undefined,
          image: normalizeCmsImage(row.image),
        })),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  ...specialisedCatalogSlice,
  latestPosts: def({
    type: "latestPosts",
    label: "Uitgelichte artikelen",
    category: "Showcase",
    description: "Handmatig beheerde artikelenkaarten (geen automatische feed).",
    dataVersion: 1,
    schema: z.object({
      title: z.string(),
      posts: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          excerpt: z.string().optional(),
          date: z.string().optional(),
          image: z.custom<CmsImage | undefined>().optional(),
        }),
      ),
    }),
    createDefault: (): LatestPostsBlockData => ({
      title: "Uitgelichte artikelen",
      posts: [{ id: createItemId("post"), title: "Artikel", excerpt: "", date: "" }],
    }),
    normalize: (value) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        title: str(rec, "title", "Uitgelichte artikelen"),
        posts: mapIdList(rec.posts, (row, id) => ({
          id,
          title: str(row, "title", "Artikel"),
          excerpt: str(row, "excerpt") || undefined,
          date: str(row, "date") || undefined,
          image: normalizeCmsImage(row.image),
        })),
      };
    },
    capabilities: { duplicable: true, removable: true, publishable: true },
  }),
  ...newSectionsCatalogSlice,
} as const satisfies Record<BlockType, CmsBlockDataDefinition>;

export type CatalogDefinitions = typeof catalogDefinitions;
