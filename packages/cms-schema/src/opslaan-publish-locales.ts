/**
 * Decide which locales Opslaan & publiceren should push live.
 *
 * NL is always published. EN is included when it is already live (republish
 * overlays) OR when the page has EN draft overlays — first go-live no longer
 * requires a separate “Publiceer EN” click.
 */
export function decideOpslaanPublishedLocales(input: {
  localEnPublished: boolean;
  serverEnPublished: boolean;
  hasEnDraftKeys: boolean;
}): Array<"nl" | "en"> {
  const publishedLocales: Array<"nl" | "en"> = ["nl"];
  if (input.localEnPublished || input.serverEnPublished || input.hasEnDraftKeys) {
    publishedLocales.push("en");
  }
  return publishedLocales;
}

export function opslaanSuccessToastTitle(publishedLocales: ReadonlyArray<"nl" | "en">): string {
  return publishedLocales.includes("en") ? "NL + EN gepubliceerd" : "Opgeslagen.";
}
