/**
 * Presentation helpers for the admin overview "Website bezoekers" tile.
 * Distinguishes missing env vs configured-but-failed — names only, no secrets.
 */

export type WebsiteVisitorsTileStatus = "ok" | "not_configured" | "failed";

export type WebsiteVisitorsTileCopy = {
  delta: string;
  deltaTone: "up" | "down" | "neutral" | "pending";
  hint: string | null;
};

export const WEBSITE_VISITORS_HINT_NOT_FOUND =
  "Vercel-token ziet het storefront-project niet. Gebruik een team-token en het prj_ van www.mccoy.nl.";

export const WEBSITE_VISITORS_HINT_FORBIDDEN =
  "Vercel-token heeft geen leesrechten op Web Analytics.";

export const WEBSITE_VISITORS_HINT_FAILED =
  "Vercel Web Analytics API mislukt (token, team of storefront-project).";

/** Safe 404/403 codes from the Web Analytics fetch — no secrets. */
export function websiteVisitorsFailedHint(errorCode?: string | null): string {
  const code = (errorCode ?? "").trim().toLowerCase();
  if (code === "not_found" || code === "404") return WEBSITE_VISITORS_HINT_NOT_FOUND;
  if (code === "forbidden" || code === "403") return WEBSITE_VISITORS_HINT_FORBIDDEN;
  return WEBSITE_VISITORS_HINT_FAILED;
}

export function websiteVisitorsUnavailableCopy(
  status: Exclude<WebsiteVisitorsTileStatus, "ok">,
  missingEnv: string[] = [],
  errorCode?: string | null,
): WebsiteVisitorsTileCopy {
  if (status === "failed") {
    return {
      delta: "niet beschikbaar",
      deltaTone: "pending",
      hint: websiteVisitorsFailedHint(errorCode),
    };
  }
  const names = missingEnv.filter((name) => typeof name === "string" && name.trim());
  const listed =
    names.length > 0 ? names.join(", ") : "VERCEL_TOKEN, VERCEL_WEB_ANALYTICS_PROJECT_ID";
  return {
    delta: "niet gekoppeld",
    deltaTone: "pending",
    hint: `Ontbrekende env: ${listed}`,
  };
}
