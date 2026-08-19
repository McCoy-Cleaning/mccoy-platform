import { describe, expect, it } from "vitest";
import {
  WEBSITE_VISITORS_HINT_FAILED,
  WEBSITE_VISITORS_HINT_FORBIDDEN,
  WEBSITE_VISITORS_HINT_NOT_FOUND,
  websiteVisitorsUnavailableCopy,
} from "./admin-overview-visitors";

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
      hint: WEBSITE_VISITORS_HINT_FAILED,
    });
  });

  it("maps 404 / not_found to the storefront-project Dutch hint", () => {
    expect(websiteVisitorsUnavailableCopy("failed", [], "not_found")).toEqual({
      delta: "niet beschikbaar",
      deltaTone: "pending",
      hint: WEBSITE_VISITORS_HINT_NOT_FOUND,
    });
    expect(websiteVisitorsUnavailableCopy("failed", [], "404").hint).toBe(
      WEBSITE_VISITORS_HINT_NOT_FOUND,
    );
    expect(WEBSITE_VISITORS_HINT_NOT_FOUND).toBe(
      "Vercel-token ziet het storefront-project niet. Gebruik een team-token en het prj_ van www.mccoy.nl.",
    );
  });

  it("maps 403 / forbidden to the Web Analytics rights Dutch hint", () => {
    expect(websiteVisitorsUnavailableCopy("failed", [], "forbidden").hint).toBe(
      WEBSITE_VISITORS_HINT_FORBIDDEN,
    );
    expect(websiteVisitorsUnavailableCopy("failed", [], "403").hint).toBe(
      WEBSITE_VISITORS_HINT_FORBIDDEN,
    );
  });

  it("keeps niet beschikbaar for other failed codes", () => {
    const copy = websiteVisitorsUnavailableCopy("failed", [], "http_500");
    expect(copy.delta).toBe("niet beschikbaar");
    expect(copy.hint).toBe(WEBSITE_VISITORS_HINT_FAILED);
  });
});
