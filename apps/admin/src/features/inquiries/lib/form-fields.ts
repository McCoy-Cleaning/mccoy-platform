/** Long-text fields that collapse when over the character threshold. */
export const COLLAPSE_FIELD_KEYS = new Set(["motivation", "letter"]);
export const COLLAPSE_CHAR_THRESHOLD = 220;

/** Long-text fields stay full-width with readable spacing; scalars use the compact grid. */
export const FULL_WIDTH_FIELD_KEYS = new Set(["message", "motivation", "letter", "description"]);

/**
 * Contact fields already shown in the Aanvragen detail header ("Antwoord naar" /
 * telefoon). Omit them from "Ingevulde gegevens" so they are not duplicated.
 */
export const HEADER_CONTACT_FIELD_KEYS = new Set(["email", "phone"]);

export function isFullWidthFormField(fieldKey: string): boolean {
  return FULL_WIDTH_FIELD_KEYS.has(fieldKey);
}

export function isHeaderContactFormField(fieldKey: string): boolean {
  return HEADER_CONTACT_FIELD_KEYS.has(fieldKey);
}

export function shouldCollapseFormField(fieldKey: string, value: string): boolean {
  return COLLAPSE_FIELD_KEYS.has(fieldKey) && value.trim().length > COLLAPSE_CHAR_THRESHOLD;
}

export function collapseFormFieldPreview(value: string): string {
  return value.trim().slice(0, COLLAPSE_CHAR_THRESHOLD).trimEnd();
}
