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

export function websiteVisitorsUnavailableCopy(
  status: Exclude<WebsiteVisitorsTileStatus, "ok">,
  missingEnv: string[] = [],
): WebsiteVisitorsTileCopy {
  if (status === "failed") {
    return {
      delta: "niet beschikbaar",
      deltaTone: "pending",
      hint: "Vercel Web Analytics API mislukt (token, team of storefront-project).",
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
