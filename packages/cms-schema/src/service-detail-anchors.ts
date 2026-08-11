/**
 * Stable public hash anchors for service detail panels on `/services`.
 * Shared by footer defaults, storefront cards, and SEO integrity checks.
 *
 * Dedicated per-service landing URLs (e.g. `/reguliere-schoonmaak`) remain **deferred**.
 */

export const SERVICE_DETAIL_ANCHORS = [
  "reguliere-schoonmaak",
  "horeca-schoonmaak",
  "opleveringsschoonmaak",
  "vloeronderhoud",
  "meubelreiniging",
  "glas-gevelreiniging",
] as const;

export type ServiceDetailAnchor = (typeof SERVICE_DETAIL_ANCHORS)[number];

/** CMS default card id → public hash (order-aligned with defaultServiceCards). */
export const SERVICE_DETAIL_ANCHOR_BY_CARD_ID: Record<string, ServiceDetailAnchor> = {
  svc_regular: "reguliere-schoonmaak",
  svc_horeca: "horeca-schoonmaak",
  svc_oplevering: "opleveringsschoonmaak",
  svc_floor: "vloeronderhoud",
  svc_furniture: "meubelreiniging",
  svc_glass: "glas-gevelreiniging",
};

/** Footer service link id → public hash (order-aligned with defaultSiteFooter). */
export const SERVICE_DETAIL_ANCHOR_BY_FOOTER_LINK_ID: Record<string, ServiceDetailAnchor> = {
  footer_svc_1: "reguliere-schoonmaak",
  footer_svc_2: "horeca-schoonmaak",
  footer_svc_3: "opleveringsschoonmaak",
  footer_svc_4: "vloeronderhoud",
  footer_svc_5: "meubelreiniging",
  footer_svc_6: "glas-gevelreiniging",
};

export function serviceDetailAnchorForCard(cardId: string, index: number): ServiceDetailAnchor {
  const byId = SERVICE_DETAIL_ANCHOR_BY_CARD_ID[cardId];
  if (byId) return byId;
  return SERVICE_DETAIL_ANCHORS[index] ?? SERVICE_DETAIL_ANCHORS[0];
}

/** NL `/services` or EN `/en/services` from the active public pathname. */
export function servicesPagePathForPathname(pathname: string): "/services" | "/en/services" {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  if (trimmed === "/en" || trimmed.startsWith("/en/")) return "/en/services";
  return "/services";
}

export function serviceDetailHref(pathname: string, anchor: ServiceDetailAnchor): string {
  return `${servicesPagePathForPathname(pathname)}#${anchor}`;
}

/** Sanitize a CMS link hash fragment (no leading `#`). */
export function normalizeCmsLinkHash(hash: string | undefined | null): string | undefined {
  if (hash == null) return undefined;
  const cleaned = hash.trim().replace(/^#/, "");
  if (!cleaned) return undefined;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:~-]*$/.test(cleaned)) return undefined;
  return cleaned;
}

export function appendCmsLinkHash(path: string, hash: string | undefined | null): string {
  const normalized = normalizeCmsLinkHash(hash);
  if (!normalized) return path;
  return `${path}#${normalized}`;
}
