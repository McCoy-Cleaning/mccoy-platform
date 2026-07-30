import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";

/**
 * Canonical form source identity — never use a migration block UUID as identity.
 */
export type CanonicalFormSourceKey =
  | "builtin:contact:primary"
  | "builtin:offerte:primary"
  | "builtin:vacatures:application";

export type FormSourceFormType = "contact" | "quote_request" | "job_application";

export type FormSource = {
  sourceKey: CanonicalFormSourceKey;
  /** Current layout binding only — not historical identity. */
  blockId: string;
  pageKey: string;
  formType: FormSourceFormType;
};

export const CANONICAL_FORM_SOURCE_KEYS = {
  contact: "builtin:contact:primary",
  offerte: "builtin:offerte:primary",
  vacatures: "builtin:vacatures:application",
} as const satisfies Record<string, CanonicalFormSourceKey>;

/** Legacy fixed aliases → canonical sourceKey. */
export const LEGACY_FORM_SOURCE_ALIASES: Record<string, CanonicalFormSourceKey> = {
  [FIXED_FORM_SOURCE_IDS.contactForm]: CANONICAL_FORM_SOURCE_KEYS.contact,
  [FIXED_FORM_SOURCE_IDS.offerteForm]: CANONICAL_FORM_SOURCE_KEYS.offerte,
  [FIXED_FORM_SOURCE_IDS.vacaturesApplication]: CANONICAL_FORM_SOURCE_KEYS.vacatures,
  // Also accept canonical keys as identity.
  [CANONICAL_FORM_SOURCE_KEYS.contact]: CANONICAL_FORM_SOURCE_KEYS.contact,
  [CANONICAL_FORM_SOURCE_KEYS.offerte]: CANONICAL_FORM_SOURCE_KEYS.offerte,
  [CANONICAL_FORM_SOURCE_KEYS.vacatures]: CANONICAL_FORM_SOURCE_KEYS.vacatures,
};

export function resolveCanonicalFormSourceKey(
  sourceId: string,
): CanonicalFormSourceKey | null {
  const trimmed = sourceId.trim();
  return LEGACY_FORM_SOURCE_ALIASES[trimmed] ?? null;
}

export function formTypeForSourceKey(key: CanonicalFormSourceKey): FormSourceFormType {
  switch (key) {
    case "builtin:contact:primary":
      return "contact";
    case "builtin:offerte:primary":
      return "quote_request";
    case "builtin:vacatures:application":
      return "job_application";
  }
}

export function pageKeyForSourceKey(key: CanonicalFormSourceKey): string {
  switch (key) {
    case "builtin:contact:primary":
      return "contact";
    case "builtin:offerte:primary":
      return "offerte";
    case "builtin:vacatures:application":
      return "vacatures";
  }
}
