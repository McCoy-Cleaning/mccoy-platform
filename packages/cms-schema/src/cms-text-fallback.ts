/**
 * Prefer localized catalog copy when CMS text is empty or still a factory
 * Dutch default (i.e. not editor-customized). Custom CMS strings stay as-is
 * (single-locale until bilingual CMS exists).
 *
 * `factoryDefault` may be a single string or a list (current + legacy factory
 * strings) so Phase 6 SEO heading redeploys still localize without a CMS republish.
 */
export function cmsTextOrFallback(
  cmsValue: string | undefined | null,
  fallback: string,
  factoryDefault?: string | null | readonly string[],
): string {
  if (cmsValue == null || cmsValue === "") return fallback;
  const defaults =
    factoryDefault == null || factoryDefault === ""
      ? []
      : typeof factoryDefault === "string"
        ? [factoryDefault]
        : [...factoryDefault].filter((d) => d != null && d !== "");
  if (defaults.includes(cmsValue)) return fallback;
  return cmsValue;
}
