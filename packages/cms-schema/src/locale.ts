/**
 * Locale, publication, and translation-freshness primitives for bilingual CMS.
 * Phase A — types only; public SEO runtime is Phase C after persistence (Phase B).
 */

export type Locale = "nl" | "en";

export const LOCALES: readonly Locale[] = ["nl", "en"] as const;

export type LocalePublicationState =
  | "missing"
  | "draft"
  | "review"
  | "approved"
  | "published"
  | "archived";

export type TranslationFreshness = "current" | "stale" | "unknown";

/** Per-locale bag — NL is required source of truth; EN optional until drafted. */
export type Localized<T> = {
  nl: T;
  en?: T;
};

export type LocaleState = {
  publicationState: LocalePublicationState;
  freshness: TranslationFreshness;
};

export type CmsRevisionStatus =
  | "draft"
  | "review"
  | "published"
  | "superseded"
  | "archived";

/**
 * Provenance for one editable unit (page SEO, intro, section, or block).
 * Publication and freshness are separate dimensions.
 */
export type TranslationMetadata = {
  sourceLocale: "nl";
  targetLocale: "en";
  sourceHash: string;
  sourceRevision: number;
  publicationState: LocalePublicationState;
  freshness: TranslationFreshness;
  generatedBy: "human" | "groq" | "import";
  model?: string;
  promptVersion?: string;
  generatedAt?: string;
  generatedByUserId?: string;
  approvedAt?: string;
  approvedByUserId?: string;
  lastComparedAt?: string;
};

export function emptyLocalized<T>(nl: T): Localized<T> {
  return { nl };
}

export function getLocalized<T>(value: Localized<T>, locale: Locale): T | undefined {
  if (locale === "nl") return value.nl;
  return value.en;
}

export function requireLocalized<T>(value: Localized<T>, locale: Locale): T {
  const found = getLocalized(value, locale);
  if (found !== undefined) return found;
  throw new Error(`Missing localized value for locale "${locale}"`);
}

export function setLocalized<T>(value: Localized<T>, locale: Locale, next: T): Localized<T> {
  if (locale === "nl") return { ...value, nl: next };
  return { ...value, en: next };
}

export function defaultLocaleState(locale: Locale): LocaleState {
  if (locale === "nl") {
    return { publicationState: "published", freshness: "current" };
  }
  return { publicationState: "missing", freshness: "unknown" };
}

export function defaultLocaleStates(): Localized<LocaleState> {
  return {
    nl: defaultLocaleState("nl"),
    en: defaultLocaleState("en"),
  };
}

export function missingEnglishTranslationMeta(sourceRevision = 1): TranslationMetadata {
  return {
    sourceLocale: "nl",
    targetLocale: "en",
    sourceHash: "",
    sourceRevision,
    publicationState: "missing",
    freshness: "unknown",
    generatedBy: "import",
  };
}

/** Stable hash input helper — callers pass JSON-serializable NL source. */
export function hashSourcePayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function isLocalePubliclyRoutable(state: LocaleState | undefined): boolean {
  return state?.publicationState === "published";
}
