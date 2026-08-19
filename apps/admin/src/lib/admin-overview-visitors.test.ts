import { describe, expect, it } from "vitest";
import { websiteVisitorsUnavailableCopy } from "./admin-overview-visitors";

describe("websiteVisitorsUnavailableCopy", () => {
  it("surfaces missing env names only when not configured", () => {
    expect(websiteVisitorsUnavailableCopy("not_configured", ["VERCEL_TOKEN"])).toEqual({
      delta: "niet gekoppeld",
      deltaTone: "pending",
      hint: "Ontbrekende env: VERCEL_TOKEN",
    });
  });

  it("distinguishes configured-but-failed from missing env", () => {
    expect(websiteVisitorsUnavailableCopy("failed")).toEqual({
      delta: "niet beschikbaar",
      deltaTone: "pending",
      hint: "Vercel Web Analytics API mislukt (token, team of storefront-project).",
    });
  });
});
