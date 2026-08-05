/**
 * Leaf link/route model — imported by links, content, button, and types.
 * Keep free of page/content imports to avoid circular graphs.
 */

export type BuiltinRouteKey =
  | "home"
  | "services"
  | "products"
  | "about"
  | "contact"
  | "vacatures"
  | "offerte"
  | "privacy"
  | "terms";

export type CmsLink =
  | { type: "none" }
  | { type: "internal"; pageId: string; openInNewTab?: boolean }
  | { type: "internal_route"; route: BuiltinRouteKey; openInNewTab?: boolean }
  | { type: "external"; url: string; openInNewTab?: boolean }
  | { type: "email"; email: string; subject?: string }
  | { type: "phone"; phone: string };

/** Minimal page shape for link resolvers (avoids importing Page from types). */
export type CmsLinkPageRef = {
  id: string;
  slug: string;
  title?: string;
};
