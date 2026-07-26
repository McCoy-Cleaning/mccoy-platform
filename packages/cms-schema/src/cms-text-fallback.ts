/**
 * Prefer localized catalog copy when CMS text is empty or still the factory
 * Dutch default (i.e. not editor-customized). Custom CMS strings stay as-is
 * (single-locale until bilingual CMS exists).
 */
export function cmsTextOrFallback(
  cmsValue: string | undefined | null,
  fallback: string,
  factoryDefault?: string | null,
): string {
  if (cmsValue == null || cmsValue === "") return fallback;
  if (factoryDefault != null && factoryDefault !== "" && cmsValue === factoryDefault) {
    return fallback;
  }
  return cmsValue;
}
