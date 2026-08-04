import {
  PUBLISH_VALIDATION_CODES,
  type PublishValidationCode,
  type PublishValidationError,
  UNPUBLISHABLE_BLOCK_WARNING_NL,
} from "@mccoy/cms-schema";

/**
 * Dutch messages for structured CMS publish validation codes.
 * Schema stays locale-agnostic; admin UI maps codes here.
 */
export const PUBLISH_VALIDATION_MESSAGES_NL: Record<string, string> = {
  [PUBLISH_VALIDATION_CODES.BLOCK_UNPUBLISHABLE]: UNPUBLISHABLE_BLOCK_WARNING_NL,
  [PUBLISH_VALIDATION_CODES.BLOCK_DATA_INVALID]: "Sectiegegevens zijn ongeldig.",
  [PUBLISH_VALIDATION_CODES.HERO_TITLE_REQUIRED]:
    "Titel is verplicht voor publicatie.",
  [PUBLISH_VALIDATION_CODES.ROADMAP_MILESTONE_TITLE_REQUIRED]:
    "Roadmap-mijlpaal heeft een lege titel (jaar is optioneel; titel is verplicht bij publicatie).",
  [PUBLISH_VALIDATION_CODES.PLANS_CTA_INVALID]:
    "Pakket heeft een ongeldige CTA en kan niet worden gepubliceerd.",
  [PUBLISH_VALIDATION_CODES.PLANS_UNKNOWN_FEATURE]: "Pakket verwijst naar een onbekend kenmerk.",
  [PUBLISH_VALIDATION_CODES.BUTTON_LINK_REQUIRED]:
    "Knop: kies een pagina of vul een geldige link in.",
  [PUBLISH_VALIDATION_CODES.BUTTON_POPUP_CONTENT_REQUIRED]:
    "Knop: kies wat er in de popup te zien is.",
  [PUBLISH_VALIDATION_CODES.BUTTON_POPUP_CONTENT_INVALID]:
    "Knop: de popup-inhoud is ongeldig. Controleer de inhoud.",
  [PUBLISH_VALIDATION_CODES.BUTTON_INVALID]: "Knop is ongeldig.",
  [PUBLISH_VALIDATION_CODES.JOBS_TITLE_REQUIRED]: "Vacature: titel is verplicht.",
  [PUBLISH_VALIDATION_CODES.JOBS_LOCATION_REQUIRED]: "Vacature: locatie is verplicht.",
  [PUBLISH_VALIDATION_CODES.JOBS_DESCRIPTION_REQUIRED]:
    "Vacature: korte beschrijving is verplicht.",
  [PUBLISH_VALIDATION_CODES.JOBS_APPLICATION_LINK_INVALID]:
    "Vacature: sollicitatiebestemming is ongeldig.",
  [PUBLISH_VALIDATION_CODES.JOBS_HOURS_INVALID]: "Vacature: uren per week zijn ongeldig.",
  [PUBLISH_VALIDATION_CODES.JOBS_RATE_INVALID]: "Vacature: uurtarief is ongeldig.",
  [PUBLISH_VALIDATION_CODES.VIDEO_URL_INVALID]:
    "Video-URL is ongeldig of de host is niet toegestaan.",
  [PUBLISH_VALIDATION_CODES.VIDEO_TITLE_REQUIRED]: "Video: titel is verplicht.",
  [PUBLISH_VALIDATION_CODES.VIDEO_POSTER_ALT_REQUIRED]:
    "Videoposter: alt-tekst is verplicht (of markeer als decoratief).",
  [PUBLISH_VALIDATION_CODES.BEFORE_AFTER_IMAGE_MISSING]:
    "Voor/na: beide afbeeldingen zijn verplicht.",
  [PUBLISH_VALIDATION_CODES.BEFORE_AFTER_ALT_REQUIRED]:
    "Voor/na: alt-tekst is verplicht (of markeer als decoratief).",
  [PUBLISH_VALIDATION_CODES.GALLERY_EMPTY]: "Galerij: voeg minstens één afbeelding toe.",
  [PUBLISH_VALIDATION_CODES.GALLERY_IMAGE_ALT_REQUIRED]:
    "Galerij: alt-tekst is verplicht (of markeer als decoratief).",
  [PUBLISH_VALIDATION_CODES.CAROUSEL_EMPTY]: "Carousel: voeg minstens één slide toe.",
  [PUBLISH_VALIDATION_CODES.IMAGE_ALT_REQUIRED]:
    "Afbeelding: alt-tekst is verplicht (of markeer als decoratief).",
  [PUBLISH_VALIDATION_CODES.NEWSLETTER_TITLE_REQUIRED]: "Nieuwsbrief: titel is verplicht.",
  [PUBLISH_VALIDATION_CODES.NEWSLETTER_BUTTON_REQUIRED]: "Nieuwsbrief: knoptekst is verplicht.",
  [PUBLISH_VALIDATION_CODES.CONTACT_FORM_TITLE_REQUIRED]: "Contactformulier: titel is verplicht.",
  [PUBLISH_VALIDATION_CODES.CONTACT_FORM_FIELDS_REQUIRED]:
    "Contactformulier: voeg minstens één veld met een label toe.",
  [PUBLISH_VALIDATION_CODES.CONTACT_FORM_NAME_EMAIL_REQUIRED]:
    "Contactformulier: stel bij één veld het type op Naam en bij één veld op E-mail (het label mag afwijken).",
  [PUBLISH_VALIDATION_CODES.CONTACT_FORM_SELECT_OPTIONS_REQUIRED]:
    "Contactformulier: een keuzelijst heeft minstens één optie met een label nodig.",
  [PUBLISH_VALIDATION_CODES.POPUP_TITLE_REQUIRED]: "Popup: titel is verplicht.",
};

export function publishValidationMessageNl(
  code: PublishValidationCode | string,
  fallback?: string,
): string {
  return PUBLISH_VALIDATION_MESSAGES_NL[code] ?? fallback ?? code;
}

export function formatPublishValidationErrorNl(error: PublishValidationError): string {
  const base = publishValidationMessageNl(error.code, error.message);
  const label = error.blockLabel ?? error.blockType;
  if (!label) return base;
  if (error.code === PUBLISH_VALIDATION_CODES.BLOCK_UNPUBLISHABLE) {
    return `Sectie "${label}" (${error.blockType}): ${base}`;
  }
  if (error.code === PUBLISH_VALIDATION_CODES.BLOCK_DATA_INVALID) {
    return `Sectie "${label}" is ongeldig: ${error.message ?? base}`;
  }
  return `Sectie "${label}": ${base}`;
}

/** Map validatePublishableCmsPage issues (code + optional message) to Dutch strings. */
export function formatValidateIssuesNl(
  issues: Array<{
    code: string;
    message: string;
    path?: string;
    blockLabel?: string;
    blockType?: string;
  }>,
): string[] {
  return issues.map((issue) => {
    const mapped = PUBLISH_VALIDATION_MESSAGES_NL[issue.code];
    const sectionLabel = issue.blockLabel ?? issue.blockType;
    const withSection = (body: string) =>
      sectionLabel ? `Sectie "${sectionLabel}": ${body}` : body;

    if (mapped && issue.code !== "INVALID_SECTION_CONTENT") {
      // Prefer NL map when code is a known publish validation code.
      if (issue.message && issue.message !== issue.code && !mapped.includes(issue.message)) {
        // Keep richer schema message when it is already NL (e.g. BLOCK_DATA_INVALID).
        if (issue.code === PUBLISH_VALIDATION_CODES.BLOCK_DATA_INVALID) {
          return withSection(issue.message);
        }
        if (issue.code === PUBLISH_VALIDATION_CODES.BLOCK_UNPUBLISHABLE) {
          return issue.message.includes(UNPUBLISHABLE_BLOCK_WARNING_NL)
            ? issue.message
            : withSection(mapped);
        }
      }
      const path = issue.path ?? "";
      const fieldHint =
        path === "title" || path.endsWith(".title") || path.includes(".title")
          ? " (veld: titel)"
          : "";
      return withSection(`${mapped}${fieldHint}`);
    }
    return withSection(issue.message || issue.code);
  });
}
