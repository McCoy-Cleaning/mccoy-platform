/**
 * Stable public hash anchors for service detail panels on `/services`.
 * Source of truth: `@mccoy/cms-schema` (shared with footer defaults / Phase 8).
 */
export {
  SERVICE_DETAIL_ANCHORS,
  SERVICE_DETAIL_ANCHOR_BY_CARD_ID,
  SERVICE_DETAIL_ANCHOR_BY_FOOTER_LINK_ID,
  appendCmsLinkHash,
  normalizeCmsLinkHash,
  serviceDetailAnchorForCard,
  serviceDetailHref,
  servicesPagePathForPathname,
  type ServiceDetailAnchor,
} from "@mccoy/cms-schema";
