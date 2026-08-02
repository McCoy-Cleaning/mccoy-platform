import { z } from "zod";
import { createItemId } from "../content";
import { cmsLinkSchema, isActionableCmsLink, linkFromLegacyHref, parseCmsLink } from "../links";
import { newBlockLayoutItem } from "../layout";
import type { Block, BuiltinCmsPage, CmsLink, CmsPage } from "../types";
import type { CmsBlockDataDefinition } from "./definition";
import type { PublishValidationError } from "./validation-codes";
import { PUBLISH_VALIDATION_CODES } from "./validation-codes";

export const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "temporary",
  "freelance",
  "internship",
  "on-call",
  "other",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS_NL: Record<EmploymentType, string> = {
  "full-time": "Fulltime",
  "part-time": "Parttime",
  temporary: "Tijdelijk",
  freelance: "Freelance",
  internship: "Stage",
  "on-call": "Oproep",
  other: "Overig",
};

export type VacancyHoursPerWeek = {
  minimum?: number;
  maximum?: number;
};

export type VacancyHourlyRate = {
  minimum?: number;
  maximum?: number;
  currency: "EUR";
  period: "hour";
  showOnWebsite: boolean;
};

export type VacancyItem = {
  id: string;
  title: string;
  slug?: string;
  department?: string;
  location: string;
  employmentType: EmploymentType;
  hoursPerWeek?: VacancyHoursPerWeek;
  hourlyRate?: VacancyHourlyRate;
  salaryText?: string;
  shortDescription: string;
  fullDescription?: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  startDate?: string;
  applicationDeadline?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  applicationLink: CmsLink;
  buttonLabel: string;
  featured?: boolean;
  visible: boolean;
};

export type JobsBlockData = {
  heading: string;
  introduction?: string;
  displayMode: "cards" | "list";
  showFilters?: boolean;
  emptyStateText?: string;
  vacancies: VacancyItem[];
};

/** @deprecated Prefer VacancyItem — kept for migration typing. */
export type JobItem = {
  id: string;
  title: string;
  department?: string;
  location?: string;
  type?: string;
  applyLink?: CmsLink;
};

const MAX_WEEKLY_HOURS = 60;
const MAX_HOURLY_RATE_EUR = 500;

function str(rec: Record<string, unknown>, key: string, fallback = ""): string {
  return typeof rec[key] === "string" ? (rec[key] as string) : fallback;
}

function bool(rec: Record<string, unknown>, key: string, fallback = false): boolean {
  return typeof rec[key] === "boolean" ? (rec[key] as boolean) : fallback;
}

function optNumber(rec: Record<string, unknown>, key: string): number | undefined {
  const v = rec[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function stringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return items.length ? items : undefined;
}

function mapEmploymentType(raw: string | undefined): EmploymentType {
  if (!raw) return "full-time";
  const n = raw.trim().toLowerCase();
  if (EMPLOYMENT_TYPES.includes(n as EmploymentType)) return n as EmploymentType;
  if (n.includes("full") || n.includes("voltijd")) return "full-time";
  if (n.includes("part") || n.includes("deeltijd")) return "part-time";
  if (n.includes("stage") || n.includes("intern")) return "internship";
  if (n.includes("oproep") || n.includes("on-call") || n.includes("on call")) return "on-call";
  if (n.includes("freelance") || n.includes("zzp")) return "freelance";
  if (n.includes("tijdelijk") || n.includes("temp") || n.includes("contract")) return "temporary";
  return "other";
}

const hoursSchema = z
  .object({
    minimum: z.number().min(0).max(MAX_WEEKLY_HOURS).optional(),
    maximum: z.number().min(0).max(MAX_WEEKLY_HOURS).optional(),
  })
  .superRefine((h, ctx) => {
    if (
      typeof h.minimum === "number" &&
      typeof h.maximum === "number" &&
      h.minimum > h.maximum
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum uren mag niet hoger zijn dan maximum uren",
        path: ["minimum"],
      });
    }
  });

const hourlyRateSchema = z
  .object({
    minimum: z.number().min(0).max(MAX_HOURLY_RATE_EUR).optional(),
    maximum: z.number().min(0).max(MAX_HOURLY_RATE_EUR).optional(),
    currency: z.literal("EUR"),
    period: z.literal("hour"),
    showOnWebsite: z.boolean(),
  })
  .superRefine((r, ctx) => {
    if (
      typeof r.minimum === "number" &&
      typeof r.maximum === "number" &&
      r.minimum > r.maximum
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum tarief mag niet hoger zijn dan maximum tarief",
        path: ["minimum"],
      });
    }
  });

export const vacancyItemSchema: z.ZodType<VacancyItem> = z.object({
  id: z.string().min(1),
  title: z.string(),
  slug: z.string().optional(),
  department: z.string().optional(),
  location: z.string(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  hoursPerWeek: hoursSchema.optional(),
  hourlyRate: hourlyRateSchema.optional(),
  salaryText: z.string().optional(),
  shortDescription: z.string(),
  fullDescription: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  applicationDeadline: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  applicationLink: cmsLinkSchema,
  buttonLabel: z.string().min(1),
  featured: z.boolean().optional(),
  visible: z.boolean(),
});

export const jobsBlockSchema: z.ZodType<JobsBlockData> = z.object({
  heading: z.string(),
  introduction: z.string().optional(),
  displayMode: z.enum(["cards", "list"]),
  showFilters: z.boolean().optional(),
  emptyStateText: z.string().optional(),
  vacancies: z.array(vacancyItemSchema),
});

export function createDefaultVacancy(partial?: Partial<VacancyItem>): VacancyItem {
  const title = partial?.title ?? "Nieuwe vacature";
  return {
    id: partial?.id && partial.id.trim() ? partial.id : createItemId("job"),
    title,
    department: partial?.department,
    location: partial?.location ?? "",
    employmentType: partial?.employmentType ?? "full-time",
    hoursPerWeek: partial?.hoursPerWeek,
    hourlyRate: partial?.hourlyRate,
    salaryText: partial?.salaryText,
    shortDescription: partial?.shortDescription ?? "",
    fullDescription: partial?.fullDescription,
    responsibilities: partial?.responsibilities,
    requirements: partial?.requirements,
    benefits: partial?.benefits,
    startDate: partial?.startDate,
    applicationDeadline: partial?.applicationDeadline,
    contactName: partial?.contactName,
    contactEmail: partial?.contactEmail,
    contactPhone: partial?.contactPhone,
    applicationLink: partial?.applicationLink ?? { type: "none" },
    buttonLabel: partial?.buttonLabel ?? "Solliciteer",
    featured: partial?.featured ?? false,
    visible: partial?.visible ?? true,
    slug: partial?.slug?.trim() || slugifyVacancyTitle(title) || undefined,
  };
}

/** URL-safe slug from vacancy title (NL-friendly). */
export function slugifyVacancyTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Public path segment for `/vacatures/$slug`. */
export function resolveVacancyPublicSlug(
  vacancy: Pick<VacancyItem, "id" | "title" | "slug">,
): string {
  const explicit = vacancy.slug?.trim();
  if (explicit) return explicit;
  const fromTitle = slugifyVacancyTitle(vacancy.title);
  return fromTitle || vacancy.id;
}

export function createDefaultJobs(): JobsBlockData {
  return {
    heading: "Vacatures",
    introduction: "",
    displayMode: "cards",
    showFilters: false,
    emptyStateText: "Er zijn momenteel geen openstaande vacatures.",
    // Default starts empty-visible so a fresh jobs section is publishable;
    // admins add vacancies explicitly.
    vacancies: [],
  };
}

/** Stable ids for default vacatures seed — must not use random createItemId. */
export const VACATURES_SEED_VACANCY_IDS = {
  reguliereSchoonmaak: "job_seed_reguliere-schoonmaak",
  glazenwasser: "job_seed_glazenwasser",
  oproepkracht: "job_seed_oproepkracht",
} as const;

/** Seed vacancies matching historical i18n roles on /vacatures. */
export function createVacaturesSeedJobs(): JobsBlockData {
  return {
    heading: "Openstaande vacatures",
    introduction: "Word onderdeel van een vast eigen team.",
    displayMode: "cards",
    showFilters: false,
    emptyStateText: "Er zijn momenteel geen openstaande vacatures.",
    vacancies: [
      createDefaultVacancy({
        id: VACATURES_SEED_VACANCY_IDS.reguliereSchoonmaak,
        title: "Reguliere schoonmaak",
        slug: "reguliere-schoonmaak",
        department: "Operations",
        location: "Twente",
        employmentType: "full-time",
        shortDescription:
          "Voor onze vaste schoonmaakrondes bij kantoren en bedrijven zoeken wij medewerkers die oog hebben voor detail en plezier hebben in hun werk.",
        applicationLink: { type: "none" },
        buttonLabel: "Solliciteer",
      }),
      createDefaultVacancy({
        id: VACATURES_SEED_VACANCY_IDS.glazenwasser,
        title: "Glazenwasser",
        slug: "glazenwasser",
        department: "Operations",
        location: "Twente",
        employmentType: "full-time",
        shortDescription:
          "Werk in een hecht team aan glasbewassing en gevelreiniging. Ervaring is een pre, motivatie een must.",
        applicationLink: { type: "none" },
      }),
      createDefaultVacancy({
        id: VACATURES_SEED_VACANCY_IDS.oproepkracht,
        title: "Oproepkracht",
        slug: "oproepkracht",
        department: "Operations",
        location: "Twente",
        employmentType: "on-call",
        shortDescription:
          "Flexibel inzetbaar voor opleveringen en specialistische projecten — ideaal voor wie variatie zoekt.",
        applicationLink: { type: "none" },
      }),
    ],
  };
}

function normalizeApplicationLink(row: Record<string, unknown>): CmsLink {
  if (row.applicationLink && typeof row.applicationLink === "object") {
    return parseCmsLink(row.applicationLink) ?? { type: "none" };
  }
  if (row.applyLink && typeof row.applyLink === "object") {
    return parseCmsLink(row.applyLink) ?? { type: "none" };
  }
  if (typeof row.applyUrl === "string") {
    return linkFromLegacyHref(row.applyUrl) ?? { type: "none" };
  }
  return { type: "none" };
}

function normalizeVacancy(row: Record<string, unknown>, id: string): VacancyItem {
  const hoursRaw =
    row.hoursPerWeek && typeof row.hoursPerWeek === "object"
      ? (row.hoursPerWeek as Record<string, unknown>)
      : null;
  const rateRaw =
    row.hourlyRate && typeof row.hourlyRate === "object"
      ? (row.hourlyRate as Record<string, unknown>)
      : null;

  const employmentType =
    typeof row.employmentType === "string"
      ? mapEmploymentType(row.employmentType)
      : mapEmploymentType(typeof row.type === "string" ? row.type : undefined);

  return createDefaultVacancy({
    id,
    title: str(row, "title", "Vacature"),
    slug: str(row, "slug") || slugifyVacancyTitle(str(row, "title", "Vacature")) || undefined,
    department: str(row, "department") || undefined,
    location: str(row, "location"),
    employmentType,
    hoursPerWeek: hoursRaw
      ? {
          minimum: optNumber(hoursRaw, "minimum"),
          maximum: optNumber(hoursRaw, "maximum"),
        }
      : undefined,
    hourlyRate: rateRaw
      ? {
          minimum: optNumber(rateRaw, "minimum"),
          maximum: optNumber(rateRaw, "maximum"),
          currency: "EUR",
          period: "hour",
          showOnWebsite: bool(rateRaw, "showOnWebsite", true),
        }
      : undefined,
    salaryText: str(row, "salaryText") || undefined,
    shortDescription: str(row, "shortDescription"),
    fullDescription: str(row, "fullDescription") || undefined,
    responsibilities: stringList(row.responsibilities),
    requirements: stringList(row.requirements),
    benefits: stringList(row.benefits),
    startDate: str(row, "startDate") || undefined,
    applicationDeadline: str(row, "applicationDeadline") || undefined,
    contactName: str(row, "contactName") || undefined,
    contactEmail: str(row, "contactEmail") || undefined,
    contactPhone: str(row, "contactPhone") || undefined,
    applicationLink: normalizeApplicationLink(row),
    buttonLabel: str(row, "buttonLabel", "Solliciteer") || "Solliciteer",
    featured: bool(row, "featured", false),
    visible: typeof row.visible === "boolean" ? row.visible : true,
  });
}

/**
 * Normalize v1 `{ title, jobs: [{ title, type, applyLink, … }] }` and v2 payloads.
 * Idempotent — do not invent rates, hours, or descriptions.
 */
export function normalizeJobs(value: unknown): JobsBlockData {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawList = Array.isArray(rec.vacancies)
    ? rec.vacancies
    : Array.isArray(rec.jobs)
      ? rec.jobs
      : [];

  const vacancies = rawList.map((entry) => {
    const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const id = typeof row.id === "string" && row.id ? row.id : createItemId("job");
    return normalizeVacancy(row, id);
  });

  const data: JobsBlockData = {
    heading: str(rec, "heading") || str(rec, "title", "Vacatures"),
    introduction: str(rec, "introduction") || undefined,
    displayMode: rec.displayMode === "list" ? "list" : "cards",
    showFilters: bool(rec, "showFilters", false),
    emptyStateText: str(rec, "emptyStateText") || undefined,
    vacancies,
  };

  const parsed = jobsBlockSchema.safeParse(data);
  return parsed.success ? parsed.data : { ...createDefaultJobs(), vacancies };
}

/** Dutch formatting: € 15,00 – € 18,00 per uur */
export function formatHourlyRateNl(rate: VacancyHourlyRate | undefined): string | null {
  if (!rate || !rate.showOnWebsite) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
  const min = rate.minimum;
  const max = rate.maximum;
  if (typeof min === "number" && typeof max === "number") {
    if (min === max) return `${fmt(min)} per uur`;
    return `${fmt(min)} – ${fmt(max)} per uur`;
  }
  if (typeof min === "number") return `${fmt(min)} per uur`;
  if (typeof max === "number") return `${fmt(max)} per uur`;
  return null;
}

export function formatHoursPerWeekNl(hours: VacancyHoursPerWeek | undefined): string | null {
  if (!hours) return null;
  const min = hours.minimum;
  const max = hours.maximum;
  if (typeof min === "number" && typeof max === "number") {
    if (min === max) return `${min} uur per week`;
    return `${min}–${max} uur per week`;
  }
  if (typeof min === "number") return `vanaf ${min} uur per week`;
  if (typeof max === "number") return `tot ${max} uur per week`;
  return null;
}

export function jobsSummary(data: unknown): string {
  const normalized = normalizeJobs(data);
  const visible = normalized.vacancies.filter((v) => v.visible).length;
  const total = normalized.vacancies.length;
  const heading = normalized.heading || "Vacatures";
  return `${heading} · ${visible}/${total} zichtbaar · ${normalized.displayMode === "list" ? "lijst" : "kaarten"}`;
}

/** Publish-time checks for visible vacancies (drafts may be incomplete). */
export function validateJobsForPublishErrors(
  data: unknown,
  blockId = "jobs",
): PublishValidationError[] {
  const jobs = normalizeJobs(data);
  const errors: PublishValidationError[] = [];
  jobs.vacancies.forEach((v, index) => {
    if (!v.visible) return;
    const pathBase: Array<string | number> = [blockId, "vacancies", index];
    if (!v.title.trim()) {
      errors.push({
        code: PUBLISH_VALIDATION_CODES.JOBS_TITLE_REQUIRED,
        path: [...pathBase, "title"],
        blockType: "jobs",
      });
    }
    if (!v.location.trim()) {
      errors.push({
        code: PUBLISH_VALIDATION_CODES.JOBS_LOCATION_REQUIRED,
        path: [...pathBase, "location"],
        blockType: "jobs",
      });
    }
    if (!v.shortDescription.trim()) {
      errors.push({
        code: PUBLISH_VALIDATION_CODES.JOBS_DESCRIPTION_REQUIRED,
        path: [...pathBase, "shortDescription"],
        blockType: "jobs",
      });
    }
    if (v.applicationLink.type !== "none" && !isActionableCmsLink(v.applicationLink)) {
      errors.push({
        code: PUBLISH_VALIDATION_CODES.JOBS_APPLICATION_LINK_INVALID,
        path: [...pathBase, "applicationLink"],
        blockType: "jobs",
      });
    }
    if (v.hoursPerWeek) {
      const { minimum, maximum } = v.hoursPerWeek;
      if (
        (typeof minimum === "number" && minimum < 0) ||
        (typeof maximum === "number" && maximum > MAX_WEEKLY_HOURS) ||
        (typeof minimum === "number" && typeof maximum === "number" && minimum > maximum)
      ) {
        errors.push({
          code: PUBLISH_VALIDATION_CODES.JOBS_HOURS_INVALID,
          path: [...pathBase, "hoursPerWeek"],
          blockType: "jobs",
        });
      }
    }
    if (v.hourlyRate) {
      const { minimum, maximum } = v.hourlyRate;
      if (
        (typeof minimum === "number" && minimum < 0) ||
        (typeof minimum === "number" && typeof maximum === "number" && minimum > maximum)
      ) {
        errors.push({
          code: PUBLISH_VALIDATION_CODES.JOBS_RATE_INVALID,
          path: [...pathBase, "hourlyRate"],
          blockType: "jobs",
        });
      }
    }
  });
  return errors;
}

/** @deprecated Prefer {@link validateJobsForPublishErrors}. */
export function validateJobsForPublish(data: unknown): string[] {
  return validateJobsForPublishErrors(data).map((e) => {
    switch (e.code) {
      case PUBLISH_VALIDATION_CODES.JOBS_TITLE_REQUIRED:
        return "Vacature: titel is verplicht";
      case PUBLISH_VALIDATION_CODES.JOBS_LOCATION_REQUIRED:
        return "Vacature: locatie is verplicht";
      case PUBLISH_VALIDATION_CODES.JOBS_DESCRIPTION_REQUIRED:
        return "Vacature: korte beschrijving is verplicht";
      case PUBLISH_VALIDATION_CODES.JOBS_APPLICATION_LINK_INVALID:
        return "Vacature: sollicitatiebestemming is ongeldig";
      case PUBLISH_VALIDATION_CODES.JOBS_HOURS_INVALID:
        return "Vacature: minimum uren mag niet hoger zijn dan maximum";
      case PUBLISH_VALIDATION_CODES.JOBS_RATE_INVALID:
        return "Vacature: minimum tarief mag niet hoger zijn dan maximum";
      default:
        return e.message ?? String(e.code);
    }
  });
}

/** Deep-clone vacancies with fresh ids (section duplicate). */
export function cloneJobsDataWithNewIds(data: JobsBlockData): JobsBlockData {
  return {
    ...data,
    vacancies: data.vacancies.map((v) => ({
      ...v,
      id: createItemId("job"),
      responsibilities: v.responsibilities ? [...v.responsibilities] : undefined,
      requirements: v.requirements ? [...v.requirements] : undefined,
      benefits: v.benefits ? [...v.benefits] : undefined,
    })),
  };
}

export const jobsDefinition = {
  type: "jobs",
  label: "Vacatures",
  category: "Recruitment",
  dataVersion: 3,
  schema: jobsBlockSchema,
  createDefault: createDefaultJobs,
  normalize: normalizeJobs,
  capabilities: { duplicable: true, removable: true, publishable: true },
  getSummary: jobsSummary,
} as const satisfies CmsBlockDataDefinition<"jobs", JobsBlockData>;

/**
 * Observable legacy fallback when the vacatures page has no jobs block.
 * REMOVAL CRITERIA: all environments seeded/migrated + one production publish
 * cycle with exactly-one jobs policy enforced — then delete this helper and
 * storefront callers that use t.jobs.roles when the block is missing.
 *
 * Local/default seeds always get a jobs block via ensureVacaturesJobsBlock.
 * Keep the fallback behind MCCOY_ALLOW_LEGACY_VACANCY_FALLBACK=1 for older envs.
 */
export function warnLegacyVacancyFallback(pageId: string): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(
      `[cms] legacy vacancy fallback active for ${pageId}: no jobs block; using static roles. Remove after vacatures jobs seed + publish cycle.`,
    );
  }
}

/** Whether storefront may fall back to static i18n roles when no jobs block exists. */
export function allowLegacyVacancyFallback(): boolean {
  if (typeof process === "undefined") return false;
  const raw =
    process.env.MCCOY_ALLOW_LEGACY_VACANCY_FALLBACK ??
    process.env.VITE_ALLOW_LEGACY_VACANCY_FALLBACK ??
    "";
  return raw === "1" || raw.toLowerCase() === "true";
}

/**
 * Ensure a vacatures builtin page carries a jobs block with seeded roles.
 * Idempotent — does not overwrite an existing jobs block’s vacancy data.
 *
 * The jobs block powers the application form (and /vacatures/$slug). The public
 * listing UI is optional and starts hidden — it was previously seeded visible,
 * which duplicated the form’s role picker on /vacatures.
 */
export function ensureVacaturesJobsBlock(page: CmsPage): CmsPage {
  if (page.kind !== "builtin" || page.pageKey !== "vacatures") return page;

  if (!page.blocks.some((b) => b.type === "jobs")) {
    const block: Block = {
      id: createItemId("block"),
      type: "jobs",
      data: JSON.parse(JSON.stringify(createVacaturesSeedJobs())) as Record<string, unknown>,
      // v3: public listing starts hidden (see migration below).
      dataVersion: 3,
    };
    const next = structuredClone(page) as BuiltinCmsPage;
    next.blocks = [...next.blocks, block];
    next.layout = [...next.layout, { ...newBlockLayoutItem(block.id), hidden: true }];
    return next;
  }

  // One-shot v2 → v3: hide the public listing. Vacancy data is unchanged.
  // After this, admins may unhide the section in the page builder; we do not re-hide.
  let changed = false;
  const next = structuredClone(page) as BuiltinCmsPage;
  const jobsIds = new Set<string>();
  next.blocks = next.blocks.map((b) => {
    if (b.type !== "jobs") return b;
    jobsIds.add(b.id);
    const ver = typeof b.dataVersion === "number" ? b.dataVersion : 1;
    if (ver >= 3) return b;
    changed = true;
    return { ...b, dataVersion: 3 };
  });
  if (!changed) return page;

  next.layout = next.layout.map((item) => {
    if (item.kind === "block" && jobsIds.has(item.blockId) && !item.hidden) {
      return { ...item, hidden: true };
    }
    return item;
  });
  return next;
}
