import { z } from "zod";
import type { CmsImage } from "../cms-image";
import { createItemId } from "../ids";
import {
  formScopeSnapshotSchema,
  normalizeFormScopeSnapshot,
  type FormScopeSnapshot,
} from "../form-scope";
import type { BlockType } from "../types";
import type { CmsBlockDataDefinition } from "./definition";
import {
  createFormFieldItem,
  createFormFieldOption,
  formFieldItemSchema,
  normalizeFormFields,
  type FormFieldItem,
} from "./form-fields";
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

// —— Quote request form (multi-tab, custom fields) ——
/** @deprecated Prefer QuoteFormKind — kept for dual-read of older block JSON. */
export type QuoteScopeId = "glass_cleaning" | "furniture_cleaning";

/** Aligns with domain FormKind for glass/furniture offerte submits. */
export type QuoteFormKind = "glass_washing" | "furniture_cleaning";

export type QuoteRequestFormTab = {
  id: string;
  /** Server form kind for this tab. */
  kind: QuoteFormKind;
  tag: string;
  title: string;
  description: string;
  icon?: string;
  /** Custom fields (name/email stay built-in). Same editor model as contactForm. */
  fields: FormFieldItem[];
  submitLabel?: string;
  successMessage?: string;
  scope?: FormScopeSnapshot;
};

export type QuoteRequestFormBlockData = {
  heading?: string;
  description?: string;
  tabs: QuoteRequestFormTab[];
  defaultTabId?: string;
  /** Shared fallbacks when a tab omits them. */
  submitLabel: string;
  successMessage: string;
  /**
   * Legacy dual-read fields (pre-tabs). Normalize lifts these into tabs.
   * @deprecated
   */
  enabledScopes?: QuoteScopeId[];
  /** @deprecated */
  defaultScope?: QuoteScopeId;
};

const quoteFormKindSchema = z.enum(["glass_washing", "furniture_cleaning"]);

export const quoteRequestFormTabSchema: z.ZodType<QuoteRequestFormTab> = z.object({
  id: z.string().min(1),
  kind: quoteFormKindSchema,
  tag: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  icon: z.string().optional(),
  fields: z.array(formFieldItemSchema),
  submitLabel: z.string().optional(),
  successMessage: z.string().optional(),
  scope: formScopeSnapshotSchema.optional(),
});

export const quoteRequestFormSchema: z.ZodType<QuoteRequestFormBlockData> = z
  .object({
    heading: z.string().optional(),
    description: z.string().optional(),
    tabs: z.array(quoteRequestFormTabSchema).min(1).max(8),
    defaultTabId: z.string().optional(),
    submitLabel: z.string().min(1),
    successMessage: z.string().min(1),
    enabledScopes: z.array(z.enum(["glass_cleaning", "furniture_cleaning"])).optional(),
    defaultScope: z.enum(["glass_cleaning", "furniture_cleaning"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.defaultTabId && !data.tabs.some((t) => t.id === data.defaultTabId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "defaultTabId must match a tab id",
        path: ["defaultTabId"],
      });
    }
  });

function optSelect(label: string, options: readonly string[]): FormFieldItem {
  return createFormFieldItem(label, "select", {
    options: options.map((o) => createFormFieldOption(o, o)),
  });
}

/** Exact NL field labels/options from the live Offerteformulier (window tab). */
export function seedDefaultGlassWashingFields(): FormFieldItem[] {
  return [
    createFormFieldItem("Telefoon", "phone"),
    createFormFieldItem("Bedrijfsnaam", "company"),
    createFormFieldItem("Aantal verdiepingen", "text"),
    createFormFieldItem("Aantal ramen (indicatie)", "text"),
    createFormFieldItem("Hoogste raam (meter)", "text"),
    optSelect("Bereikbaarheid", [
      "Vanaf de grond",
      "Ladder",
      "Hoogwerker",
      "Gondel / glazenwasserslift",
    ]),
    optSelect("Binnen, buiten of beide?", ["Alleen buiten", "Alleen binnen", "Binnen + buiten"]),
    optSelect("Frequentie", ["4× per jaar", "6× per jaar", "Maandelijks", "Eenmalig"]),
    createFormFieldItem("Foto's van de situatie (optioneel)", "file"),
    createFormFieldItem("Uw bericht", "textarea"),
  ];
}

/** Exact NL field labels/options from the live Offerteformulier (furniture tab). */
export function seedDefaultFurnitureCleaningFields(): FormFieldItem[] {
  return [
    createFormFieldItem("Telefoon", "phone"),
    createFormFieldItem("Bedrijfsnaam", "company"),
    optSelect("Type meubel / vloer", [
      "Stoffen bank / fauteuil",
      "Lederen meubilair",
      "Bureaustoelen",
      "Tapijt / vloerbedekking",
      "Harde vloer (PVC / linoleum)",
      "Marmoleum / natuursteen",
      "Parket",
      "Matrassen",
    ]),
    createFormFieldItem("Aantal stuks", "text"),
    createFormFieldItem("Materiaal / stof (indien bekend)", "text"),
    createFormFieldItem("Oppervlakte (m²)", "text"),
    createFormFieldItem("Foto's van de situatie (optioneel)", "file"),
    createFormFieldItem("Bijzondere vlekken of geuren", "textarea"),
  ];
}

export function createDefaultQuoteRequestForm(): QuoteRequestFormBlockData {
  return {
    heading: undefined,
    description: undefined,
    submitLabel: "Verstuur aanvraag",
    successMessage: "Bedankt! We nemen zo snel mogelijk contact op.",
    defaultTabId: "tab_glass",
    tabs: [
      {
        id: "tab_glass",
        kind: "glass_washing",
        tag: "Glasbewassing",
        title: "Glasbewassing & gevelreiniging",
        description:
          "Streep­vrij schone ramen binnen én buiten — van pui op straatniveau tot hoogwerkers en gondels. Vertel ons zo veel mogelijk over het pand, dan rekenen wij u direct een eerlijke prijs voor.",
        icon: "glass",
        fields: seedDefaultGlassWashingFields(),
      },
      {
        id: "tab_furniture",
        kind: "furniture_cleaning",
        tag: "Vloer- & meubelreiniging",
        title: "Vloer- & meubelonderhoud",
        description:
          "Diepe reiniging en bescherming van stoffen meubilair, lederen banken, tapijten en harde vloeren. Wij werken met professionele extractie-apparatuur en pH-neutrale middelen die de vezel sparen.",
        icon: "sofa",
        fields: seedDefaultFurnitureCleaningFields(),
      },
    ],
  };
}

function legacyScopeToKind(scope: string): QuoteFormKind {
  if (scope === "furniture_cleaning") return "furniture_cleaning";
  return "glass_washing";
}

function normalizeQuoteTab(raw: unknown, index: number): QuoteRequestFormTab | null {
  if (!isRecord(raw)) return null;
  const kindRaw = str(raw, "kind") || str(raw, "scope") || str(raw, "defaultScope");
  const kind: QuoteFormKind =
    kindRaw === "furniture_cleaning" || kindRaw === "furniture"
      ? "furniture_cleaning"
      : kindRaw === "glass_washing" ||
          kindRaw === "glass_cleaning" ||
          kindRaw === "glass" ||
          kindRaw === "window"
        ? "glass_washing"
        : index === 1
          ? "furniture_cleaning"
          : "glass_washing";
  const defaults =
    kind === "furniture_cleaning"
      ? createDefaultQuoteRequestForm().tabs[1]!
      : createDefaultQuoteRequestForm().tabs[0]!;
  const fieldsRaw = normalizeFormFields(raw.fields).filter((field) => {
    if (field.type === "name" || field.type === "email") return false;
    return true;
  });
  return {
    id: str(raw, "id") || (kind === "furniture_cleaning" ? "tab_furniture" : "tab_glass"),
    kind,
    tag: str(raw, "tag") || defaults.tag,
    title: str(raw, "title") || defaults.title,
    description: str(raw, "description") || str(raw, "desc") || str(raw, "body") || defaults.description,
    icon: str(raw, "icon") || defaults.icon,
    fields: fieldsRaw.length ? fieldsRaw : defaults.fields,
    submitLabel: str(raw, "submitLabel") || undefined,
    successMessage: str(raw, "successMessage") || undefined,
    scope: normalizeFormScopeSnapshot(raw.scope) ?? undefined,
  };
}

export function normalizeQuoteRequestForm(value: unknown): QuoteRequestFormBlockData {
  const rec = isRecord(value) ? value : {};
  const submitLabel = str(rec, "submitLabel", "Verstuur aanvraag");
  const successMessage = str(
    rec,
    "successMessage",
    "Bedankt! We nemen zo snel mogelijk contact op.",
  );
  const heading = str(rec, "heading") || undefined;
  const description = str(rec, "description") || str(rec, "body") || undefined;

  let tabs: QuoteRequestFormTab[] = [];
  if (Array.isArray(rec.tabs) && rec.tabs.length > 0) {
    for (let i = 0; i < rec.tabs.length; i++) {
      const tab = normalizeQuoteTab(rec.tabs[i], i);
      if (tab) tabs.push(tab);
    }
  }

  // Legacy enabledScopes / defaultScope → two factory tabs when tabs missing.
  if (!tabs.length) {
    const scopesRaw = Array.isArray(rec.enabledScopes) ? rec.enabledScopes : [];
    const scopes = scopesRaw.filter(
      (s): s is QuoteScopeId => s === "glass_cleaning" || s === "furniture_cleaning",
    );
    const factory = createDefaultQuoteRequestForm();
    if (scopes.length) {
      tabs = factory.tabs.filter((t) =>
        scopes.some((s) => legacyScopeToKind(s) === t.kind),
      );
      if (!tabs.length) tabs = factory.tabs;
    } else {
      tabs = factory.tabs;
    }
  }

  const defaultTabId =
    str(rec, "defaultTabId") ||
    (rec.defaultScope === "furniture_cleaning"
      ? tabs.find((t) => t.kind === "furniture_cleaning")?.id
      : tabs[0]?.id) ||
    tabs[0]?.id;

  const data: QuoteRequestFormBlockData = {
    heading,
    description,
    tabs,
    defaultTabId,
    submitLabel,
    successMessage,
  };
  return quoteRequestFormSchema.safeParse(data).success
    ? data
    : createDefaultQuoteRequestForm();
}

export function quoteFormKindForTab(tab: QuoteRequestFormTab): QuoteFormKind {
  return tab.kind;
}

export const quoteRequestFormDefinition = def({
  type: "quoteRequestForm",
  label: "Offerteformulier",
  category: "Conversion",
  description:
    "Multi-tab offerteformulier met bewerkbare velden per tab (zelfde veld-editor als contactformulier).",
  dataVersion: 2,
  schema: quoteRequestFormSchema,
  createDefault: createDefaultQuoteRequestForm,
  normalize: normalizeQuoteRequestForm,
  capabilities: { duplicable: false, removable: true, publishable: true },
  getSummary: (data) => {
    const d = normalizeQuoteRequestForm(data);
    return `${d.tabs.length} tab${d.tabs.length === 1 ? "" : "s"}`;
  },
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
  eyebrow?: string;
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
  eyebrow: z.string().optional(),
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
  const eyebrow = str(rec, "eyebrow") || undefined;
  const data: LegalArticlesBlockData = {
    ...(eyebrow ? { eyebrow } : {}),
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
