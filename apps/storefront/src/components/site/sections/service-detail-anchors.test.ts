import { describe, expect, it } from "vitest";
import {
  SERVICE_DETAIL_ANCHORS,
  SERVICE_DETAIL_ANCHOR_BY_CARD_ID,
  serviceDetailAnchorForCard,
  serviceDetailHref,
  servicesPagePathForPathname,
} from "./service-detail-anchors";

describe("service detail anchors (Phase 7)", () => {
  it("exposes the six stable public hashes", () => {
    expect([...SERVICE_DETAIL_ANCHORS]).toEqual([
      "reguliere-schoonmaak",
      "horeca-schoonmaak",
      "opleveringsschoonmaak",
      "vloeronderhoud",
      "meubelreiniging",
      "glas-gevelreiniging",
    ]);
  });

  it("maps default CMS card ids to those hashes", () => {
    expect(SERVICE_DETAIL_ANCHOR_BY_CARD_ID.svc_regular).toBe("reguliere-schoonmaak");
    expect(SERVICE_DETAIL_ANCHOR_BY_CARD_ID.svc_glass).toBe("glas-gevelreiniging");
    expect(serviceDetailAnchorForCard("svc_floor", 3)).toBe("vloeronderhoud");
    expect(serviceDetailAnchorForCard("unknown", 4)).toBe("meubelreiniging");
  });

  it("builds NL and EN services hash hrefs from pathname", () => {
    expect(servicesPagePathForPathname("/services")).toBe("/services");
    expect(servicesPagePathForPathname("/en/services")).toBe("/en/services");
    expect(servicesPagePathForPathname("/en/products")).toBe("/en/services");
    expect(serviceDetailHref("/services", "reguliere-schoonmaak")).toBe(
      "/services#reguliere-schoonmaak",
    );
    expect(serviceDetailHref("/en/services", "horeca-schoonmaak")).toBe(
      "/en/services#horeca-schoonmaak",
    );
  });
});
