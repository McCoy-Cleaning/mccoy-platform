/**
 * Staff-facing form field visibility — internal vacancy correlation keys must not
 * duplicate the human-readable `role` / Functie row in email or Aanvragen detail.
 */
export const INTERNAL_VACANCY_FIELD_KEYS = [
  "vacancyId",
  "vacancySlug",
  "vacancyTitleSnapshot",
] as const;

export type InternalVacancyFieldKey = (typeof INTERNAL_VACANCY_FIELD_KEYS)[number];

export function isInternalVacancyFieldKey(key: string): key is InternalVacancyFieldKey {
  return (INTERNAL_VACANCY_FIELD_KEYS as readonly string[]).includes(key);
}

/**
 * Fields safe for staff notification email bodies and Aanvragen "Ingevulde gegevens".
 * Keeps `role` (Functie); drops slug/id/snapshot duplicates. Legacy mail with only
 * `vacancyTitleSnapshot` is promoted to `role`.
 */
export function displayFormFields(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, raw] of Object.entries(fields)) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    out[key] = value;
  }

  const role = out.role?.trim();
  const snapshot = out.vacancyTitleSnapshot?.trim();

  if (!role && snapshot) {
    out.role = snapshot;
  }

  if (out.role?.trim()) {
    for (const key of INTERNAL_VACANCY_FIELD_KEYS) {
      delete out[key];
    }
  } else {
    for (const key of INTERNAL_VACANCY_FIELD_KEYS) {
      if (key !== "vacancyTitleSnapshot") {
        delete out[key];
      }
    }
  }

  return out;
}
