import { z } from "zod";
import { createItemId, type CmsImage } from "../content";
import type { BlockType } from "../types";
import type { CmsBlockDataDefinition } from "./definition";
import { normalizeCmsImage } from "./image-normalize";

function str(rec: Record<string, unknown>, key: string, fallback = ""): string {
  return typeof rec[key] === "string" ? (rec[key] as string) : fallback;
}

function def<TType extends BlockType, TData>(
  d: CmsBlockDataDefinition<TType, TData>,
): CmsBlockDataDefinition<TType, TData> {
  return d;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// —— Partners marquee ——
export type PartnerLogoItem = {
  id: string;
  name: string;
  logo?: CmsImage;
  href?: string;
  logoBackdrop?: string;
};

export type PartnersMarqueeBlockData = {
  eyebrow?: string;
  heading?: string;
  items: PartnerLogoItem[];
  /** When false, always render static grid. */
  animate?: boolean;
};

const partnerHrefSchema = z
  .string()
  .refine(
    (v) => !v || v.startsWith("/") || v.startsWith("https://") || v.startsWith("http://"),
    "Alleen interne paden of http(s)-URL's",
  )
  .optional();

export const partnersMarqueeSchema: z.ZodType<PartnersMarqueeBlockData> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  animate: z.boolean().optional(),
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      logo: z.custom<CmsImage | undefined>((v) => v === undefined || normalizeCmsImage(v) != null).optional(),
      href: partnerHrefSchema,
      logoBackdrop: z.string().optional(),
    }),
  ),
});

export function createDefaultPartnersMarquee(): PartnersMarqueeBlockData {
  return {
    eyebrow: "Partners",
    heading: "Vertrouwd door",
    animate: true,
    items: [],
  };
}

export function normalizePartnersMarquee(value: unknown): PartnersMarqueeBlockData {
  const rec = isRecord(value) ? value : {};
  const items: PartnerLogoItem[] = [];
  if (Array.isArray(rec.items)) {
    for (const entry of rec.items) {
      if (!isRecord(entry)) continue;
      const name = str(entry, "name") || str(entry, "title") || "Partner";
      const hrefRaw = str(entry, "href") || str(entry, "url") || undefined;
      const hrefParsed = partnerHrefSchema.safeParse(hrefRaw);
      items.push({
        id: str(entry, "id") || createItemId("partner"),
        name,
        logo: normalizeCmsImage(entry.logo ?? entry.image),
        href: hrefParsed.success ? hrefParsed.data : undefined,
        logoBackdrop: str(entry, "logoBackdrop") || undefined,
      });
    }
  }
  const data: PartnersMarqueeBlockData = {
    eyebrow: str(rec, "eyebrow") || undefined,
    heading: str(rec, "heading") || str(rec, "title") || undefined,
    animate: rec.animate === false ? false : true,
    items,
  };
  return partnersMarqueeSchema.safeParse(data).success ? data : createDefaultPartnersMarquee();
}

export const partnersMarqueeDefinition = def({
  type: "partnersMarquee",
  label: "Partners",
  category: "Showcase",
  description: "Logo-strip / marquee van partners.",
  dataVersion: 1,
  schema: partnersMarqueeSchema,
  createDefault: createDefaultPartnersMarquee,
  normalize: normalizePartnersMarquee,
  capabilities: { duplicable: true, removable: true, publishable: true },
  getSummary: (data) => {
    const d = normalizePartnersMarquee(data);
    return `${d.items.length} partner${d.items.length === 1 ? "" : "s"}`;
  },
});

// —— Stats counters ——
export type StatsCounterItem = {
  id: string;
  prefix?: string;
  value: string;
  suffix?: string;
  label: string;
  supportingText?: string;
  animate?: boolean;
};

export type StatsCountersBlockData = {
  eyebrow?: string;
  heading?: string;
  body?: string;
  items: StatsCounterItem[];
};

export const statsCountersSchema: z.ZodType<StatsCountersBlockData> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  body: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string().min(1),
      prefix: z.string().optional(),
      value: z.string().min(1),
      suffix: z.string().optional(),
      label: z.string().min(1),
      supportingText: z.string().optional(),
      animate: z.boolean().optional(),
    }),
  ),
});

export function createDefaultStatsCounters(): StatsCountersBlockData {
  return {
    eyebrow: "Cijfers",
    heading: "McCoy in getallen",
    items: [
      {
        id: createItemId("stat"),
        value: "25",
        suffix: "+",
        label: "jaar ervaring",
        animate: true,
      },
    ],
  };
}

export function normalizeStatsCounters(value: unknown): StatsCountersBlockData {
  const rec = isRecord(value) ? value : {};
  const items: StatsCounterItem[] = [];
  if (Array.isArray(rec.items)) {
    for (const entry of rec.items) {
      if (!isRecord(entry)) continue;
      const valueStr =
        typeof entry.value === "number"
          ? String(entry.value)
          : str(entry, "value") || str(entry, "number") || "0";
      items.push({
        id: str(entry, "id") || createItemId("stat"),
        prefix: str(entry, "prefix") || undefined,
        value: valueStr,
        suffix: str(entry, "suffix") || undefined,
        label: str(entry, "label") || str(entry, "title") || "Statistiek",
        supportingText: str(entry, "supportingText") || str(entry, "body") || undefined,
        animate: entry.animate === false ? false : true,
      });
    }
  }
  const data: StatsCountersBlockData = {
    eyebrow: str(rec, "eyebrow") || undefined,
    heading: str(rec, "heading") || str(rec, "title") || undefined,
    body: str(rec, "body") || undefined,
    items: items.length ? items : createDefaultStatsCounters().items,
  };
  return statsCountersSchema.safeParse(data).success ? data : createDefaultStatsCounters();
}

export const statsCountersDefinition = def({
  type: "statsCounters",
  label: "Statistieken",
  category: "Content",
  description: "KPI-band met waarden, prefix/suffix en labels.",
  dataVersion: 1,
  schema: statsCountersSchema,
  createDefault: createDefaultStatsCounters,
  normalize: normalizeStatsCounters,
  capabilities: { duplicable: true, removable: true, publishable: true },
  getSummary: (data) => {
    const d = normalizeStatsCounters(data);
    return `${d.items.length} cijfer${d.items.length === 1 ? "" : "s"}`;
  },
});

// —— Contact info cards ——
export type ContactInfoCardType = "address" | "phone" | "email" | "hours" | "custom";
export type ContactInfoCardAction = {
  kind: "internal" | "external" | "mailto" | "tel";
  href: string;
  label?: string;
};

export type ContactInfoCard = {
  id: string;
  type: ContactInfoCardType;
  label: string;
  value: string;
  secondaryValue?: string;
  icon?: string;
  action?: ContactInfoCardAction;
};

export type ContactInfoCardsBlockData = {
  eyebrow?: string;
  heading?: string;
  items: ContactInfoCard[];
};

const contactActionSchema = z.object({
  kind: z.enum(["internal", "external", "mailto", "tel"]),
  href: z
    .string()
    .min(1)
    .refine((h) => !/^javascript:/i.test(h), "javascript: is niet toegestaan"),
  label: z.string().optional(),
});

export const contactInfoCardsSchema: z.ZodType<ContactInfoCardsBlockData> = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(["address", "phone", "email", "hours", "custom"]),
      label: z.string().min(1),
      value: z.string().min(1),
      secondaryValue: z.string().optional(),
      icon: z.string().optional(),
      action: contactActionSchema.optional(),
    }),
  ),
});

export function createDefaultContactInfoCards(): ContactInfoCardsBlockData {
  return {
    heading: "Contactgegevens",
    items: [
      {
        id: createItemId("cinfo"),
        type: "phone",
        label: "Telefoon",
        value: "+31 00 000 0000",
        action: { kind: "tel", href: "tel:+31000000000" },
      },
    ],
  };
}

function normalizeContactAction(raw: unknown): ContactInfoCardAction | undefined {
  if (!isRecord(raw)) return undefined;
  const parsed = contactActionSchema.safeParse({
    kind: raw.kind,
    href: str(raw, "href"),
    label: str(raw, "label") || undefined,
  });
  return parsed.success ? parsed.data : undefined;
}

export function normalizeContactInfoCards(value: unknown): ContactInfoCardsBlockData {
  const rec = isRecord(value) ? value : {};
  const items: ContactInfoCard[] = [];
  if (Array.isArray(rec.items)) {
    for (const entry of rec.items) {
      if (!isRecord(entry)) continue;
      const typeRaw = str(entry, "type");
      const type: ContactInfoCardType =
        typeRaw === "address" ||
        typeRaw === "phone" ||
        typeRaw === "email" ||
        typeRaw === "hours" ||
        typeRaw === "custom"
          ? typeRaw
          : "custom";
      items.push({
        id: str(entry, "id") || createItemId("cinfo"),
        type,
        label: str(entry, "label") || "Info",
        value: str(entry, "value") || str(entry, "text") || "—",
        secondaryValue: str(entry, "secondaryValue") || undefined,
        icon: str(entry, "icon") || undefined,
        action: normalizeContactAction(entry.action ?? entry.link),
      });
    }
  }
  const data: ContactInfoCardsBlockData = {
    eyebrow: str(rec, "eyebrow") || undefined,
    heading: str(rec, "heading") || str(rec, "title") || undefined,
    items: items.length ? items : createDefaultContactInfoCards().items,
  };
  return contactInfoCardsSchema.safeParse(data).success ? data : createDefaultContactInfoCards();
}

export const contactInfoCardsDefinition = def({
  type: "contactInfoCards",
  label: "Contactkaarten",
  category: "Conversion",
  description: "Adres, telefoon, e-mail en openingstijden als kaarten.",
  dataVersion: 1,
  schema: contactInfoCardsSchema,
  createDefault: createDefaultContactInfoCards,
  normalize: normalizeContactInfoCards,
  capabilities: { duplicable: true, removable: true, publishable: true },
  getSummary: (data) => {
    const d = normalizeContactInfoCards(data);
    return `${d.items.length} kaart${d.items.length === 1 ? "" : "en"}`;
  },
});

// —— Quote request form (presentation only) ——
export type QuoteScopeId = "glass_cleaning" | "furniture_cleaning";

export type QuoteRequestFormBlockData = {
  heading: string;
  description?: string;
  enabledScopes: QuoteScopeId[];
  defaultScope: QuoteScopeId;
  submitLabel: string;
  successMessage: string;
};

export const quoteRequestFormSchema: z.ZodType<QuoteRequestFormBlockData> = z
  .object({
    heading: z.string().min(1),
    description: z.string().optional(),
    enabledScopes: z
      .array(z.enum(["glass_cleaning", "furniture_cleaning"]))
      .min(1)
      .max(2),
    defaultScope: z.enum(["glass_cleaning", "furniture_cleaning"]),
    submitLabel: z.string().min(1),
    successMessage: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (!data.enabledScopes.includes(data.defaultScope)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "defaultScope must be one of enabledScopes",
        path: ["defaultScope"],
      });
    }
  });

export function createDefaultQuoteRequestForm(): QuoteRequestFormBlockData {
  return {
    heading: "Offerte aanvragen",
    description: "Kies uw type reiniging en vul het formulier in.",
    enabledScopes: ["glass_cleaning", "furniture_cleaning"],
    defaultScope: "glass_cleaning",
    submitLabel: "Verstuur aanvraag",
    successMessage: "Bedankt — we nemen zo snel mogelijk contact op.",
  };
}

export function normalizeQuoteRequestForm(value: unknown): QuoteRequestFormBlockData {
  const rec = isRecord(value) ? value : {};
  const scopesRaw = Array.isArray(rec.enabledScopes) ? rec.enabledScopes : [];
  const enabledScopes = scopesRaw.filter(
    (s): s is QuoteScopeId => s === "glass_cleaning" || s === "furniture_cleaning",
  );
  const defaultScope: QuoteScopeId =
    rec.defaultScope === "furniture_cleaning" ? "furniture_cleaning" : "glass_cleaning";
  const data: QuoteRequestFormBlockData = {
    heading: str(rec, "heading", "Offerte aanvragen"),
    description: str(rec, "description") || str(rec, "body") || undefined,
    enabledScopes: enabledScopes.length
      ? enabledScopes
      : ["glass_cleaning", "furniture_cleaning"],
    defaultScope: enabledScopes.includes(defaultScope)
      ? defaultScope
      : (enabledScopes[0] ?? "glass_cleaning"),
    submitLabel: str(rec, "submitLabel", "Verstuur aanvraag"),
    successMessage: str(
      rec,
      "successMessage",
      "Bedankt — we nemen zo snel mogelijk contact op.",
    ),
  };
  return quoteRequestFormSchema.safeParse(data).success
    ? data
    : createDefaultQuoteRequestForm();
}

export const quoteRequestFormDefinition = def({
  type: "quoteRequestForm",
  label: "Offerteformulier",
  category: "Conversion",
  description: "Presentatie voor het offerte-aanvraagformulier (server bepaalt bron/scope).",
  dataVersion: 1,
  schema: quoteRequestFormSchema,
  createDefault: createDefaultQuoteRequestForm,
  normalize: normalizeQuoteRequestForm,
  capabilities: { duplicable: false, removable: true, publishable: true },
  getSummary: () => "Offerteformulier",
});

// —— Legal articles ——
export type LegalArticleItem = {
  id: string;
  heading: string;
  anchor: string;
  /** Sanitised plain/HTML-ish body — renderer must escape or sanitize. */
  content: string;
};

export type LegalArticlesBlockData = {
  heading: string;
  updatedLabel?: string;
  updatedAt?: string;
  articles: LegalArticleItem[];
};

function slugifyAnchor(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "artikel";
}

export const legalArticlesSchema: z.ZodType<LegalArticlesBlockData> = z.object({
  heading: z.string().min(1),
  updatedLabel: z.string().optional(),
  updatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Gebruik ISO-datum YYYY-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  articles: z.array(
    z.object({
      id: z.string().min(1),
      heading: z.string().min(1),
      anchor: z
        .string()
        .min(1)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Anker: lowercase kebab-case"),
      content: z.string(),
    }),
  ),
});

export function createDefaultLegalArticles(): LegalArticlesBlockData {
  return {
    heading: "Juridische informatie",
    updatedLabel: "Laatst bijgewerkt",
    articles: [
      {
        id: createItemId("legal"),
        heading: "Artikel 1",
        anchor: "artikel-1",
        content: "Inhoud van dit artikel.",
      },
    ],
  };
}

export function normalizeLegalArticles(value: unknown): LegalArticlesBlockData {
  const rec = isRecord(value) ? value : {};
  const articles: LegalArticleItem[] = [];
  const seenAnchors = new Set<string>();
  if (Array.isArray(rec.articles)) {
    for (const entry of rec.articles) {
      if (!isRecord(entry)) continue;
      const heading = str(entry, "heading") || str(entry, "title") || "Artikel";
      let anchor = str(entry, "anchor") || slugifyAnchor(heading);
      anchor = slugifyAnchor(anchor);
      let unique = anchor;
      let n = 2;
      while (seenAnchors.has(unique)) {
        unique = `${anchor}-${n++}`;
      }
      seenAnchors.add(unique);
      articles.push({
        id: str(entry, "id") || createItemId("legal"),
        heading,
        anchor: unique,
        content: str(entry, "content") || str(entry, "body") || "",
      });
    }
  }
  const updatedAtRaw = str(rec, "updatedAt");
  const updatedAt = /^\d{4}-\d{2}-\d{2}$/.test(updatedAtRaw) ? updatedAtRaw : undefined;
  const data: LegalArticlesBlockData = {
    heading: str(rec, "heading") || str(rec, "title") || "Juridische informatie",
    updatedLabel: str(rec, "updatedLabel") || undefined,
    updatedAt,
    articles: articles.length ? articles : createDefaultLegalArticles().articles,
  };
  return legalArticlesSchema.safeParse(data).success ? data : createDefaultLegalArticles();
}

export const legalArticlesDefinition = def({
  type: "legalArticles",
  label: "Juridische artikelen",
  category: "Content",
  description: "Privacy / voorwaarden met ankers en gestructureerde artikelen.",
  dataVersion: 1,
  schema: legalArticlesSchema,
  createDefault: createDefaultLegalArticles,
  normalize: normalizeLegalArticles,
  capabilities: { duplicable: true, removable: true, publishable: true },
  getSummary: (data) => {
    const d = normalizeLegalArticles(data);
    return `${d.articles.length} artikel${d.articles.length === 1 ? "" : "en"}`;
  },
});
